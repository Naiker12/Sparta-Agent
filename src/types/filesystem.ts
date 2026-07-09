export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export interface FileReadResult {
  success: boolean
  content?: string
  error?: string
}

export interface FileWriteResult {
  success: boolean
  error?: string
}

export interface FilesystemAPI {
  openFolderDialog: () => Promise<string | null>
  readDir: (dirPath: string) => Promise<FileTreeNode[]>
  readFile: (filePath: string) => Promise<FileReadResult>
  writeFile: (filePath: string, content: string) => Promise<FileWriteResult>
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
  deleteFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>
  startWatcher: (dirPath: string) => Promise<{ success: boolean }>
  stopWatcher: () => Promise<{ success: boolean }>
}
