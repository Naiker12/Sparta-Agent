export const shell = {
  "beta": "BETA",
  "brand": "spartan agent",
  "product": "Spartan Agent",
  "accountMenu": "Menú de cuenta de {name}",
  "updateAvailable": "Actualización disponible",
  "resize": {
    "collapse": "Haz clic para contraer",
    "expand": "Haz clic para expandir",
    "drag": "Arrastra para redimensionar"
  },
  "aria": {
    "home": "Inicio de Spartan",
    "closeSidebar": "Cerrar barra lateral",
    "openSidebar": "Abrir barra lateral",
    "resizeSidebar": "Redimensionar o contraer la barra lateral",
    "resizeRunSettings": "Redimensionar o cerrar los ajustes de ejecución",
    "openRunSettings": "Abrir los ajustes de ejecución",
    "chatOptions": "Opciones de chat",
    "runOptions": "Opciones de ejecución"
  },
  "navigation": {
    "newChat": "Nuevo chat",
    "returnToChat": "Volver al chat",
    "returnToChats": "Volver a {count} chats",
    "chatGenerating": "Generando",
    "compare": "Comparar",
    "search": "Buscar",
    "hub": "Centro de modelos",
    "projects": "Proyectos",
    "train": "Entrenar",
    "recipes": "Recetas",
    "images": "Imágenes",
    "channels": "Canales",
    "comingSoon": "Próximo",
    "channelsComingSoon": "Canales estará disponible próximamente.",
    "video": "Vídeo",
    "audio": "Audio",
    "trainChecking": "Comprobando si este equipo admite entrenamiento...",
    "videoChecking": "Comprobando si este equipo admite vídeo...",
    "more": "Más",
    "customizeSidebar": "Personalizar la barra lateral",
    "newBadge": "Nuevo",
    "export": "Exportar",
    "recents": "Recientes",
    "noChatsYet": "Aún no hay chats",
    "showMore": "Mostrar más",
    "showLess": "Mostrar menos",
    "settings": "Configuración",
    "api": "API",
    "lightMode": "Modo claro",
    "darkMode": "Modo oscuro",
    "guidedTour": "Recorrido guiado",
    "help": "Ayuda",
    "logOut": "Cerrar sesión",
    "shutdown": "Apagar"
  },
  "notFound": {
    "title": "Página no encontrada",
    "description": "{path} no existe.",
    "backToChat": "Volver al chat"
  },
  "selection": {
    "pinProjects": "Fijar proyectos",
    "unpinProjects": "Dejar de fijar proyectos",
    "deleteProjects": "Eliminar proyectos",
    "deleteProjectsTitle": "Eliminar proyectos",
    "deleteProjectsDescription": "¿Eliminar {count} proyectos? Sus chats se eliminan de forma permanente.",
    "deleteProjectsFilesDescription": "La carpeta del espacio de trabajo de cada proyecto se elimina del disco.",
    "countSelected": "{count} seleccionados",
    "pinChats": "Fijar chats",
    "unpinChats": "Dejar de fijar chats",
    "archiveChats": "Archivar chats",
    "markUnread": "Marcar como no leído",
    "deleteChats": "Eliminar chats",
    "deleteTitle": "Eliminar chats",
    "deleteDescription": "¿Eliminar {count} chats? Esta acción no se puede deshacer.",
    "deleteFilesDescription": "Se elimina del disco la carpeta de entorno aislado de cada chat. Los archivos que hayan escrito dentro de un proyecto permanecen en el espacio de trabajo de ese proyecto.",
    "deleteFilesLabel": "Eliminar archivos y carpeta de espacio aislado",
    "deleteChatFilesDescription": "La carpeta de espacio aislado propia de este chat se elimina del disco. Los archivos que escribió dentro de un proyecto permanecen en el espacio de trabajo de ese proyecto."
  },
  "organize": {
    "sidebarHeading": "Organizar la barra lateral",
    "byProject": "Por proyecto",
    "inOneList": "En una sola lista",
    "sortChatsBy": "Ordenar chats por",
    "sortPinnedBy": "Ordenar fijados por",
    "priority": "Prioridad",
    "lastUpdated": "Última actualización",
    "manualOrder": "Orden manual",
    "moveUp": "Subir",
    "moveDown": "Bajar",
    "organizeChats": "Organizar chats",
    "organizeProjects": "Organizar proyectos",
    "sortPinnedChats": "Ordenar chats fijados"
  },
  "dialog": {
    "project": {
      "deleteTitle": "Eliminar proyecto",
      "deleteDescription": "¿Eliminar el proyecto \"{name}\"? Sus chats se eliminarán de forma permanente.",
      "deleteWorkspaceDescription": "La carpeta del espacio de trabajo del proyecto se eliminará del disco.",
      "deleteAll": "Eliminar todo",
      "renameTitle": "Renombrar proyecto",
      "namePlaceholder": "Nombre del proyecto",
      "createTitle": "Crear proyecto",
      "moveToNewTitle": "Mover a un proyecto nuevo",
      "createAndMove": "Crear y mover"
    },
    "deleteChat": {
      "title": "Eliminar chat",
      "description": "¿Seguro que quieres eliminar este chat \"{name}\"?"
    },
    "deleteRun": {
      "title": "Eliminar ejecución de entrenamiento",
      "description": "¿Seguro que quieres eliminar esta ejecución \"{name}\"?"
    },
    "renameChat": {
      "title": "Renombrar chat",
      "placeholder": "Título del chat"
    },
    "renameRun": {
      "title": "Renombrar ejecución",
      "placeholder": "Nombre de la ejecución"
    }
  },
  "toast": {
    "archivedChats": "Puedes ver los chats archivados en Configuración",
    "failedToArchiveChat": "No se pudo archivar el chat",
    "failedToRenameProject": "No se pudo renombrar el proyecto",
    "failedToDeleteProject": "No se pudo eliminar el proyecto",
    "failedToMoveChat": "No se pudo mover el chat",
    "failedToMoveChatToNewProject": "No se pudo mover el chat al proyecto nuevo",
    "cannotDeleteRunningRun": "No se puede eliminar una ejecución de entrenamiento en curso",
    "failedToDeleteChat": "No se pudo eliminar el chat",
    "failedToDeleteRun": "No se pudo eliminar la ejecución",
    "failedToRenameChat": "No se pudo renombrar el chat",
    "failedToRenameRun": "No se pudo renombrar la ejecución"
  }
} as const;
