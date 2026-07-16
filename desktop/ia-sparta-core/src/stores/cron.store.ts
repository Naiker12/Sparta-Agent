import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CronFrequency = 'hourly' | 'daily' | 'weekly' | 'every_n_hours'

export interface CronJob {
  id: string
  name: string
  frequency: CronFrequency
  intervalHours?: number
  hour?: number
  dayOfWeek?: number
  agentTaskTemplate: string
  targetSessionId?: string
  enabled: boolean
  lastRun?: number
  nextRun: number
  createdAt: number
}

interface CronState {
  jobs: CronJob[]

  addJob: (job: Omit<CronJob, 'id' | 'createdAt' | 'nextRun'>) => string
  updateJob: (id: string, patch: Partial<CronJob>) => void
  removeJob: (id: string) => void
  toggleJob: (id: string) => void
  getPendingJobs: (now?: number) => CronJob[]
  markRun: (id: string) => void
}

function calcNextRun(job: Omit<CronJob, 'id' | 'createdAt' | 'nextRun'>): number {
  const now = Date.now()
  switch (job.frequency) {
    case 'hourly':
      return now + 3600000
    case 'every_n_hours':
      return now + (job.intervalHours ?? 1) * 3600000
    case 'daily': {
      const next = new Date(now)
      next.setHours(job.hour ?? 8, 0, 0, 0)
      if (next.getTime() <= now) next.setDate(next.getDate() + 1)
      return next.getTime()
    }
    case 'weekly': {
      const next = new Date(now)
      next.setHours(job.hour ?? 8, 0, 0, 0)
      const targetDay = job.dayOfWeek ?? 1
      while (next.getDay() !== targetDay) next.setDate(next.getDate() + 1)
      if (next.getTime() <= now) next.setDate(next.getDate() + 7)
      return next.getTime()
    }
    default:
      return now + 86400000
  }
}

export const useCronStore = create<CronState>()(
  persist(
    (set, get) => ({
      jobs: [],

      addJob: (job) => {
        const id = crypto.randomUUID()
        const entry: CronJob = {
          ...job,
          id,
          createdAt: Date.now(),
          nextRun: calcNextRun(job),
        }
        set((s) => ({ jobs: [...s.jobs, entry] }))
        return id
      },

      updateJob: (id, patch) => {
        set((s) => ({
          jobs: s.jobs.map((j) => {
            if (j.id !== id) return j
            const updated = { ...j, ...patch }
            if (patch.frequency || patch.hour !== undefined || patch.dayOfWeek !== undefined || patch.intervalHours !== undefined) {
              updated.nextRun = calcNextRun(updated)
            }
            return updated
          }),
        }))
      },

      removeJob: (id) => {
        set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }))
      },

      toggleJob: (id) => {
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === id ? { ...j, enabled: !j.enabled } : j
          ),
        }))
      },

      getPendingJobs: (now = Date.now()) => {
        return get().jobs.filter((j) => j.enabled && j.nextRun <= now)
      },

      markRun: (id) => {
        set((s) => ({
          jobs: s.jobs.map((j) => {
            if (j.id !== id) return j
            return {
              ...j,
              lastRun: Date.now(),
              nextRun: calcNextRun(j),
            }
          }),
        }))
      },
    }),
    {
      name: 'sparta-cron',
      partialize: (state) => ({
        jobs: state.jobs,
      }),
    }
  )
)
