/**
 * native-file-tools.ts — Herramientas nativas de archivo para el agente.
 *
 * Implementan read_file, write_file, edit_file, delete_file, list_directory
 * usando la API IPC de window.fs.* directamente, sin depender del servidor MCP
 * de filesystem externo.
 */

export interface NativeToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

export const NATIVE_FILE_TOOL_NAMES = [
  'read_file',
  'write_file',
  'edit_file',
  'delete_file',
  'list_directory',
] as const

export type NativeFileToolName = (typeof NATIVE_FILE_TOOL_NAMES)[number]

export function getNativeFileToolDefinitions(): NativeToolDefinition[] {
  return [
    {
      name: 'read_file',
      description:
        'Lee el contenido completo de un archivo dado su path absoluto. Devuelve el texto del archivo.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Ruta absoluta del archivo a leer.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description:
        'Escribe contenido en un archivo. Si el archivo ya existe, lo sobreescribe. Si no existe, lo crea (incluidos los directorios padre necesarios).',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Ruta absoluta del archivo a escribir.',
          },
          content: {
            type: 'string',
            description: 'Contenido completo a escribir en el archivo.',
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'edit_file',
      description:
        'Edita un archivo existente reemplazando una sección de texto (old_text) por otra (new_text). Útil para hacer cambios quirúrgicos sin reescribir todo el archivo.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Ruta absoluta del archivo a editar.',
          },
          old_text: {
            type: 'string',
            description: 'Texto existente a reemplazar (debe coincidir exactamente).',
          },
          new_text: {
            type: 'string',
            description: 'Texto de reemplazo.',
          },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
    {
      name: 'delete_file',
      description:
        'Elimina un archivo o carpeta enviándolo a la papelera de reciclaje.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Ruta absoluta del archivo o carpeta a eliminar.',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'list_directory',
      description:
        'Lista el contenido de un directorio (archivos y subdirectorios de primer nivel). Devuelve nombre, tipo (file/directory) y ruta.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Ruta absoluta del directorio a listar.',
          },
        },
        required: ['path'],
      },
    },
  ]
}

export function isNativeFileTool(name: string): name is NativeFileToolName {
  return (NATIVE_FILE_TOOL_NAMES as readonly string[]).includes(name)
}

export async function executeNativeFileTool(
  name: NativeFileToolName,
  args: Record<string, unknown>,
): Promise<string> {
  if (typeof window === 'undefined' || !window.fs) {
    throw new Error('Las herramientas nativas de archivo requieren Electron (window.fs no disponible).')
  }

  switch (name) {
    case 'read_file': {
      const filePath = String(args.path ?? '')
      if (!filePath) throw new Error('read_file requiere "path".')
      const result = await window.fs.readFile(filePath)
      if (!result || !result.success) throw new Error(result?.error ?? 'Error leyendo archivo.')
      let content = result.content
      if (typeof content !== 'string') {
        content = content ? String(content) : ''
      }
      return content
    }

    case 'write_file': {
      const filePath = String(args.path ?? '')
      const content = String(args.content ?? '')
      if (!filePath) throw new Error('write_file requiere "path".')

      // Ensure parent directories exist
      const sep = filePath.includes('/') ? '/' : '\\'
      const parentDir = filePath.substring(0, filePath.lastIndexOf(sep))
      if (parentDir) {
        await window.fs.mkdir(parentDir)
      }

      const result = await window.fs.writeFile(filePath, content)
      if (!result.success) throw new Error(result.error ?? 'Error escribiendo archivo.')
      return `Archivo escrito exitosamente: ${filePath}`
    }

    case 'edit_file': {
      const filePath = String(args.path ?? '')
      const oldText = String(args.old_text ?? '')
      const newText = String(args.new_text ?? '')
      if (!filePath) throw new Error('edit_file requiere "path".')
      if (!oldText) throw new Error('edit_file requiere "old_text".')

      const readResult = await window.fs.readFile(filePath)
      if (!readResult.success) throw new Error(readResult.error ?? 'Error leyendo archivo para edición.')

      const currentContent = readResult.content ?? ''
      if (!currentContent.includes(oldText)) {
        throw new Error('El texto a reemplazar (old_text) no se encontró en el archivo.')
      }

      const updatedContent = currentContent.replace(oldText, newText)
      const writeResult = await window.fs.writeFile(filePath, updatedContent)
      if (!writeResult.success) throw new Error(writeResult.error ?? 'Error escribiendo archivo editado.')
      return `Archivo editado exitosamente: ${filePath}`
    }

    case 'delete_file': {
      const filePath = String(args.path ?? '')
      if (!filePath) throw new Error('delete_file requiere "path".')
      const result = await window.fs.deleteFile(filePath)
      if (!result.success) throw new Error(result.error ?? 'Error eliminando archivo.')
      return `Archivo eliminado exitosamente: ${filePath}`
    }

    case 'list_directory': {
      const dirPath = String(args.path ?? '')
      if (!dirPath) throw new Error('list_directory requiere "path".')
      const result = await window.fs.readDirLevel(dirPath)
      if (result.error) throw new Error(result.error)
      const lines = result.nodes.map(
        (node) => `[${node.type === 'directory' ? 'DIR' : 'FILE'}] ${node.name}`,
      )
      return lines.length > 0 ? lines.join('\n') : '(directorio vacío)'
    }

    default:
      throw new Error(`Herramienta de archivo desconocida: ${name}`)
  }
}
