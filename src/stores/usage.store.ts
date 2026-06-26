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

      recordTurn: (sessionId, providerId, input, output) => {
        set((s) => {
          const session = s.bySession[sessionId] ?? { input: 0, output: 0, byProvider: {} }
          const provUsage = session.byProvider[providerId] ?? { input: 0, output: 0 }
          const providerOverall = s.byProvider[providerId] ?? { input: 0, output: 0 }
          return {
            totalInput: s.totalInput + input,
            totalOutput: s.totalOutput + output,
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

      getCurrentTurnTokens: () => ({ input: 0, output: 0 }),

      setCurrentTurnTokens: () => {},
    }),
    {
      name: 'sparta-usage',
      version: 1,
      migrate: (persisted) => persisted,
      partialize: (state) => ({
        totalInput: state.totalInput,
        totalOutput: state.totalOutput,
        bySession: state.bySession,
        byProvider: state.byProvider,
      }),
    }
  )
)
