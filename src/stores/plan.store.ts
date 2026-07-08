import { create } from 'zustand'

interface PlanState {
  steps: string[]
  currentStep: number
  complete: boolean
  active: boolean
  setPlan: (steps: string[], currentStep: number, complete: boolean) => void
  updateStep: (currentStep: number, complete: boolean) => void
  clear: () => void
}

export const usePlanStore = create<PlanState>((set) => ({
  steps: [],
  currentStep: 0,
  complete: false,
  active: false,

  setPlan: (steps, currentStep, complete) =>
    set({ steps, currentStep, complete, active: true }),

  updateStep: (currentStep, complete) =>
    set({ currentStep, complete }),

  clear: () =>
    set({ steps: [], currentStep: 0, complete: false, active: false }),
}))
