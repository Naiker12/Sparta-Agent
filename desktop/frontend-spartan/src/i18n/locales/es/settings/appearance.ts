export const appearance = {
  "title": "Apariencia",
  "description": "Cómo se ve Spartan en este dispositivo.",
  "theme": {
    "title": "Tema",
    "label": "Esquema de color",
    "description": "Claro, oscuro o según tu sistema.",
    "system": "Sistema",
    "light": "Claro",
    "dark": "Oscuro"
  },
  "palette": {
    "label": "Paleta de colores",
    "description": "Colores usados en Spartan, en modo claro y oscuro.",
    "standard": "Estándar",
    "classic": "Clásica",
    "minimal": "Minimalista"
  },
  "custom": {
    "reset": "Restablecer",
    "resetAll": "Restablecer la personalización",
    "preferencesTitle": "Preferencias",
    "colors": {
      "lightGroup": "Tema claro",
      "darkGroup": "Tema oscuro",
      "accent": "Acento",
      "background": "Fondo",
      "foreground": "Primer plano"
    },
    "fontDefault": "Predeterminada",
    "fontBundledGroup": "Integradas",
    "fontImportedGroup": "Importadas",
    "fontDeviceGroup": "En este dispositivo",
    "fontFolderGroup": "Desde una carpeta",
    "fontDeviceLoading": "Buscando las fuentes del dispositivo…",
    "fontSearch": "Buscar fuentes…",
    "fontNoResults": "No se encontraron fuentes.",
    "colorPicker": {
      "hue": "Tono",
      "hex": "Color hexadecimal",
      "eyedropper": "Seleccionar un color de la pantalla"
    },
    "uiFont": {
      "label": "Fuente de la interfaz"
    },
    "headingFont": {
      "label": "Fuente de los títulos"
    },
    "chatFont": {
      "label": "Fuente del chat"
    },
    "codeFont": {
      "label": "Fuente del código"
    },
    "importFont": {
      "upload": "Subir",
      "scanFolder": "Seleccionar carpeta",
      "alreadyAvailable": "Esta fuente ya está disponible, así que se usa la copia existente.",
      "folderNoFonts": "No se encontraron archivos de fuente en esa carpeta.",
      "remove": "Quitar",
      "errorInvalidType": "Tipo de archivo no admitido. Usa .woff2, .woff, .ttf o .otf.",
      "errorTooLarge": "El archivo de fuente es demasiado grande (máx. 1,5 MB).",
      "errorLimit": "Puedes importar hasta 3 fuentes.",
      "errorStorageFull": "No hay suficiente almacenamiento local para esta fuente. Quita antes una fuente importada.",
      "errorFailed": "No se pudo cargar este archivo de fuente."
    },
    "uiFontSize": {
      "label": "Tamaño de fuente de la interfaz",
      "description": "Ajusta el tamaño base usado en la interfaz de Spartan."
    },
    "codeFontSize": {
      "label": "Tamaño de fuente del código",
      "description": "Ajusta el tamaño base usado para el código."
    },
    "fontSmoothing": {
      "label": "Suavizado de fuentes",
      "description": "Usa antialiasing para suavizar el texto."
    },
    "contrast": {
      "label": "Contraste",
      "description": "Intensidad de los bordes y del texto secundario."
    },
    "reduceMotion": {
      "label": "Reducir el movimiento",
      "description": "Reduce las animaciones o sigue la configuración del sistema.",
      "system": "Sistema",
      "on": "Activado",
      "off": "Desactivado"
    },
    "pointerCursors": {
      "label": "Usar cursores de puntero",
      "description": "Cambia el cursor a un puntero al pasar por encima de elementos interactivos."
    }
  },
  "language": {
    "title": "Idioma",
    "label": "Idioma de la interfaz",
    "description": "El idioma que usa Spartan.",
    "autoDetect": "Detección automática"
  },
  "layout": {
    "title": "Diseño",
    "compactSidebar": "Fijar la barra lateral por defecto",
    "compactSidebarDescription": "Mantén la barra lateral expandida en lugar de contraerla a iconos."
  },
  "sidebarNav": {
    "title": "Navegación de la barra lateral",
    "description": "Fija y reordena las pestañas de la barra lateral. Las pestañas sin fijar se agrupan en el menú «Más»; si solo queda una pestaña sin fijar, se oculta en lugar de crear un menú de un único elemento. «Nuevo chat» queda fijo.",
    "dragToReorder": "Arrastra para reordenar",
    "pinToSidebar": "Fijar {name} en la barra lateral",
    "moreHolds": "Más ({count})"
  },
  "sidebarMenu": {
    "title": "Menú de la barra lateral",
    "description": "Muestra, oculta y reordena los elementos del menú de perfil de la barra lateral. Configuración, Ayuda, Cerrar sesión y Apagar quedan fijos.",
    "darkModeToggle": "Modo oscuro",
    "dragToReorder": "Arrastra para reordenar"
  }
} as const;
