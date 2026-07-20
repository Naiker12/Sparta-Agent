import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProviderUsage {
  input: number
  output: number
  /** Last known human label, retained when a provider is renamed or deleted. */
  label?: string
}

interface SessionUsage {
  input: number
  output: number
  byProvider: Record<string, ProviderUsage>
}

interface UsageState {
  totalInput: number
  totalOutput: number
  bySession: Record<string, SessionUsage>
  byProvider: Record<string, ProviderUsage>
  currentTurnInput: number
  currentTurnOutput: number

  recordTurn: (sessionId: string, providerId: string, input: number, output: number, providerLabel?: string) => void
  getSessionUsage: (sessionId: string) => SessionUsage
  getTotalUsage: () => { input: number; output: number }
  getByProvider: () => Record<string, ProviderUsage>
  getCurrentTurnTokens: () => { input: number; output: number }
  setCurrentTurnTokens: (input: number, output: number) => void
  removeProviderUsage: (providerId: string) => void
  pruneProviderUsage: (activeProviderIds: string[]) => void
}

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      totalInput: 0,
      totalOutput: 0,
      bySession: {},
      byProvider: {},
      currentTurnInput: 0,
      currentTurnOutput: 0,

      recordTurn: (sessionId, providerId, input, output, providerLabel) => {
        set((s) => {
          const session = s.bySession[sessionId] ?? { input: 0, output: 0, byProvider: {} }
          const provUsage = session.byProvider[providerId] ?? { input: 0, output: 0 }
          const providerOverall = s.byProvider[providerId] ?? { input: 0, output: 0 }
          return {
            totalInput: s.totalInput + input,
            totalOutput: s.totalOutput + output,
            currentTurnInput: 0,
            currentTurnOutput: 0,
            bySession: {
              ...s.bySession,
              [sessionId]: {
                input: session.input + input,
                output: session.output + output,
                byProvider: {
                  ...session.byProvider,
                  [providerId]: {
                    input: provUsage.input + input,
                    output: provUsage.output + output,
                    label: providerLabel ?? provUsage.label,
                  },
                },
              },
            },
            byProvider: {
              ...s.byProvider,
              [providerId]: {
                input: providerOverall.input + input,
                output: providerOverall.output + output,
                label: providerLabel ?? providerOverall.label,
              },
            },
          }
        })
      },

      getSessionUsage: (sessionId) => {
        return get().bySession[sessionId] ?? { input: 0, output: 0, byProvider: {} }
      },

      getTotalUsage: () => ({
        input: get().totalInput,
        output: get().totalOutput,
      }),

      getByProvider: () => get().byProvider,

      getCurrentTurnTokens: () => ({
        input: get().currentTurnInput,
        output: get().currentTurnOutput,
      }),

      setCurrentTurnTokens: (input, output) => {
        set({ currentTurnInput: input, currentTurnOutput: output })
      },

      removeProviderUsage: (providerId) => set((state) => {
        const removed = state.byProvider[providerId]
        if (!removed) return state
        const { [providerId]: _removed, ...byProvider } = state.byProvider
        const bySession = Object.fromEntries(
          Object.entries(state.bySession).map(([sessionId, usage]) => {
            const sessionRemoved = usage.byProvider[providerId]
            const { [providerId]: _sessionProvider, ...sessionProviders } = usage.byProvider
            return [sessionId, {
              ...usage,
              input: usage.input - (sessionRemoved?.input ?? 0),
              output: usage.output - (sessionRemoved?.output ?? 0),
              byProvider: sessionProviders,
            }]
          }),
        )
        return {
          byProvider,
          bySession,
          totalInput: Math.max(0, state.totalInput - removed.input),
          totalOutput: Math.max(0, state.totalOutput - removed.output),
        }
      }),

      pruneProviderUsage: (activeProviderIds) => {
        const active = new Set(activeProviderIds)
        for (const providerId of Object.keys(get().byProvider)) {
          if (!active.has(providerId)) get().removeProviderUsage(providerId)
        }
      },
    }),
    {
      name: 'sparta-usage',
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) {
          const old = persisted as Record<string, unknown>
          return {
            totalInput: old.totalInput ?? 0,
            totalOutput: old.totalOutput ?? 0,
            bySession: old.bySession ?? {},
            byProvider: old.byProvider ?? {},
            currentTurnInput: 0,
            currentTurnOutput: 0,
          }
        }
        return persisted as UsageState
      },
      partialize: (state) => ({
        totalInput: state.totalInput,
        totalOutput: state.totalOutput,
        bySession: state.bySession,
        byProvider: state.byProvider,
        currentTurnInput: state.currentTurnInput,
        currentTurnOutput: state.currentTurnOutput,
      }),
    }
  )
)
