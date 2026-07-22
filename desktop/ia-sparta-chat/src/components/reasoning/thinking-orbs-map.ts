import type { ThinkingStatus } from 'ia-sparta-core'

/**
 * Orb states available from the `thinking-orbs` library.
 * Each state maps to a distinct visual animation.
 */
export type OrbState = 'working' | 'searching' | 'solving' | 'listening' | 'composing' | 'shaping'

/**
 * Resolves the current orb state based on the thinking status,
 * active tool, active skill, and active subagent.
 *
 * This is a pure derived function — no new state, no side effects.
 *
 * Mapping logic (from the plan):
 *   - `thinking:started` / `thinking:token` (native reasoning) → 'working'
 *   - `skill:activated`, `subagent:activated` (research_agent) → 'searching'
 *   - `tool:call` on `web_search`, `code_search_tools` → 'searching'
 *   - `tool:call` on `patch_tools`, `diagnostics_tool`, `terminal_tools` → 'solving'
 *   - `audio` (transcription in progress) → 'listening'
 *   - Post-thinking (composing final response, no active tools/skills) → 'composing'
 *   - `skill_router.select_relevant_skills` in progress → 'shaping'
 *   - Default → 'working'
 */
export function resolveOrbState(input: {
  status: ThinkingStatus
  activeTool?: string | null
  activeSkill?: string | null
  activeSubagent?: string | null
}): OrbState {
  // Active search tool → searching orb
  if (input.activeTool && /search|web_search|code_search/.test(input.activeTool)) {
    return 'searching'
  }

  // Active patch/diagnostic/terminal tool → solving orb
  if (input.activeTool && /patch|diagnostic|terminal/.test(input.activeTool)) {
    return 'solving'
  }

  // Active subagent: research_agent → searching, memory_agent → listening
  if (input.activeSubagent) {
    if (/research|search/.test(input.activeSubagent)) return 'searching'
    if (/memory/.test(input.activeSubagent)) return 'listening'
  }

  // Active skill running → searching (skill:activated means retrieving context)
  if (input.activeSkill) {
    return 'searching'
  }

  // Thinking completed with no active tools/skills → composing final response
  if (input.status === 'completed') {
    return 'composing'
  }

  // Default: general thinking in progress
  return 'working'
}
