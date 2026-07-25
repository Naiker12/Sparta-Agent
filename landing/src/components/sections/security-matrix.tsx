import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { SectionHeader } from '../ui/section-header';
import { ShieldCheck, ShieldAlert, Lock, Eye, Edit3, Slash } from 'lucide-react';

export function SecurityMatrix() {
  return (
    <section id="seguridad" className="py-24 md:py-32 relative bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="MATRIZ DE SEGURIDAD NATIVA"
          title="Cero Sorpresas. Control de Permisos por Diseño."
          description="El broker de seguridad escrito en Rust intercepta todas las operaciones I/O en la capa del sistema operativo antes de su ejecución."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PermissionPolicy */}
          <Card className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] p-8 space-y-6 flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-300">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-indigo-500/5 text-indigo-400 w-fit border border-indigo-500/10">
                <ShieldCheck className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                1. PermissionPolicy Modes
              </h3>
              <p className="text-sm text-[#9da7ba] leading-relaxed">
                Control estricto de los privilegios concedidos al agente en cada fase de la interacción.
              </p>
              <div className="space-y-3 pt-2 font-mono text-xs">
                <div className="p-3 rounded-[6px] bg-[#05060f] border border-[rgba(186,215,247,0.08)] flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sky-400">
                    <Eye className="w-4 h-4" /> PLAN Mode
                  </span>
                  <Badge variant="outline" className="text-[10px]">Solo Lectura</Badge>
                </div>
                <div className="p-3 rounded-[6px] bg-[#05060f] border border-[rgba(186,215,247,0.08)] flex items-center justify-between">
                  <span className="flex items-center gap-2 text-emerald-400">
                    <Edit3 className="w-4 h-4" /> BUILD Mode
                  </span>
                  <Badge variant="success" className="text-[10px]">Escritura Autorizada</Badge>
                </div>
              </div>
            </div>
            <div className="text-[11px] font-mono text-[#9da7ba] pt-4 border-t border-[rgba(186,215,247,0.06)]">
              $ sparta security --policy=PLAN
            </div>
          </Card>

          {/* CommandSanitizer */}
          <Card className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] p-8 space-y-6 flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-300">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-rose-500/5 text-rose-400 w-fit border border-rose-500/10">
                <ShieldAlert className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                2. CommandSanitizer (Rust)
              </h3>
              <p className="text-sm text-[#9da7ba] leading-relaxed">
                Filtro sintáctico en Rust que evalúa cada comando de terminal antes de invocar el subproceso.
              </p>
              <div className="space-y-2 pt-2 font-mono text-xs">
                <div className="p-2.5 rounded-[6px] bg-rose-500/5 text-rose-300 border border-rose-500/10 flex items-center gap-2">
                  <Slash className="w-4 h-4 text-rose-400" /> Bloqueado: rm -rf /
                </div>
                <div className="p-2.5 rounded-[6px] bg-rose-500/5 text-rose-300 border border-rose-500/10 flex items-center gap-2">
                  <Slash className="w-4 h-4 text-rose-400" /> Bloqueado: dd if=/dev/zero
                </div>
                <div className="p-2.5 rounded-[6px] bg-rose-500/5 text-rose-300 border border-rose-500/10 flex items-center gap-2">
                  <Slash className="w-4 h-4 text-rose-400" /> Bloqueado: curl non-whitelisted | bash
                </div>
              </div>
            </div>
            <div className="text-[11px] font-mono text-[#9da7ba] pt-4 border-t border-[rgba(186,215,247,0.06)]">
              Status: Rust NAPI Broker active (0ms overhead)
            </div>
          </Card>

          {/* PathGuard & Denylist */}
          <Card className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] p-8 space-y-6 flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-300">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/5 text-amber-400 w-fit border border-amber-500/10">
                <Lock className="w-5.5 h-5.5" />
              </div>
              <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                3. PathGuard & Denylist
              </h3>
              <p className="text-sm text-[#9da7ba] leading-relaxed">
                El agente está confinado estrictamente al workspace activo. Los archivos sensibles están denegados.
              </p>
              <div className="space-y-2 pt-2 font-mono text-xs text-[#c7d3ea]">
                <div className="p-2.5 rounded-[6px] bg-[#05060f] border border-[rgba(186,215,247,0.08)] flex items-center justify-between">
                  <span>.env / .env.local</span>
                  <span className="text-rose-400 font-bold">ACCESO DENEGADO</span>
                </div>
                <div className="p-2.5 rounded-[6px] bg-[#05060f] border border-[rgba(186,215,247,0.08)] flex items-center justify-between">
                  <span>*.pem / *.key / id_rsa</span>
                  <span className="text-rose-400 font-bold">ACCESO DENEGADO</span>
                </div>
                <div className="p-2.5 rounded-[6px] bg-[#05060f] border border-[rgba(186,215,247,0.08)] flex items-center justify-between">
                  <span>Rutas fuera del workspace</span>
                  <span className="text-rose-400 font-bold">BLOQUEADAS</span>
                </div>
              </div>
            </div>
            <div className="text-[11px] font-mono text-[#9da7ba] pt-4 border-t border-[rgba(186,215,247,0.06)]">
              Vault AES-256 local para credenciales
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
