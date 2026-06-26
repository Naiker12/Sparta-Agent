import { describe, it, expect } from 'vitest'

// Import internal functions from agent-runtime (they're not exported but we test the module logic)
import { executeTool, executeToolsParallel, areToolCallsIndependent, buildToolDefinitions } from '../tool-executor'
import { canSpawnSubagent } from '../subagent-spawner'
import { planTask } from '../task-planner'
import type { ToolCall } from '@/interfaces'

describe('tool-executor', () => {
  it('buildToolDefinitions converts MCPTool[] to OpenAI tool format', () => {
    const tools = buildToolDefinitions([
      { name: 'search', description: 'Search the web', inputSchema: { type: 'object', properties: { q: { type: 'string' } } }, serverId: 'server1' },
      { name: 'read', description: 'Read a URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } } }, serverId: 'server1' },
    ])

    expect(tools).toHaveLength(2)
    expect(tools[0]).toEqual({
      name: 'search',
      description: 'Search the web',
      input_schema: { type: 'object', properties: { q: { type: 'string' } } },
    })
    expect((tools[1] as { name: string }).name).toBe('read')
  })

  it('areToolCallsIndependent returns true for 2+ calls', () => {
    const calls: ToolCall[] = [
      { id: '1', toolName: 'search', input: { q: 'test' }, status: 'running' },
      { id: '2', toolName: 'read', input: { url: 'https://example.com' }, status: 'running' },
    ]
    expect(areToolCallsIndependent(calls)).toBe(true)
  })

  it('areToolCallsIndependent returns false for single call', () => {
    const calls: ToolCall[] = [
      { id: '1', toolName: 'search', input: { q: 'test' }, status: 'running' },
    ]
    expect(areToolCallsIndependent(calls)).toBe(false)
  })

  it('executeTool returns result with timing', async () => {
    const runner = async (_name: string, _args: unknown) => 'search result'
    const tc: ToolCall = { id: 'call-1', toolName: 'search', input: { q: 'hello' }, status: 'running' }
    const result = await executeTool(tc, runner)
    expect(result.toolName).toBe('search')
    expect(result.toolCallId).toBe('call-1')
    expect(result.output).toBe('search result')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()
  })

  it('executeTool returns error on failure', async () => {
    const runner = async () => { throw new Error('tool failed') }
    const tc: ToolCall = { id: 'call-2', toolName: 'fail', input: {}, status: 'running' }
    const result = await executeTool(tc, runner)
    expect(result.error).toBe('tool failed')
  })

  it('executeToolsParallel runs multiple tools', async () => {
    let count = 0
    const runner = async () => { count++; return `result-${count}` }
    const calls: ToolCall[] = [
      { id: '1', toolName: 'a', input: {}, status: 'running' },
      { id: '2', toolName: 'b', input: {}, status: 'running' },
    ]
    const results = await executeToolsParallel(calls, runner)
    expect(results).toHaveLength(2)
  })
})

describe('subagent-spawner', () => {
  it('canSpawnSubagent returns true for depth < MAX', () => {
    expect(canSpawnSubagent(0)).toBe(true)
    expect(canSpawnSubagent(1)).toBe(true)
  })

  it('canSpawnSubagent returns false for depth >= MAX', () => {
    expect(canSpawnSubagent(2)).toBe(false)
    expect(canSpawnSubagent(3)).toBe(false)
  })
})

describe('task-planner', () => {
  it('planTask returns 4 steps', () => {
    const plan = planTask('Haz una investigación', ['search', 'read'])
    expect(plan.steps).toHaveLength(4)
    expect(plan.steps[0].name).toBe('Analizar tarea')
    expect(plan.steps[0].status).toBe('pending')
  })
})
