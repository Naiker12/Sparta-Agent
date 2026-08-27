export const appearance = {
  "title": "Appearance",
  "description": "How Spartan looks on this device.",
  "theme": {
    "title": "Theme",
    "label": "Color scheme",
    "description": "Light, dark, or follow your system.",
    "system": "System",
    "light": "Light",
    "dark": "Dark"
  },
  "palette": {
    "label": "Color palette",
    "description": "Colors used across Spartan, in light and dark mode.",
    "standard": "Standard",
    "classic": "Classic",
    "minimal": "Minimal"
  },
  "custom": {
    "reset": "Reset",
    "resetAll": "Reset customization",
    "preferencesTitle": "Preferences",
    "colors": {
      "lightGroup": "Light theme",
      "darkGroup": "Dark theme",
      "accent": "Accent",
      "background": "Background",
      "foreground": "Foreground"
    },
    "fontDefault": "Default",
    "fontBundledGroup": "Built-in",
    "fontImportedGroup": "Imported",
    "fontDeviceGroup": "On this device",
    "fontFolderGroup": "From folder",
    "fontDeviceLoading": "Looking for device fonts…",
    "fontSearch": "Search fonts…",
    "fontNoResults": "No fonts found.",
    "colorPicker": {
      "hue": "Hue",
      "hex": "Hex color",
      "eyedropper": "Pick a color from the screen"
    },
    "uiFont": {
      "label": "UI font"
    },
    "headingFont": {
      "label": "Heading font"
    },
    "chatFont": {
      "label": "Chat font"
    },
    "codeFont": {
      "label": "Code font"
    },
    "importFont": {
      "upload": "Upload",
      "scanFolder": "Select folder",
      "alreadyAvailable": "This font is already available, so the existing copy is used.",
      "folderNoFonts": "No font files found in that folder.",
      "remove": "Remove",
      "errorInvalidType": "Unsupported file type. Use .woff2, .woff, .ttf, or .otf.",
      "errorTooLarge": "Font file is too large (max 1.5 MB).",
      "errorLimit": "You can import up to 3 fonts.",
      "errorStorageFull": "Not enough local storage for this font. Remove an imported font first.",
      "errorFailed": "Could not load this font file."
    },
    "uiFontSize": {
      "label": "UI font size",
      "description": "Adjust the base size used for the Spartan UI."
    },
    "codeFontSize": {
      "label": "Code font size",
      "description": "Adjust the base size used for code."
    },
    "fontSmoothing": {
      "label": "Font smoothing",
      "description": "Use smoothed font anti-aliasing."
    },
    "contrast": {
      "label": "Contrast",
      "description": "Strength of borders and secondary text."
    },
    "reduceMotion": {
      "label": "Reduce motion",
      "description": "Reduce animations or match your system.",
      "system": "System",
      "on": "On",
      "off": "Off"
    },
    "pointerCursors": {
      "label": "Use pointer cursors",
      "description": "Change the cursor to a pointer when hovering over interactive elements."
    }
  },
  "language": {
    "title": "Language",
    "label": "Display language",
    "description": "The language used by Spartan.",
    "autoDetect": "Auto detect"
  },
  "layout": {
    "title": "Layout",
    "compactSidebar": "Pin sidebar by default",
    "compactSidebarDescription": "Keep the sidebar expanded instead of collapsing to icons."
  },
  "sidebarNav": {
    "title": "Sidebar navigation",
    "description": "Pin and reorder the sidebar tabs. Unpinned tabs collect in the More menu; a single unpinned tab is hidden instead of getting a menu of one. New chat stays fixed.",
    "dragToReorder": "Drag to reorder",
    "pinToSidebar": "Pin {name} to the sidebar",
    "moreHolds": "More ({count})"
  },
  "sidebarMenu": {
    "title": "Profile menu",
    "description": "Choose which shortcuts appear when you click your name at the bottom of the sidebar, and in what order. Settings, Help, Log out, and Shutdown always appear.",
    "darkModeToggle": "Dark mode toggle",
    "dragToReorder": "Drag to reorder"
  }
} as const;
