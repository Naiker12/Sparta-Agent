import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ModelPerformance {
  samples: number
  averageLatencyMs: number
}

interface ModelPerformanceState {
  byModel: Record<string, ModelPerformance>
  recordLatency: (model: string, latencyMs: number) => void
}

export const useModelPerformanceStore = create<ModelPerformanceState>()(
  persist(
    (set) => ({
      byModel: {},
      recordLatency: (model, latencyMs) => {
        if (!model || !Number.isFinite(latencyMs) || latencyMs < 0) return
        set((state) => {
          const previous = state.byModel[model]
          const samples = (previous?.samples ?? 0) + 1
          const averageLatencyMs = Math.round(((previous?.averageLatencyMs ?? 0) * (samples - 1) + latencyMs) / samples)
          return { byModel: { ...state.byModel, [model]: { samples, averageLatencyMs } } }
        })
      },
    }),
    { name: 'sparta-model-performance' },
  ),
)
