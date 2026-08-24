import { ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT_LINE = /^TAURI_PORT=(\d+)\s*$/m;

export class BackendManager {
  private process: ChildProcess | undefined;
  private port: number | undefined;

  getPort(): number | undefined { return this.port; }

  async start(backendDir: string): Promise<number> {
    if (this.port) return this.port;
    if (this.process) throw new Error("El backend ya se está iniciando.");
    const python = this.findPython(backendDir);
    if (!python) throw new Error("No se encontró Python. Configure SPARTA_PYTHON o instale Python 3.11+.");
    return new Promise<number>((resolve, reject) => {
      const child = spawn(python.command, [...python.args, "run.py", "--api-only", "--port", "0"], {
        cwd: backendDir,
        env: { ...process.env, PYTHONPATH: backendDir, UNSLOTH_STUDIO_DESKTOP_OWNER_PID: String(process.pid) },
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
      });
      this.process = child;
      let output = "";
      const read = (chunk: Buffer) => {
        output += chunk.toString();
        const port = PORT_LINE.exec(output)?.[1];
        if (port && !this.port) { this.port = Number(port); resolve(this.port); }
      };
      child.stdout?.on("data", read); child.stderr?.on("data", read);
      child.once("error", reject);
      child.once("exit", (code) => {
        if (!this.port) reject(new Error(`El backend terminó antes de iniciar (código ${code ?? "desconocido"}).\n${output.slice(-2000)}`));
        this.process = undefined; this.port = undefined;
      });
    });
  }

  stop(): void { const child = this.process; this.process = undefined; this.port = undefined; if (child && !child.killed) child.kill(); }

  private findPython(backendDir: string): { command: string; args: string[] } | undefined {
    const configured = process.env.SPARTA_PYTHON;
    if (configured && existsSync(configured)) return { command: configured, args: [] };
    const bundled = path.join(backendDir, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python");
    if (existsSync(bundled)) return { command: bundled, args: [] };
    const local = process.env.LOCALAPPDATA;
    if (local) for (const version of ["Python313", "Python312", "Python311"]) {
      const candidate = path.join(local, "Programs", "Python", version, "python.exe");
      if (existsSync(candidate)) return { command: candidate, args: [] };
    }
    return process.platform === "win32" ? { command: "py", args: ["-3"] } : { command: "python3", args: [] };
  }
}
