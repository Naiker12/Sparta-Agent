# Sparta Runtime and UI Convergence Implementation Plan

> **For Hermes:** Execute this plan task-by-task. Keep each change independently reviewable; do not combine P0 safety work with later product features.

**Goal:** Make native tool execution safe and observable, replacing the duplicated dispatcher/runtime paths with one registered tool path and connecting the existing plan, subagent, and permission UI to real native events.

**Architecture:** Treat the Electron main process and renderer as separate dependency directions. Introduce a dependency-free `ia-sparta-contracts` package for serialized types only, keep policy evaluation in a new main-safe module under `ia-sparta-chat-ipc`, and adapt renderer Zustand stores from IPC events. Tool schemas and dispatch must be generated from one registry; MCP remains a dynamic adapter rather than a statically registered tool per server.

**Tech Stack:** Electron 30, TypeScript 5, pnpm workspaces, React 18, Zustand, Vitest.

---

## Audit summary and decisions

- Confirmed: `desktop/ia-sparta-chat-ipc/src/send/tool-executor/index.ts` has the central `if` dispatcher; its `create_plan`, `delegate_research`, and `delegate_code` branches only return descriptive strings.
- Confirmed: `desktop/ia-sparta-core/src/services/agents/*` duplicates `desktop/ia-sparta-agents/src/services/*`; both runtimes parse legacy `<tool_use>` XML-like blocks.
- Confirmed: `PermissionEvaluatorService` exists but imports renderer Zustand state. It must **not** be imported by Electron main (`ia-sparta-chat-ipc`).
- Confirmed: the existing `PlanWatchPane`, `SubagentWatchPane`, `PermissionRequestDialog`, event store, and basic plan/permission stores can be evolved rather than replaced.
- The attached BACKEND/FRONTEND plans are directionally correct, but their proposed `ia-sparta-core` dependency from main to renderer is unsafe. The plan below corrects that boundary.
- Scope starts with P0 only. Model routing, usage dashboards, and external harness adapters are explicitly deferred until the safe native execution path is proven.

## Delivery order

1. Establish contracts, event envelopes, and tests.
2. Move native tools into a registry while preserving current provider/MCP behavior.
3. Add main-process permission decisions and request/response IPC.
4. Turn plans and subagents into real work; then connect the existing UI.
5. Consolidate the duplicate agent runtime only after its behavior is covered by tests.
6. Add loop protection and the advanced P1/P2 features in separate follow-up plans.

## Task 1: Establish workspace contracts and main-safe policy types

**Objective:** Define the minimal shared serializable vocabulary without importing React, Electron, Zustand, or tool handlers.

**Files:**

- Create: `desktop/ia-sparta-contracts/package.json`
- Create: `desktop/ia-sparta-contracts/src/tool.contract.ts`
- Create: `desktop/ia-sparta-contracts/src/event.contract.ts`
- Create: `desktop/ia-sparta-contracts/src/permission.contract.ts`
- Create: `desktop/ia-sparta-contracts/src/task.contract.ts`
- Create: `desktop/ia-sparta-contracts/src/index.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `tsconfig.json`
- Test: `desktop/ia-sparta-contracts/src/__tests__/contracts.test.ts`

**Steps:**

1. Add the workspace package and the `ia-sparta-contracts` TypeScript path alias.
2. Define serializable `ToolDescriptor`, `ToolCallContext`, `ToolExecutionResult`, `PermissionRequestPayload`, `PermissionDecision`, `SpartaEventEnvelope<T>`, `TaskStatus`, and `TaskStep` types. Keep handlers out of `ToolDescriptor`; handlers remain local to the main process registry.
3. Add compile-time fixture tests for a tool result, a permission request, and plan/subagent envelope payloads.
4. Run `pnpm exec vitest run desktop/ia-sparta-contracts/src/__tests__/contracts.test.ts` and `pnpm exec tsc --noEmit`.

**Acceptance:** Main-process packages can import contract types without pulling in renderer code.

## Task 2: Add a registry with parity tests before migration

**Objective:** Replace branch selection with a typed registry while keeping all current tool outputs and events stable.

**Files:**

- Create: `desktop/ia-sparta-chat-ipc/src/send/tool-registry.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/index.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/web-search.tool.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/web-fetch.tool.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/filesystem.tool.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/run-command.tool.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/generate-chart.tool.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/create-plan.tool.ts`
- Modify: `desktop/ia-sparta-chat-ipc/src/send/tool-executor/index.ts`
- Modify: `desktop/ia-sparta-chat-ipc/src/send/tool-injector.ts`
- Test: `desktop/ia-sparta-chat-ipc/src/send/__tests__/tool-registry.test.ts`

**Steps:**

1. Write tests proving duplicate registration fails, unknown tools return a normalized error result, and every static native descriptor has a registered handler.
2. Implement `registerTool`, `getTool`, `listToolDescriptors`, and `dispatchToolCall` in the registry.
3. Migrate web, filesystem, command, chart, and plan tools one at a time; retain all `sendToRenderer` progress events inside the relevant handler.
4. Keep the `serverId__toolName` path as a dynamic MCP adapter in the dispatcher until MCP metadata has a concrete descriptor model; do not incorrectly pre-register every server tool.
5. Generate static native schemas in `tool-injector.ts` from `listToolDescriptors()` and preserve caller-supplied MCP schemas.
6. Reduce `tool-executor/index.ts` to registry initialization plus the MCP adapter, then remove old branches only after parity tests pass.
7. Run the registry tests and `pnpm run build`.

**Acceptance:** Adding a native tool changes one handler module and its test; schema name, metadata, and execution cannot drift.

## Task 3: Make permissions enforced in Electron main

**Objective:** Require a decision before any native mutation or high-risk dynamic MCP call.

**Files:**

- Create: `desktop/ia-sparta-chat-ipc/src/security/permission-policy.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/security/request-user-approval.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/security/with-permission-check.ts`
- Modify: `desktop/ia-sparta-chat-ipc/src/send/tools/filesystem.tool.ts`
- Modify: `desktop/ia-sparta-chat-ipc/src/send/tools/run-command.tool.ts`
- Modify: `desktop/ia-sparta-chat-ipc/src/send/tool-executor/index.ts`
- Modify: `desktop/ia-sparta-ipc-bridge/src/channels/permission.channel.ts`
- Modify: `desktop/ia-sparta-permission/src/PermissionRequestDialog.tsx`
- Test: `desktop/ia-sparta-chat-ipc/src/security/__tests__/permission-policy.test.ts`
- Test: `desktop/ia-sparta-chat-ipc/src/security/__tests__/with-permission-check.test.ts`

**Steps:**

1. Write policy tests for deny precedence, workspace-contained read allowance, prompt for writes/commands, and expiry/cancellation of pending requests.
2. Implement a pure policy evaluator in `chat-ipc`; it accepts snapshot rules and never imports `ia-sparta-core` stores.
3. Define `permission:requested` and correlated `permission:respond` IPC payloads with request IDs, action, target, preview, risk, task/agent context, and allow-once/allow-always/deny choices.
4. Decorate filesystem write/edit/delete and command handlers. Apply the same guard to MCP tools when the MCP middleware classifies them as write operations.
5. Update `PermissionRequestDialog` to consume the IPC event and respond through the preload bridge. Do not remove the older sidecar route until a native-flow integration test passes.
6. Verify that a denial returns a structured `denied` result and neither invokes the native shell/file action nor sends a success tool event.

**Acceptance:** There is no main-process mutation path that relies solely on UI filtering or the renderer Zustand evaluator.

## Task 4: Make plans and subagents real, with a single event stream

**Objective:** Replace simulated outputs with persisted turn state and renderer-consumable events.

**Files:**

- Create: `desktop/ia-sparta-chat-ipc/src/send/task-runtime.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/subagent-runner.ts`
- Modify: `desktop/ia-sparta-chat-ipc/src/send/tools/create-plan.tool.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/delegate-research.tool.ts`
- Create: `desktop/ia-sparta-chat-ipc/src/send/tools/delegate-code.tool.ts`
- Modify: `desktop/ia-sparta-chat-ipc/src/shared.ts`
- Modify: `desktop/ia-sparta-core/src/types/events.ts`
- Modify: `desktop/ia-sparta-core/src/stores/plan.store.ts`
- Modify: `desktop/ia-sparta-agents/src/components/PlanWatchPane.tsx`
- Modify: `desktop/ia-sparta-agents/src/components/SubagentWatchPane.tsx`
- Test: `desktop/ia-sparta-chat-ipc/src/send/__tests__/task-runtime.test.ts`

**Steps:**

1. Add an explicit transition table for `CREATED → PLANNING → READY → RUNNING → WAITING_PERMISSION/WAITING_TOOL/VERIFYING → COMPLETED|FAILED|CANCELLED`; test valid and invalid transitions.
2. Make `create_plan` create a task record and emit sequenced `plan:created` and `plan:step` envelopes rather than returning only formatted text.
3. Implement a minimal real subagent runner which emits started/step/completed/failed events and delegates only through the registry and permission decorator. It must support cancellation.
4. Update the renderer event bridge/store to normalize envelopes and derive plan progress. Preserve current `PlanWatchPane` rendering before adding new UX.
5. Update `SubagentWatchPane` only to consume the normalized event form; do not add `SubagentCard` until live data is observed.

**Acceptance:** A user-created plan and a delegated task visibly progress from native execution, including permission waits and failures.

## Task 5: Consolidate the legacy agent runtime safely

**Objective:** Remove duplicate runtime logic only after tool parsing and lifecycle behavior are covered.

**Files:**

- Modify: `desktop/ia-sparta-core/src/services/agents/agent-runtime.ts`
- Modify: `desktop/ia-sparta-core/src/services/agents/tool-executor.ts`
- Modify: `desktop/ia-sparta-agents/src/services/index.ts`
- Modify: `desktop/ia-sparta-agents/src/services/tool-executor.ts`
- Delete: `desktop/ia-sparta-agents/src/services/agent-runtime.ts`
- Create: `desktop/ia-sparta-core/src/services/agents/__tests__/agent-runtime.test.ts`

**Steps:**

1. Write tests for tool-call parsing, dependent versus independent execution, cancellation, max turns, emitted lifecycle events, and failed tools.
2. Choose one normalized native tool-call format compatible with the transport layer. Retain a temporary parser adapter only for providers that cannot emit structured calls; add a removal criterion and test.
3. Extract renderer-only file/shell implementations from `ia-sparta-core` into the appropriate renderer/IPC bridge package. The main runtime must call the registry, not `window.fs` or `window.terminal`.
4. Point `ia-sparta-agents` at the canonical runtime API, delete its copy, and remove duplicated executor code only after consumers compile.
5. Run runtime tests, workspace typecheck, and the complete existing Vitest suite.

**Acceptance:** Exactly one agent runtime owns parsing, task lifecycle, and tool execution policy.

## Task 6: Complete P0 UI and verification

**Objective:** Enrich the existing UI with real data without redesigning unrelated surfaces.

**Files:**

- Create: `desktop/ia-sparta-permission/src/RiskBadge.tsx`
- Create: `desktop/ia-sparta-agents/src/components/PlanStepDetail.tsx`
- Modify: `desktop/ia-sparta-permission/src/PermissionRequestDialog.tsx`
- Modify: `desktop/ia-sparta-agents/src/components/PlanWatchPane.tsx`
- Modify: `desktop/ia-sparta-agents/src/components/SubagentWatchPane.tsx`
- Test: component tests colocated with each component, if the project test setup can render React; otherwise cover selectors and IPC payloads with unit tests first.

**Steps:**

1. Add a shared risk badge and display command/path/reason/agent/task context in the approval dialog.
2. Display task status, elapsed time, tools used, and weighted progress in the plan view. Do not display estimated time remaining.
3. Render subagent statuses from actual envelopes, including `waiting_permission`, cancellation, and error states.
4. Manually verify the native flow in Electron: read file → allowed, write file → prompt → deny, write file → approve once, run command → prompt, create plan → live steps, delegate subagent → live completion.
5. Run `pnpm run build` and `pnpm exec vitest run`.

**Acceptance:** The UI makes native actions, requested approvals, and task state explainable without claiming unsupported ETAs.

## Deferred follow-up work

- **P1:** Add a reusable loop guard in `send.channel.ts`, including duplicate `(tool, normalized args)` detection and budget tests before enabling automatic retries.
- **P1:** Implement model routing only after model performance telemetry has a valid source of truth and an opt-in setting.
- **P2:** Add usage charts, execution timeline, debug mode, and model-routing badge after their event/telemetry contracts exist.
- **P2:** Add external harness adapters only after defining sandboxing, output streaming, cancellation, and critical-permission behavior; never shell out from UI code.

## Risks and safeguards

- The existing paths import source files via relative paths across workspace packages. Migrate imports to package boundaries incrementally and typecheck after each task.
- Tool execution has both native and MCP paths. Keep MCP dynamic during registry migration to avoid breaking user-provided servers.
- Permission policy persisted in renderer storage cannot be treated as a trusted source by the main process; pass validated snapshots over IPC or persist rules in a main-owned store before enforcing allow-always.
- Build artifacts are intentionally not committed; verify only after checking the working tree and preserving unrelated user changes.
