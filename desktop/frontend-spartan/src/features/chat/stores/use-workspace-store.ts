import { create } from "zustand";

export type WorkspaceTab =
  | "files"
  | "changes"
  | "github"
  | "agents"
  | "browser";

export type GitFileStatus = "modified" | "added" | "deleted" | "untracked";

export interface WorkspaceChangedFile {
  path: string;
  filename: string;
  status: GitFileStatus;
  additions: number;
  deletions: number;
  diff?: string;
  oldPath?: string;
}

export interface WorkspaceCapabilities {
  hasGit: boolean;
  hasGithub: boolean;
  hasAgents: boolean;
  hasBrowser: boolean;
}

interface WorkspaceState {
  isOpen: boolean;
  activeTab: WorkspaceTab;
  searchQuery: string;
  selectedFilePath: string | null;
  selectedDiffFile: WorkspaceChangedFile | null;

  // Browser state
  browserUrl: string;
  browserTitle: string;
  browserHistory: string[];
  browserHistoryIndex: number;
  browserReloadKey: number;

  // Git changes
  changedFiles: WorkspaceChangedFile[];

  // Dynamic capabilities
  capabilities: WorkspaceCapabilities;

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setActiveTab: (tab: WorkspaceTab) => void;
  openTab: (tab: WorkspaceTab) => void;
  setSearchQuery: (query: string) => void;
  setSelectedFilePath: (path: string | null) => void;
  setSelectedDiffFile: (file: WorkspaceChangedFile | null) => void;
  setChangedFiles: (files: WorkspaceChangedFile[]) => void;
  setCapabilities: (caps: Partial<WorkspaceCapabilities>) => void;

  // Browser actions
  setBrowserUrl: (url: string) => void;
  navigateBrowser: (url: string, title?: string) => void;
  browserGoBack: () => void;
  browserGoForward: () => void;
  browserReload: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // Keep the conversation as the primary canvas. The workspace opens only when
  // the user chooses a rail item, rather than permanently consuming the right side.
  isOpen: false,
  activeTab: "files",
  searchQuery: "",
  selectedFilePath: null,
  selectedDiffFile: null,

  browserUrl: "http://localhost:4200",
  browserTitle: "MiSitio",
  browserHistory: ["http://localhost:4200"],
  browserHistoryIndex: 0,
  browserReloadKey: 0,

  changedFiles: [],

  capabilities: {
    hasGit: false,
    hasGithub: false,
    hasAgents: false,
    hasBrowser: false,
  },

  setOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  setActiveTab: (activeTab) =>
    set({
      activeTab,
      isOpen: true,
    }),

  openTab: (tab) =>
    set({
      activeTab: tab,
      isOpen: true,
    }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setSelectedFilePath: (selectedFilePath) => set({ selectedFilePath }),

  setSelectedDiffFile: (selectedDiffFile) => set({ selectedDiffFile }),

  setChangedFiles: (changedFiles) => set({ changedFiles }),

  setCapabilities: (caps) =>
    set((state) => {
      const nextCapabilities = { ...state.capabilities, ...caps };
      // Fallback if current tab becomes unavailable
      const tabAvailable =
        state.activeTab === "files" ||
        (state.activeTab === "changes" && nextCapabilities.hasGit) ||
        (state.activeTab === "github" && nextCapabilities.hasGithub) ||
        (state.activeTab === "agents" && nextCapabilities.hasAgents) ||
        (state.activeTab === "browser" && nextCapabilities.hasBrowser);

      return {
        capabilities: nextCapabilities,
        activeTab: tabAvailable ? state.activeTab : "files",
      };
    }),

  setBrowserUrl: (browserUrl) => set({ browserUrl }),

  navigateBrowser: (url, title) => {
    const { browserHistory, browserHistoryIndex } = get();
    const newHistory = browserHistory.slice(0, browserHistoryIndex + 1);
    newHistory.push(url);
    set({
      browserUrl: url,
      browserTitle: title || url,
      browserHistory: newHistory,
      browserHistoryIndex: newHistory.length - 1,
      isOpen: true,
      activeTab: "browser",
    });
  },

  browserGoBack: () => {
    const { browserHistory, browserHistoryIndex } = get();
    if (browserHistoryIndex > 0) {
      const nextIdx = browserHistoryIndex - 1;
      set({
        browserHistoryIndex: nextIdx,
        browserUrl: browserHistory[nextIdx],
      });
    }
  },

  browserGoForward: () => {
    const { browserHistory, browserHistoryIndex } = get();
    if (browserHistoryIndex < browserHistory.length - 1) {
      const nextIdx = browserHistoryIndex + 1;
      set({
        browserHistoryIndex: nextIdx,
        browserUrl: browserHistory[nextIdx],
      });
    }
  },

  browserReload: () => {
    set((state) => ({ browserReloadKey: state.browserReloadKey + 1 }));
  },
}));
