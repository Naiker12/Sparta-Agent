import { ChildProcess, spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT_LINE = /^TAURI_PORT=(\d+)\s*$/m;

export class BackendManager {
  private process: ChildProcess | undefined;
  private port: number | undefined;

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
        throw new Error("El motor local de Sparta aún no está preparado. Instálalo para crear su entorno aislado.");
      }
      console.warn("[backend-manager] Python no encontrado en el sistema. Operando en modo Electron agéntico puro.");
      throw new Error("No se encontró Python. Sparta Agent puede operar directamente con modelos cloud y herramientas locales.");
    }

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
      const child = spawn(python.command, [...python.args, "run.py", "--api-only", "--port", "0"], {
        cwd: backendDir,
        env: { ...childEnv, PYTHONPATH: backendDir },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      this.process = child;
      let output = "";
      const read = (chunk: Buffer) => {
        output += chunk.toString();
        const port = PORT_LINE.exec(output)?.[1];
        if (port && !this.port) {
          this.port = Number(port);
          resolve(this.port);
        }
      };
      child.stdout?.on("data", read);
      child.stderr?.on("data", read);
      child.once("error", reject);
      child.once("exit", (code) => {
        if (!this.port) {
          reject(new Error(`El backend terminó antes de iniciar (código ${code ?? "desconocido"}).\n${output.slice(-2000)}`));
        }
        this.process = undefined;
        this.port = undefined;
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
      throw new Error("No se encontrÃ³ Python para instalar el motor local. Instala Python 3.10 o superior y vuelve a intentarlo.");
    }

    const venvDir = path.join(runtimeDir, ".venv");
    const venvPython = path.join(
      venvDir,
      process.platform === "win32" ? "Scripts" : "bin",
      process.platform === "win32" ? "python.exe" : "python",
    );
    const requirements = path.join(backendDir, "requirements.txt");
    if (!existsSync(requirements)) throw new Error("No se encontrÃ³ requirements.txt en el motor local.");

    if (existsSync(venvPython)) {
      onProgress(`Entorno local existente detectado: ${venvDir}`);
    } else {
      onProgress("Creando entorno de Python aislado para Sparta...");
      await this.run(systemPython.command, [...systemPython.args, "-m", "venv", venvDir], backendDir, onProgress);
    }

    onProgress("Actualizando instalador de paquetes...");
    await this.run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], backendDir, onProgress);

    onProgress("Instalando dependencias del motor local...");
    await this.run(venvPython, ["-m", "pip", "install", "-r", requirements], backendDir, onProgress);

    onProgress("Verificando dependencias críticas del motor...");
    await this.run(
      venvPython,
      ["-c", "import structlog, fastapi; print('Dependencias críticas verificadas')"],
      backendDir,
      onProgress,
    );
  }

  stop(): void {
    const child = this.process;
    this.process = undefined;
    this.port = undefined;
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
        else reject(new Error(`La instalaciÃ³n fallÃ³ (cÃ³digo ${code ?? "desconocido"}).\n${output.slice(-2000)}`));
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
}
