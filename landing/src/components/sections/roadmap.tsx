import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { SectionHeader } from '../ui/section-header';
import { CheckCircle2, Clock } from 'lucide-react';

export function Roadmap() {
  const completed = [
    'Chat, proyectos, archivos y terminal en una aplicación de escritorio',
    'Conexiones por API para proveedores de IA y servidores compatibles',
    'Configuración de credenciales y modelos disponibles por proveedor',
    'Controles de permisos para acciones sensibles',
    'Compatibilidad con Model Context Protocol (MCP)',
  ];

  const inProgress = [
    'Más proveedores y catálogos de modelos por API',
    'Mejoras en diagnóstico de conexión y cuota',
    'Más conectores MCP y controles de permisos',
    'Experiencia colaborativa para equipos de ingeniería',
  ];

  return (
    <section id="roadmap" className="py-24 md:py-32 relative bg-[#0a0a0a] border-t border-[rgba(186,215,247,0.12)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="ROADMAP DEL PROYECTO"
          title="Estado de Desarrollo y Hoja de Ruta"
          description="Progreso público transparente tomado 1:1 de nuestro repositorio oficial."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Completed Features */}
          <Card className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] p-8 space-y-6 hover:border-emerald-500/20 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(186,215,247,0.06)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                  Disponible
                </h3>
              </div>
              <Badge variant="success">Completado</Badge>
            </div>

            <ul className="space-y-3 font-mono text-xs text-[#d1e4fa]">
              {completed.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* In Progress Features */}
          <Card className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] p-8 space-y-6 hover:border-amber-500/20 transition-all duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(186,215,247,0.06)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/5 text-amber-400 border border-amber-500/10">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                  En Desarrollo / Siguiente
                </h3>
              </div>
              <Badge variant="warning">En Progreso</Badge>
            </div>

            <ul className="space-y-3 font-mono text-xs text-[#c7d3ea]">
              {inProgress.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-amber-400 font-bold">⏳</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </section>
  );
}
