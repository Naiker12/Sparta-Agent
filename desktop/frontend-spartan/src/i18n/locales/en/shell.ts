export const shell = {
  "beta": "BETA",
  "brand": "SPARTAN AGENT",
  "product": "Spartan Agent",
  "accountMenu": "{name} account menu",
  "updateAvailable": "Update available",
  "resize": {
    "collapse": "Click to collapse",
    "expand": "Click to expand",
    "drag": "Drag to resize"
  },
  "aria": {
    "home": "Spartan home",
    "closeSidebar": "Close sidebar",
    "openSidebar": "Open sidebar",
    "resizeSidebar": "Resize or collapse sidebar",
    "resizeRunSettings": "Resize or close run settings",
    "openRunSettings": "Open run settings",
    "chatOptions": "Chat options",
    "runOptions": "Run options"
  },
  "navigation": {
    "newChat": "New chat",
    "returnToChat": "Return to Chat",
    "returnToChats": "Return to {count} Chats",
    "chatGenerating": "Generating",
    "compare": "Compare",
    "search": "Search",
    "projects": "Projects",
    "hub": "Model hub",
    "train": "Train",
    "recipes": "Recipes",
    "images": "Images",
    "channels": "Channels",
    "comingSoon": "Coming soon",
    "channelsComingSoon": "Channels will be available soon.",
    "video": "Video",
    "audio": "Audio",
    "trainChecking": "Checking this machine for training support...",
    "videoChecking": "Checking this machine for video support...",
    "more": "More",
    "customizeSidebar": "Customize sidebar",
    "newBadge": "New",
    "export": "Export",
    "recents": "Recents",
    "noChatsYet": "No chats yet",
    "showMore": "Show more",
    "showLess": "Show less",
    "settings": "Settings",
    "api": "API",
    "lightMode": "Light Mode",
    "darkMode": "Dark Mode",
    "guidedTour": "Guided Tour",
    "help": "Help",
    "logOut": "Log out",
    "shutdown": "Shutdown"
  },
  "notFound": {
    "title": "Page not found",
    "description": "{path} does not exist.",
    "backToChat": "Back to chat"
  },
  "selection": {
    "pinProjects": "Pin projects",
    "unpinProjects": "Unpin projects",
    "deleteProjects": "Delete projects",
    "deleteProjectsTitle": "Delete projects",
    "deleteProjectsDescription": "Delete {count} projects? Their chats are permanently deleted.",
    "deleteProjectsFilesDescription": "Each project workspace folder is removed from disk.",
    "countSelected": "{count} selected",
    "pinChats": "Pin chats",
    "unpinChats": "Unpin chats",
    "archiveChats": "Archive chats",
    "markUnread": "Mark as unread",
    "deleteChats": "Delete chats",
    "deleteTitle": "Delete chats",
    "deleteDescription": "Delete {count} chats? This cannot be undone.",
    "deleteFilesDescription": "Each chat's own sandbox folder is removed from disk. Files they wrote inside a project stay in that project's workspace.",
    "deleteFilesLabel": "Delete files and sandbox folder",
    "deleteChatFilesDescription": "This chat's own sandbox folder is removed from disk. Files it wrote inside a project stay in that project's workspace."
  },
  "organize": {
    "sidebarHeading": "Organize sidebar",
    "byProject": "By project",
    "inOneList": "In one list",
    "sortChatsBy": "Sort chats by",
    "sortPinnedBy": "Sort pinned by",
    "priority": "Priority",
    "lastUpdated": "Last updated",
    "manualOrder": "Manual order",
    "moveUp": "Move up",
    "moveDown": "Move down",
    "organizeChats": "Organize chats",
    "organizeProjects": "Organize projects",
    "sortPinnedChats": "Sort pinned chats"
  },
  "dialog": {
    "project": {
      "deleteTitle": "Delete project",
      "deleteDescription": "Delete project \"{name}\"? Its chats will be permanently deleted.",
      "deleteWorkspaceDescription": "The project workspace folder will be removed from disk.",
      "deleteAll": "Delete all",
      "renameTitle": "Rename project",
      "namePlaceholder": "Project name",
      "createTitle": "Create project",
      "moveToNewTitle": "Move to new project",
      "createAndMove": "Create and move"
    },
    "deleteChat": {
      "title": "Delete chat",
      "description": "Are you sure you want to delete this chat \"{name}\"?"
    },
    "deleteRun": {
      "title": "Delete training run",
      "description": "Are you sure you want to delete this run \"{name}\"?"
    },
    "renameChat": {
      "title": "Rename chat",
      "placeholder": "Chat title"
    },
    "renameRun": {
      "title": "Rename run",
      "placeholder": "Run name"
    }
  },
  "toast": {
    "archivedChats": "You can view archived chats in Settings",
    "failedToArchiveChat": "Failed to archive chat",
    "failedToRenameProject": "Failed to rename project",
    "failedToDeleteProject": "Failed to delete project",
    "failedToMoveChat": "Failed to move chat",
    "failedToMoveChatToNewProject": "Failed to move chat to the new project",
    "cannotDeleteRunningRun": "Cannot delete a running training run",
    "failedToDeleteChat": "Failed to delete chat",
    "failedToDeleteRun": "Failed to delete run",
    "failedToRenameChat": "Failed to rename chat",
    "failedToRenameRun": "Failed to rename run"
  }
} as const;
