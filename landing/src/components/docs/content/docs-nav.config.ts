export interface NavItem {
  label: string;
  slug: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    title: 'Primeros pasos',
    items: [
      { label: 'Instalación', slug: 'instalacion' },
      { label: 'Desarrollo local', slug: 'desarrollo-local' },
    ],
  },
  {
    title: 'Producto',
    items: [
      { label: 'Arquitectura', slug: 'arquitectura' },
      { label: 'Agentes y tareas', slug: 'agentes' },
      { label: 'Terminal integrada', slug: 'terminal' },
      { label: 'Proveedores', slug: 'proveedores' },
    ],
  },
  {
    title: 'Extensibilidad',
    items: [
      { label: 'Servidores MCP', slug: 'mcp' },
      { label: 'Skills', slug: 'skills' },
    ],
  },
  {
    title: 'Seguridad',
    items: [
      { label: 'Permisos y límites', slug: 'permisos' },
      { label: 'Vault de credenciales', slug: 'vault' },
    ],
  },
];
