import { ChildProcess, spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const PORT_LINE = /^TAURI_PORT=(\d+)\s*$/m;
const RUNTIME_MANIFEST = "sparta-runtime.json";
const RUNTIME_FINGERPRINT_FILES = ["requirements.txt", "run.py", "main.py", "desktop_bootstrap.py"];

type RuntimeManifest = { backendFingerprint: string; createdAt: string };

export class BackendManager {
  private process: ChildProcess | undefined;
  private port: number | undefined;
  private desktopSecret: string | undefined;

  async authenticate(): Promise<{ access_token: string; refresh_token: string }> {
    if (!this.port || !this.desktopSecret) throw new Error("Backend is not ready");
    const response = await fetch(`http://127.0.0.1:${this.port}/api/auth/desktop-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: this.desktopSecret }),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Desktop authentication failed (${response.status})`);
    const tokens = await response.json();
    if (typeof tokens.access_token !== "string" || typeof tokens.refresh_token !== "string") {
      throw new Error("Invalid desktop authentication response");
    }
    return { access_token: tokens.access_token, refresh_token: tokens.refresh_token };
  }

  getPort(): number | undefined {
    return this.port;
  }

  async start(backendDir: string, runtimeDir?: string): Promise<number> {
    if (this.port) return this.port;
    if (this.process) throw new Error("El backend ya se está iniciando.");
    // A managed Electron runtime must be isolated from global Python installs
    // and from other desktop products such as Unsloth/GeoNexus.
    const python = runtimeDir ? this.findRuntimePython(runtimeDir) : this.findPython(backendDir);
    if (!python) {
      if (runtimeDir) {
        throw new Error("El entorno del backend de Sparta aún no está preparado. Instálalo para crear su entorno aislado.");
      }
      console.warn("[backend-manager] Python no encontrado en el sistema. Operando en modo Electron agéntico puro.");
      throw new Error("No se encontró Python. Sparta Agent puede operar directamente con modelos cloud y herramientas locales.");
    }

    const migrateLegacyRuntime = runtimeDir
      ? this.assertRuntimeMatchesBackend(backendDir, runtimeDir)
      : false;

    const runScript = path.join(backendDir, "run.py");
    if (!existsSync(runScript)) {
      console.warn("[backend-manager] run.py no encontrado en backendDir:", backendDir);
      throw new Error("Script de backend no encontrado.");
    }

    return new Promise<number>((resolve, reject) => {
      const childEnv: NodeJS.ProcessEnv = { ...process.env };
      for (const key of Object.keys(childEnv)) {
        if (key.startsWith("UNSLOTH_")) delete childEnv[key];
      }
      // The backend originates from Unsloth Studio, but its mutable state must
      // belong to Sparta. Never inherit C:\\Users\\...\\.unsloth from another app.
      childEnv.UNSLOTH_STUDIO_HOME = path.join(runtimeDir ?? backendDir, "studio-data");
      childEnv.UNSLOTH_STUDIO_DESKTOP_OWNER_PID = String(process.pid);
      const child = spawn(python.command, [...python.args, "desktop_bootstrap.py", "--api-only", "--port", "0"], {
        cwd: backendDir,
        env: { ...childEnv, PYTHONPATH: backendDir },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      this.process = child;
      let output = "";
      let stdoutPending = "";
      let announcedPort: number | undefined;
      const resolveWhenReady = () => {
        if (this.process !== child || this.port || !announcedPort || !this.desktopSecret) return;
        this.port = announcedPort;
        if (migrateLegacyRuntime && runtimeDir) {
          try {
            // The process reached its ready handshake, so this old environment
            // is known-good for the bundled backend and can be adopted once.
            this.writeRuntimeManifest(backendDir, runtimeDir);
          } catch (error) {
            console.warn("[backend-manager] No se pudo migrar la huella del motor:", error);
          }
        }
        resolve(this.port);
      };
      const read = (text: string) => {
        output = (output + text).slice(-8192);
        const port = PORT_LINE.exec(output)?.[1];
        if (port && Number(port) > 0 && Number(port) <= 65535) {
          announcedPort = Number(port);
          resolveWhenReady();
        }
      };
      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutPending += chunk.toString();
        let newline: number;
        while ((newline = stdoutPending.indexOf("\n")) !== -1) {
          const line = stdoutPending.slice(0, newline).trimEnd();
          stdoutPending = stdoutPending.slice(newline + 1);
          if (line.startsWith("SPARTA_DESKTOP_SECRET=")) {
            this.desktopSecret = line.slice("SPARTA_DESKTOP_SECRET=".length);
            resolveWhenReady();
          } else read(line + "\n");
        }
        // Bound unfinished log lines without ever including a secret in diagnostics.
        if (stdoutPending.length > 8192) stdoutPending = "";
      });
      child.stderr?.on("data", (chunk: Buffer) => read(chunk.toString()));
      child.once("error", reject);
      child.once("exit", (code) => {
        if (this.process !== child) return;
        if (!this.port) {
          reject(new Error(`El backend terminó antes de iniciar (código ${code ?? "desconocido"}).\n${output.slice(-2000)}`));
        }
        this.process = undefined;
        this.port = undefined;
        this.desktopSecret = undefined;
      });
    });
  }

  /**
   * Builds a user-writable virtual environment for the packaged backend.
   * The application resources directory must never be mutated: Windows installs
   * commonly live below Program Files and are read-only for a normal user.
   */
  async bootstrap(
    backendDir: string,
    runtimeDir: string,
    onProgress: (message: string) => void,
  ): Promise<void> {
    const systemPython = this.findPython(backendDir);
    if (!systemPython) {
      throw new Error("No se encontró Python para instalar el backend. Instala Python 3.10 o superior y vuelve a intentarlo.");
    }

    const venvDir = path.join(runtimeDir, ".venv");
    const venvPython = path.join(
      venvDir,
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "python.exe" : "python",
    );
    const requirements = path.join(backendDir, "requirements.txt");
    if (!existsSync(requirements)) throw new Error("No se encontró requirements.txt en el backend.");

    if (existsSync(venvPython)) {
      onProgress(`Entorno local existente detectado: ${venvDir}`);
    } else {
      onProgress("Creando entorno de Python aislado para Sparta...");
      await this.run(systemPython.command, [...systemPython.args, "-m", "venv", venvDir], backendDir, onProgress);
    }

    onProgress("Actualizando instalador de paquetes...");
    await this.run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], backendDir, onProgress);

    onProgress("Instalando dependencias del backend...");
    await this.run(venvPython, ["-m", "pip", "install", "-r", requirements], backendDir, onProgress);

    onProgress("Verificando dependencias críticas del motor...");
    await this.run(
      venvPython,
      ["-c", "import structlog, fastapi; print('Dependencias críticas verificadas')"],
      backendDir,
      onProgress,
    );

    this.writeRuntimeManifest(backendDir, runtimeDir);
  }

  stop(): void {
    const child = this.process;
    this.process = undefined;
    this.port = undefined;
    this.desktopSecret = undefined;
    if (child && !child.killed) {
      child.kill();
    }
  }

  private async run(command: string, args: string[], cwd: string, onProgress: (message: string) => void): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      onProgress(`$ ${command} ${args.join(" ")}`);
      const child = spawn(command, args, {
        cwd,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      const read = (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) onProgress(line.slice(0, 500));
        }
      };
      child.stdout?.on("data", read);
      child.stderr?.on("data", read);
      child.once("error", (error) => reject(new Error(`No se pudo ejecutar ${command}: ${error.message}`)));
      child.once("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`La instalación falló (código ${code ?? "desconocido"}).\n${output.slice(-2000)}`));
      });
    });
  }

  private findPython(backendDir: string, runtimeDir?: string): { command: string; args: string[] } | undefined {
    const configured = process.env.SPARTA_PYTHON;
    if (configured && existsSync(configured)) return { command: configured, args: [] };

    const bundled = path.join(
      runtimeDir ?? backendDir,
      ".venv",
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "python.exe" : "python"
    );
    if (existsSync(bundled)) return { command: bundled, args: [] };

    if (process.platform === "win32") {
      const local = process.env.LOCALAPPDATA;
      if (local) {
        for (const version of ["Python313", "Python312", "Python311", "Python310"]) {
          const candidate = path.join(local, "Programs", "Python", version, "python.exe");
          if (existsSync(candidate)) return { command: candidate, args: [] };
        }
      }

      for (const root of ["C:\\", "C:\\Program Files\\", "C:\\Program Files (x86)\\"]) {
        for (const version of ["Python313", "Python312", "Python311", "Python310"]) {
          const candidate = path.join(root, version, "python.exe");
          if (existsSync(candidate)) return { command: candidate, args: [] };
        }
      }

      try {
        const found = execSync("where.exe python.exe 2>nul").toString().trim().split("\n")[0]?.trim();
        if (found && existsSync(found)) return { command: found, args: [] };
      } catch {}

      try {
        const foundPy = execSync("where.exe py.exe 2>nul").toString().trim().split("\n")[0]?.trim();
        if (foundPy && existsSync(foundPy)) return { command: foundPy, args: ["-3"] };
      } catch {}

      return undefined;
    }

    try {
      const found3 = execSync("which python3 2>/dev/null").toString().trim();
      if (found3 && existsSync(found3)) return { command: found3, args: [] };
    } catch {}

    return undefined;
  }

  private findRuntimePython(runtimeDir: string): { command: string; args: string[] } | undefined {
    const python = path.join(
      runtimeDir,
      ".venv",
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "python.exe" : "python",
    );
    return existsSync(python) ? { command: python, args: [] } : undefined;
  }

  /**
   * A virtualenv is writable and survives app upgrades.  Its dependencies must
   * never silently be reused with a different bundled backend tree.
   */
  private assertRuntimeMatchesBackend(backendDir: string, runtimeDir: string): boolean {
    const manifestPath = path.join(runtimeDir, RUNTIME_MANIFEST);
    const expected = this.backendFingerprint(backendDir);
    let stored: RuntimeManifest | undefined;
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<RuntimeManifest>;
      if (typeof parsed.backendFingerprint === "string") {
        stored = { backendFingerprint: parsed.backendFingerprint, createdAt: String(parsed.createdAt ?? "") };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Version 0.2.20 introduced the marker. A legacy venv that completes
        // the authenticated ready handshake is safe to adopt once; future
        // changes will be checked against the newly written fingerprint.
        return true;
      }
      throw new Error("No se pudo leer la versión del backend. Actualízalo para reconstruir su entorno aislado.");
    }
    if (!stored || stored.backendFingerprint !== expected) {
      throw new Error("El backend pertenece a otra versión de Sparta. Actualízalo para reconstruir su entorno aislado.");
    }
    return false;
  }

  private writeRuntimeManifest(backendDir: string, runtimeDir: string): void {
    mkdirSync(runtimeDir, { recursive: true });
    const target = path.join(runtimeDir, RUNTIME_MANIFEST);
    const temporary = `${target}.tmp`;
    const manifest: RuntimeManifest = {
      backendFingerprint: this.backendFingerprint(backendDir),
      createdAt: new Date().toISOString(),
    };
    writeFileSync(temporary, JSON.stringify(manifest), "utf8");
    renameSync(temporary, target);
  }

  private backendFingerprint(backendDir: string): string {
    const hash = createHash("sha256");
    const requirementFiles = this.collectRequirementFiles(path.join(backendDir, "requirements"), backendDir);
    for (const filename of [...RUNTIME_FINGERPRINT_FILES, ...requirementFiles]) {
      const file = path.join(backendDir, filename);
      if (!existsSync(file)) throw new Error(`No se pudo verificar el backend: falta ${filename}.`);
      hash.update(filename);
      hash.update("\0");
      hash.update(readFileSync(file));
      hash.update("\0");
    }
    return hash.digest("hex");
  }

  private collectRequirementFiles(directory: string, backendDir: string): string[] {
    if (!existsSync(directory)) return [];
    const files: string[] = [];
    const visit = (current: string) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) visit(target);
        else if (entry.isFile()) files.push(path.relative(backendDir, target));
      }
    };
    visit(directory);
    return files.sort();
  }
}
