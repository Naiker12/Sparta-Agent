/// <reference types="vite/client" />

interface SpartaImportMetaEnv {
  VITE_SIDECAR_HOST?: string
  VITE_SIDECAR_WS_PORT?: string
  VITE_SPARTA_WS_TOKEN?: string
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test'
  }
}