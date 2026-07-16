import { useEffect, useRef } from 'react'
import { useCronStore } from '../stores/cron.store'
import { useAgentStore } from '../stores/agent.store'
import { useEventBus } from '../stores/event-bus.store'
import { useAgent } from './useAgent'

export function useCronEngine() {
  const { executeTask } = useAgent()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    intervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return
      const pending = useCronStore.getState().getPendingJobs()
      for (const job of pending) {
        console.debug(`[cron] Executing job: ${job.name} (${job.id.slice(0, 8)})`)
        useEventBus.getState().dispatch({
          type: 'agent:started',
          agentId: 'cron',
          agentType: 'automation',
          timestamp: Date.now(),
        })

        const agents = useAgentStore.getState().agents
        const targetAgent = agents.find((a) => a.type === 'automation') ?? agents[0]
        if (targetAgent) {
          executeTask(targetAgent.id, job.agentTaskTemplate).catch((err) => {
            console.error(`[cron] Job "${job.name}" failed:`, err)
          })
        }

        useCronStore.getState().markRun(job.id)
      }
    }, 60000)

    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [executeTask])
}
