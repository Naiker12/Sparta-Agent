import { cn } from '@/lib/utils';

const contents: Record<string, string[]> = {
  inicio: ['Qué es Sparta Agent', 'Documentación basada en código', 'Recorrido por el producto'],
  instalacion: ['Requisitos', 'Instalación', 'Primer inicio'],
  'desarrollo-local': ['Entorno de desarrollo', 'Comandos disponibles', 'Estructura del monorepo'],
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
      <div className="sticky top-24 border-l border-zinc-200 pl-5 dark:border-white/10">
        <p className="mb-3 text-sm text-zinc-500">En esta página</p>
        <nav className="flex flex-col gap-1.5">{items.map((item, index) => <a key={item} href="#contenido" className={cn('text-sm leading-6 transition hover:text-zinc-950 dark:hover:text-white', index === 0 ? 'font-medium text-zinc-950 dark:text-white' : 'text-zinc-500 dark:text-zinc-400')}>{item}</a>)}</nav>
      </div>
    </aside>
  );
}
