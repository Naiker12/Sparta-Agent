import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ShieldCheck, ShieldAlert, Lock, Eye, Edit3, Slash } from 'lucide-react';

export function SecurityMatrix() {
  return (
    <section id="seguridad" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <Badge variant="default" className="text-xs uppercase font-mono tracking-wider">
            Matriz de Seguridad Nativa
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Cero Sorpresas. Control de Permisos por Diseño.
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            El broker de seguridad escrito en Rust intercepta todas las operaciones I/O en la capa del sistema operativo antes de su ejecución.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PermissionPolicy */}
          <Card className="border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-display text-[var(--text-display)]">
                1. PermissionPolicy Modes
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Control estricto de los privilegios concedidos al agente en cada fase de la interacción.
              </p>
              <div className="space-y-3 pt-2 font-mono text-xs">
                <div className="p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sky-400">
                    <Eye className="w-4 h-4" /> PLAN Mode
                  </span>
                  <Badge variant="outline" className="text-[10px]">Solo Lectura</Badge>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="flex items-center gap-2 text-emerald-400">
                    <Edit3 className="w-4 h-4" /> BUILD Mode
                  </span>
                  <Badge variant="success" className="text-[10px]">Escritura Autorizada</Badge>
                </div>
              </div>
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] pt-4 border-t border-[var(--border-subtle)]">
              $ sparta security --policy=PLAN
            </div>
          </Card>

          {/* CommandSanitizer */}
          <Card className="border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 w-fit">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-display text-[var(--text-display)]">
                2. CommandSanitizer (Rust)
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Filtro sintáctico en Rust que evalúa cada comando de terminal antes de invocar el subproceso.
              </p>
              <div className="space-y-2 pt-2 font-mono text-xs">
                <div className="p-2.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-2">
                  <Slash className="w-4 h-4 text-rose-400" /> Bloqueado: rm -rf /
                </div>
                <div className="p-2.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-2">
                  <Slash className="w-4 h-4 text-rose-400" /> Bloqueado: dd if=/dev/zero
                </div>
                <div className="p-2.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-2">
                  <Slash className="w-4 h-4 text-rose-400" /> Bloqueado: curl non-whitelisted | bash
                </div>
              </div>
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] pt-4 border-t border-[var(--border-subtle)]">
              Status: Rust NAPI Broker active (0ms overhead)
            </div>
          </Card>

          {/* PathGuard & Denylist */}
          <Card className="border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 w-fit">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold font-display text-[var(--text-display)]">
                3. PathGuard & Denylist
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                El agente está confinado estrictamente al workspace activo. Los archivos sensibles están denegados.
              </p>
              <div className="space-y-2 pt-2 font-mono text-xs text-[var(--text-secondary)]">
                <div className="p-2.5 rounded bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <span>.env / .env.local</span>
                  <span className="text-rose-400 font-bold">ACCESO DENEGADO</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <span>*.pem / *.key / id_rsa</span>
                  <span className="text-rose-400 font-bold">ACCESO DENEGADO</span>
                </div>
                <div className="p-2.5 rounded bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-between">
                  <span>Rutas fuera del workspace</span>
                  <span className="text-rose-400 font-bold">BLOQUEADAS</span>
                </div>
              </div>
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] pt-4 border-t border-[var(--border-subtle)]">
              Vault AES-256 local para credenciales
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
