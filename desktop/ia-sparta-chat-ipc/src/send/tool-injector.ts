/**
 * tool-injector.ts
 * Inyección de herramientas (web_search, web_fetch, MCP reference tools) en el array de tools.
 */

import { buildWebSearchTool } from '../../../ia-sparta-core/src/services/tools/web-search'
import { buildWebFetchTool } from '../../../ia-sparta-core/src/services/tools/web-fetch'
import { buildGenerateChartTool } from '../../../ia-sparta-core/src/services/tools/generate-chart'

/** Catálogo de referencia de herramientas MCP conocidas con schemas explícitos */
export const mcpCatalogReferenceTools: Record<string, Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>> = {
  gmail: [
    {
      name: 'list_messages',
      description: 'Listar mensajes de correo en Gmail. Retorna los últimos correos del usuario.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda para filtrar correos (ej: "from:user@gmail.com")' },
          max_results: { type: 'number', description: 'Cantidad máxima de correos a retornar (default: 10)' },
        },
      },
    },
    {
      name: 'get_thread',
      description: 'Obtener un hilo completo de conversación de Gmail por su ID.',
      inputSchema: {
        type: 'object',
        properties: {
          threadId: { type: 'string', description: 'ID del hilo de Gmail' },
        },
        required: ['threadId'],
      },
    },
    {
      name: 'search_threads',
      description: 'Buscar hilos de conversación en Gmail por query.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda (ej: "subject:factura")' },
          max_results: { type: 'number', description: 'Cantidad máxima de hilos (default: 10)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'create_draft',
      description: 'Crear un borrador de correo en Gmail.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Dirección de correo del destinatario (ej: usuario@gmail.com)' },
          subject: { type: 'string', description: 'Asunto del correo' },
          body: { type: 'string', description: 'Cuerpo del mensaje en texto plano' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    {
      name: 'send_message',
      description: 'Enviar un correo electrónico por Gmail directamente.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Dirección de correo del destinatario (ej: usuario@gmail.com)' },
          subject: { type: 'string', description: 'Asunto del correo' },
          body: { type: 'string', description: 'Cuerpo del mensaje en texto plano' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  ],
  'google-drive': [
    {
      name: 'search_files',
      description: 'Buscar archivos en Google Drive.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query de búsqueda de archivos en Google Drive' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_file_metadata',
      description: 'Obtener metadatos de un archivo en Google Drive.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'ID del archivo en Google Drive' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'export_doc',
      description: 'Exportar un documento de Google Drive a texto plano.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'ID del archivo a exportar' },
          mimeType: { type: 'string', description: 'Formato de exportación (default: text/plain)' },
        },
        required: ['fileId'],
      },
    },
  ],
  onedrive: [
    {
      name: 'search_files',
      description: 'Buscar archivos en OneDrive y SharePoint Online.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término o consulta de búsqueda de archivos' },
        },
        required: ['query'],
      },
    },
    {
      name: 'download_file',
      description: 'Descargar u obtener el contenido de un archivo de Microsoft Graph.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'ID del archivo en OneDrive / SharePoint' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'list_files',
      description: 'Listar archivos y carpetas en la unidad de OneDrive.',
      inputSchema: {
        type: 'object',
        properties: {
          folderId: { type: 'string', description: 'ID de la carpeta (opcional, por defecto raíz)' },
        },
      },
    },
    {
      name: 'get_file_metadata',
      description: 'Obtener metadatos detallados de un archivo en OneDrive.',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'ID del archivo en OneDrive' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'upload_file',
      description: 'Subir un nuevo archivo a OneDrive.',
      inputSchema: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Nombre del archivo a subir' },
          content: { type: 'string', description: 'Contenido del archivo a subir' },
          folderId: { type: 'string', description: 'ID de la carpeta destino (opcional)' },
        },
        required: ['filename'],
      },
    },
  ],
  github: [
    {
      name: 'search_repositories',
      description: 'Buscar repositorios en GitHub.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda de repositorios' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_file_contents',
      description: 'Obtener contenido de un archivo en un repositorio de GitHub.',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Dueño del repositorio' },
          repo: { type: 'string', description: 'Nombre del repositorio' },
          path: { type: 'string', description: 'Ruta del archivo' },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
    {
      name: 'create_issue',
      description: 'Crear una issue en un repositorio de GitHub.',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Dueño del repositorio' },
          repo: { type: 'string', description: 'Nombre del repositorio' },
          title: { type: 'string', description: 'Título de la issue' },
          body: { type: 'string', description: 'Descripción de la issue' },
        },
        required: ['owner', 'repo', 'title'],
      },
    },
  ],
  notion: [
    {
      name: 'search',
      description: 'Buscar páginas y bases de datos en Notion por consulta.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término a buscar en Notion' },
        },
      },
    },
    {
      name: 'get_page',
      description: 'Obtener el contenido estructurado y propiedades de una página de Notion.',
      inputSchema: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'ID de la página de Notion' },
        },
        required: ['page_id'],
      },
    },
    {
      name: 'create_page',
      description: 'Crear una nueva página en una base de datos o subpágina en Notion.',
      inputSchema: {
        type: 'object',
        properties: {
          parent_id: { type: 'string', description: 'ID de la base de datos o página padre' },
          title: { type: 'string', description: 'Título de la nueva página' },
          content: { type: 'string', description: 'Contenido inicial de la página' },
        },
        required: ['parent_id', 'title'],
      },
    },
    {
      name: 'append_block',
      description: 'Añadir nuevo contenido o bloques a una página de Notion.',
      inputSchema: {
        type: 'object',
        properties: {
          block_id: { type: 'string', description: 'ID de la página o bloque objetivo' },
          content: { type: 'string', description: 'Texto o bloque a añadir' },
        },
        required: ['block_id', 'content'],
      },
    },
  ],
  filesystem: [
    {
      name: 'read_file',
      description: 'Leer el contenido de un archivo en el filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta absoluta del archivo a leer' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Escribir o crear un archivo en el filesystem.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta absoluta del archivo a escribir' },
          content: { type: 'string', description: 'Contenido a escribir' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'list_directory',
      description: 'Listar archivos y subdirectorios de una carpeta.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta absoluta del directorio' },
        },
        required: ['path'],
      },
    },
    {
      name: 'directory_tree',
      description: 'Obtener la estructura en árbol del directorio.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Ruta absoluta del directorio raíz' },
        },
        required: ['path'],
      },
    },
  ],
}

/**
 * Construye la lista de herramientas para el turno actual. Los conectores MCP
 * solo deben llegar desde el renderer cuando están habilitados; inyectar el
 * catálogo de referencia completo vuelve innecesariamente grande la petición
 * y ofrece funciones que el usuario no conectó.
 */
const MUTATION_TOOL_NAMES = new Set([
  'write_file',
  'edit_file',
  'delete_file',
  'run_command',
  'filesystem__write_file',
  'filesystem__delete_file',
])

export function buildToolsList(
  requestTools: unknown[] | undefined,
  webSearchEnabled?: boolean,
  mode: 'chat' | 'agent' = 'agent',
): unknown[] {
  let tools: unknown[] = requestTools ? [...requestTools] : []

  if (mode === 'chat') {
    // In Chat Mode (read-only), remove any mutation tools
    tools = tools.filter((t: any) => {
      const name = t.name || t.function?.name
      if (MUTATION_TOOL_NAMES.has(name)) return false
      if (typeof name === 'string' && (name.startsWith('create_') || name.startsWith('update_') || name.startsWith('delete_') || name.startsWith('send_'))) {
        return false
      }
      return true
    })
  }

  // generate_chart is a read-only visualizer available in both modes
  const hasGenerateChart = tools.some((t: any) =>
    t.name === 'generate_chart' || t.function?.name === 'generate_chart'
  )
  if (!hasGenerateChart) {
    tools.push(buildGenerateChartTool())
  }

  if (webSearchEnabled) {
    const hasWebSearch = tools.some((t: any) =>
      t.name === 'web_search' || t.function?.name === 'web_search'
    )
    if (!hasWebSearch) {
      tools.push(buildWebSearchTool())
    }
    const hasWebFetch = tools.some((t: any) =>
      t.name === 'web_fetch' || t.function?.name === 'web_fetch'
    )
    if (!hasWebFetch) {
      tools.push(buildWebFetchTool())
    }
  }

  return tools
}
