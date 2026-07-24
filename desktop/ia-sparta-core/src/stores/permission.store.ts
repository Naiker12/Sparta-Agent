import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  QueuedMessagePolicy,
  SecurityPreset,
  ArtifactReviewPolicy,
  PermissionActionKind,
  PermissionRule,
} from '../types/permission.types'

export type PermissionKind = 'file_access' | 'mcp_install' | 'terminal_exec'

export interface PermissionRequest {
  requestId: string
  tool: string
  path: string
  preview: string
  kind: PermissionKind
  /** Timestamp when the request arrived — used to expire stale entries */
  arrivedAt: number
}

interface PermissionState {
  /** Queue of pending permission requests — shown one at a time */
  queue: PermissionRequest[]

  /** Agent Execution Settings */
  queuedMessages: QueuedMessagePolicy
  securityPreset: SecurityPreset
  artifactReviewPolicy: ArtifactReviewPolicy

  /** Access Control Rules */
  fileReads: PermissionRule[]
  fileWrites: PermissionRule[]
  networkRules: PermissionRule[]
  terminalRules: PermissionRule[]
  unsandboxedRules: PermissionRule[]
  mcpRules: PermissionRule[]

  enqueue: (req: PermissionRequest) => void
  dequeue: (requestId: string) => void
  clearAll: () => void

  setQueuedMessages: (policy: QueuedMessagePolicy) => void
  setSecurityPreset: (preset: SecurityPreset) => void
  setArtifactReviewPolicy: (policy: ArtifactReviewPolicy) => void

  addRule: (rule: Omit<PermissionRule, 'id' | 'createdAt'>) => void
  removeRule: (ruleId: string) => void
  clearRules: (kind?: PermissionActionKind) => void
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set) => ({
      queue: [],

      queuedMessages: 'queue_after_turn',
      securityPreset: 'default',
      artifactReviewPolicy: 'always_ask',

      fileReads: [],
      fileWrites: [],
      networkRules: [],
      terminalRules: [],
      unsandboxedRules: [],
      mcpRules: [],

      enqueue: (req) =>
        set((s) => ({
          queue: s.queue.some((r) => r.requestId === req.requestId)
            ? s.queue
            : [...s.queue, req],
        })),

      dequeue: (requestId) =>
        set((s) => ({ queue: s.queue.filter((r) => r.requestId !== requestId) })),

      clearAll: () => set({ queue: [] }),

      setQueuedMessages: (policy) => set({ queuedMessages: policy }),
      setSecurityPreset: (preset) => set({ securityPreset: preset }),
      setArtifactReviewPolicy: (policy) => set({ artifactReviewPolicy: policy }),

      addRule: (ruleInput) => {
        const newRule: PermissionRule = {
          ...ruleInput,
          id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
        }

        set((s) => {
          const keyMap: Record<PermissionActionKind, keyof PermissionState> = {
            file_read: 'fileReads',
            file_write: 'fileWrites',
            network_url: 'networkRules',
            terminal_command: 'terminalRules',
            unsandboxed_command: 'unsandboxedRules',
            mcp_tool: 'mcpRules',
          }

          const targetKey = keyMap[ruleInput.kind]
          const existingList = (s[targetKey] as PermissionRule[]) || []

          return {
            ...s,
            securityPreset: 'custom',
            [targetKey]: [...existingList.filter((r) => r.target !== ruleInput.target), newRule],
          }
        })
      },

      removeRule: (ruleId) => {
        set((s) => ({
          fileReads: s.fileReads.filter((r) => r.id !== ruleId),
          fileWrites: s.fileWrites.filter((r) => r.id !== ruleId),
          networkRules: s.networkRules.filter((r) => r.id !== ruleId),
          terminalRules: s.terminalRules.filter((r) => r.id !== ruleId),
          unsandboxedRules: s.unsandboxedRules.filter((r) => r.id !== ruleId),
          mcpRules: s.mcpRules.filter((r) => r.id !== ruleId),
        }))
      },

      clearRules: (kind) => {
        if (!kind) {
          set({
            fileReads: [],
            fileWrites: [],
            networkRules: [],
            terminalRules: [],
            unsandboxedRules: [],
            mcpRules: [],
            securityPreset: 'default',
          })
          return
        }

        const keyMap: Record<PermissionActionKind, keyof PermissionState> = {
          file_read: 'fileReads',
          file_write: 'fileWrites',
          network_url: 'networkRules',
          terminal_command: 'terminalRules',
          unsandboxed_command: 'unsandboxedRules',
          mcp_tool: 'mcpRules',
        }

        set({ [keyMap[kind]]: [] } as Partial<PermissionState>)
      },
    }),
    {
      name: 'sparta-permissions-store',
      partialize: (state) => ({
        queuedMessages: state.queuedMessages,
        securityPreset: state.securityPreset,
        artifactReviewPolicy: state.artifactReviewPolicy,
        fileReads: state.fileReads,
        fileWrites: state.fileWrites,
        networkRules: state.networkRules,
        terminalRules: state.terminalRules,
        unsandboxedRules: state.unsandboxedRules,
        mcpRules: state.mcpRules,
      }),
    }
  )
)
