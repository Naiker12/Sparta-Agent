import { AudioWave01Icon, BookOpen01Icon, ChefHatIcon, DownloadSquare01Icon, Folder01Icon, Globe02Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons';

// Same navigation icons as desktop SidebarNavCustomizer; tasks uses the demo's automations view.
export const DEMO_NAV_ITEMS = [
  { id: 'projects', label: 'Proyectos', icon: Folder01Icon },
  { id: 'audio', label: 'Audio', icon: AudioWave01Icon },
  { id: 'recipes', label: 'Recetas', icon: ChefHatIcon },
  { id: 'export', label: 'Exportar', icon: DownloadSquare01Icon },
  { id: 'api', label: 'API', icon: Globe02Icon },
  { id: 'memory', label: 'Memoria', icon: BookOpen01Icon },
  { id: 'automations', label: 'Tareas', icon: PencilEdit02Icon },
] as const;
export type DemoNavId = typeof DEMO_NAV_ITEMS[number]['id'];
