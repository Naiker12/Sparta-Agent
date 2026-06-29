import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProviderUsage {
  input: number
  output: number
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

  recordTurn: (sessionId: string, providerId: string, input: number, output: number) => void
  getSessionUsage: (sessionId: string) => SessionUsage
  getTotalUsage: () => { input: number; output: number }
  getByProvider: () => Record<string, ProviderUsage>
  getCurrentTurnTokens: () => { input: number; output: number }
  setCurrentTurnTokens: (input: number, output: number) => void
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

      recordTurn: (sessionId, providerId, input, output) => {
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
                  },
                },
              },
            },
            byProvider: {
              ...s.byProvider,
              [providerId]: {
                input: providerOverall.input + input,
                output: providerOverall.output + output,
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
    }),
    {
      name: 'sparta-usage',
      version: 2,
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
      }),
    }
  )
)
