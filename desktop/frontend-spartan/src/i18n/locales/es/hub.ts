export const hub = {
  title: "Centro de modelos",
  datasetsTitle: "Conjuntos de datos",
  modelsSubtitle:
    "Descubre, descarga y ejecuta modelos de inferencia localmente.",
  datasetsSubtitle:
    "Descubre, descarga y entrena con conjuntos de datos localmente.",
  discover: "Explorar",
  onDevice: "En el dispositivo",
  searchModels: "Buscar todos los modelos",
  searchDatasets: "Buscar conjuntos de datos",
  searchDeviceModels: "Buscar modelos en el dispositivo",
  searchDeviceDatasets: "Buscar conjuntos de datos en el dispositivo",
  clearSearch: "Limpiar búsqueda",
  addFolder: "Añadir carpeta",
  manageFolders: "Administrar carpetas de modelos locales",
  freeSpace: "Liberar espacio",
  freeSpaceHint:
    "Elimina recursos compartidos que ningún modelo instalado necesita",
  formatFilter: "Filtro de formato",
  capabilityFilter: "Filtro de capacidad",
  sortModels: "Ordenar modelos",
  onlyFit: "Mostrar solo modelos compatibles",
  onlyFitHint:
    "Oculta modelos que superan el presupuesto de memoria del dispositivo. Los modelos descargados siguen visibles.",
  resourceType: "Tipo de recurso",
  models: "Modelos",
  datasets: "Conjuntos de datos",
  cache: "Caché",
  local: "Local",
  vram: "VRAM",
  ram: "RAM",
  cpu: "CPU",
  eject: "Expulsar",
  filters: {
    allFormats: "Todos los formatos",
    allCapabilities: "Todas las capacidades",
    reasoning: "Razonamiento",
    vision: "Visión",
    audio: "Audio",
    embeddings: "Representaciones",
    imageGeneration: "Generación de imágenes",
    newest: "Más recientes",
    trending: "Tendencia",
    mostDownloads: "Más descargas",
    recentlyUpdated: "Actualizados recientemente",
    mostLikes: "Más me gusta",
  },
  gguf: {
    status: {
      loaded: "Cargado",
      onDevice: "En el dispositivo",
      downloading: "Descargando",
      partial: "Parcial",
    },
    loadingQuantizations: "Cargando cuantizaciones disponibles…",
    noQuantizations:
      "No se encontraron cuantizaciones GGUF en este repositorio.",
    partialUnavailable:
      "Hay una descarga parcial. No se pudieron cargar las cuantizaciones.",
    reload: "Recargar",
    selectQuantization: "Seleccionar cuantización",
    update: "Actualizar",
    cancelling: "Cancelando…",
    starting: "Iniciando…",
    loading: "Cargando…",
    run: "Ejecutar",
    retryRefresh: "No se pudieron actualizar las cuantizaciones. Reintentar",
    downloadRunningSelect:
      "La descarga está en curso. Selecciónala para ver el progreso.",
    partialSelect:
      "Descarga parcial. Selecciónala y usa el botón de la tarjeta para terminarla.",
    downloadRunningStop:
      "La descarga está en curso. Usa el botón de la derecha para detenerla.",
    deleted: "Se eliminó {model}",
    failedToDelete: "No se pudo eliminar",
    deleteTitle: "¿Eliminar cuantización?",
    fit: {
      fits: {
        label: "Descarga completa en GPU",
        tooltip:
          "Es probable que el modelo pueda cargarse por completo en la GPU.",
      },
      marginal: {
        label: "Podría caber",
        tooltip:
          "Queda menos de 1 GB de margen en VRAM; puede fallar si otras aplicaciones usan la GPU.",
      },
      partial: {
        label: "Descarga parcial en GPU",
        tooltip:
          "Excede la VRAM, pero cabe descargando parte en RAM. La inferencia será más lenta.",
      },
      ram: {
        label: "Alternativa en RAM",
        tooltip:
          "No se detectó VRAM. Puede ejecutarse con RAM y CPU, aunque será más lento.",
      },
      oom: {
        label: "No cabe",
        tooltip: "Excede el presupuesto combinado de VRAM y RAM del sistema.",
      },
    },
    menu: {
      unpin: "Desfijar",
      pinToTop: "Fijar arriba",
      revealInFinder: "Mostrar en Finder",
      revealInFolder: "Mostrar en la carpeta",
      copyIdentifier: "Copiar identificador",
      copyPath: "Copiar ruta",
      delete: "Eliminar",
      copiedPath: "Ruta copiada",
      copiedIdentifier: "Identificador copiado",
      failedToCopy: "No se pudo copiar",
      failedToResolvePath: "No se pudo resolver la ruta del modelo",
      failedToOpenFileManager: "No se pudo abrir el explorador de archivos",
    },
  },
} as const;
