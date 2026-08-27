import { cn } from '@/lib/utils';

const contents: Record<string, string[]> = {
  inicio: ['Qué es Sparta Agent', 'Documentación basada en código', 'Recorrido por el producto'],
  instalacion: ['Requisitos', 'Instalación', 'Primer inicio'],
  'desarrollo-local': ['Entorno de desarrollo', 'Comandos disponibles', 'Estructura del monorepo'],
  modos: ['Modo Chat vs Agente', 'Acciones permitidas', 'Diálogo de permisos'],
  'deep-research': ['Ciclo de investigación', 'Panel de actividad', 'Reporte final con citas'],
  'rag-multimodal': ['Búsqueda densa y dispersa', 'Formatos soportados', 'Citaciones automáticas'],
  adjuntos: ['Clasificación visual', 'Íconos por extensión', 'Indexación inteligente'],
  herramientas: ['Clima en vivo', 'Fecha y hora', 'Búsqueda web'],
  arquitectura: ['Vista general', 'Aplicación de escritorio', 'Flujo agéntico', 'Puente IPC'],
  agentes: ['Ciclo de tarea', 'Plan', 'Actividad', 'Revisión de cambios'],
  terminal: ['Terminal nativa', 'Proceso principal', 'Permisos'],
  proveedores: ['Configuración', 'Proveedores cloud', 'Proveedores locales', 'Descubrimiento de modelos'],
  mcp: ['Qué es MCP', 'Catálogo', 'Ejecución visible', 'OAuth'],
  skills: ['Catálogo de skills', 'Carga de capacidades', 'Auditoría'],
  permisos: ['Validación de rutas', 'Comandos sensibles', 'Decisiones del usuario'],
  vault: ['Almacenamiento', 'Gestor de claves', 'Bridge IPC'],
};

export function OnThisPage({ page }: { page: string }) {
  const items = contents[page] ?? contents.inicio;
  return (
    <aside aria-label="En esta página" className="hidden xl:block">
      <div className="sticky top-24 border-l border-white/10 pl-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">En esta página</p>
        <nav className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <a
              key={item}
              href="#contenido"
              className={cn(
                'text-sm leading-6 transition hover:text-white',
                index === 0 ? 'font-medium text-white' : 'text-zinc-400'
              )}
            >
              {item}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
