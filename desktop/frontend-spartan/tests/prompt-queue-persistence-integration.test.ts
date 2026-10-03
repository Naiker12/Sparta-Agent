/** Run the real manager, writer and checkpoint adapter; replace transport/runtime boundaries. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

type Environment = {
  epoch: number;
  running: boolean;
  failWrites: boolean;
  markers: boolean[];
  saved: Map<string, { revision: number; checkpoint: any }>;
  appended: string[];
};

async function manager() {
  const env: Environment = { epoch: 0, running: false, failWrites: false, markers: [], saved: new Map(), appended: [] };
  (globalThis as any).__queueEnv = env;
  (globalThis as any).window = new EventTarget();
  const mocks: Record<string, string> = {
    "react": "export const createContext = value => value;",
    "@/features/auth": `export const AUTH_SESSION_CLEARED_EVENT='cleared'; export const getAuthSessionEpoch=()=>globalThis.__queueEnv.epoch;`,
    "@/lib/toast": "export const toast={error:()=>{}};",
    "@/features/chat": `export const PROMPT_QUEUE_RUN_FAILED_EVENT='failed', PROMPT_QUEUE_STOP_EVENT='stop';
      export const planLocalPromptQueueStop=()=>({}); export const promptQueueActiveItemChanged=()=>false;
      export const reorderPromptQueueItems=(items,from,to)=>{const copy=[...items];copy.splice(to,0,copy.splice(from,1)[0]);return copy};`,
    "@/features/chat/api/chat-adapter": "export const resolveProjectId=async()=>null;",
    "@/features/chat/stores/chat-runtime-store": `export const useChatRuntimeStore={getState:()=>({runningByThreadId:{}}),subscribe:()=>()=>{}};`,
    "@/features/chat/stores/prompt-queue-ui-store": `let state={};export const usePromptQueueUI={setState:patch=>Object.assign(state,patch),getState:()=>state};`,
    "@/features/chat/utils/queued-chat-run-settings": "export const discardQueuedChatRunSettingsForThread=()=>{};",
    "@/features/rag/api/rag-api": `export const isRagClientError=()=>false,listProjectDocuments=async()=>[],listThreadDocuments=async()=>[],projectWorkCount=()=>0;`,
    "@/features/rag/api/rag-availability": "export const useRagAvailabilityStore={getState:()=>({isUnavailable:()=>true})};",
    "@/features/chat/api/prompt-queues-api": `export const savePromptQueue=async(id,checkpoint,expected,epoch)=>{
      const env=globalThis.__queueEnv;
      if(env.failWrites || env.epoch!==epoch) throw Error('transport or session');
      const current=env.saved.get(id);
      if(current && current.revision===expected+1 && JSON.stringify(current.checkpoint)===JSON.stringify(checkpoint)) return current.revision;
      if((current?.revision??0)!==expected) throw Error('conflict');
      env.saved.set(id,{revision:expected+1,checkpoint:structuredClone(checkpoint)});
      env.markers.push(checkpoint.items.some(item=>item.dispatched));
      return expected+1;
    };`,
  };
  const output = await build({
    entryPoints: [fileURLToPath(new URL("../src/components/assistant-ui/thread/prompt-queue-manager.ts", import.meta.url))],
    bundle: true, write: false, format: "cjs", platform: "node", logLevel: "silent",
    plugins: [{ name: "boundaries", setup(builder) {
      builder.onResolve({ filter: /.*/ }, (args) => {
        if (mocks[args.path]) return { path: args.path, namespace: "boundary" };
        if (args.path.startsWith("@/")) return { path: fileURLToPath(new URL(`../src/${args.path.slice(2)}.ts`, import.meta.url)) };
      });
      builder.onLoad({ filter: /.*/, namespace: "boundary" }, (args) => ({ contents: mocks[args.path], loader: "js" }));
    } }],
  });
  const module = { exports: {} as any };
  new Function("module", "exports", "require", output.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
  const settings = { params: { checkpoint: "external:provider:model" }, permissionMode: "ask", bypassPermissions: false };
  const target = {
    getDocumentThreadId: () => "thread", getQueueProjectId: () => null,
    getRunningThreadIds: () => ["thread"], isRunning: () => env.running,
    append: async (prompt: string) => {
      const saved = [...env.saved.values()][0];
      assert.ok(saved.checkpoint.items[0].dispatched, "marker must precede provider dispatch");
      env.appended.push(prompt); env.running = true;
    }, complete: () => {}, cancel: () => { env.running = false; },
    isIndexing: () => false, usesThreadDocuments: false, usesKnowledgeBase: false,
    usesLocalModel: false, usesDeepResearch: false, temporary: false,
    consumeDeepResearch: () => {}, getDurableSettings: () => structuredClone(settings),
    prepareDurableThread: async () => "thread",
  };
  return { env, api: module.exports, target };
}

const delay = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

test("waiting queue is saved before current response finishes; edits and deletes survive", async () => {
  const { env, api, target } = await manager();
  env.running = true;
  api.startPromptQueue(["first", "second"], target, true);
  await delay(20);
  assert.equal(env.appended.length, 0);
  const run = api.getPromptQueueRunsForThreadIds(["thread"])[0];
  assert.equal([...env.saved.values()][0].checkpoint.items.length, 2);
  api.editPromptQueueItem(run.items[0].id, "edited");
  api.removePromptQueueItem(run.items[1].id);
  await delay(20);
  assert.deepEqual([...env.saved.values()][0].checkpoint.items.map((item: any) => item.prompt), ["edited"]);
  api.stopAllPromptQueueRuns();
  await delay(20);
  assert.deepEqual([...env.saved.values()][0].checkpoint.items, []);
});

test("dispatch waits for committed marker and completion retains next pending item", async () => {
  const { env, api, target } = await manager();
  api.startPromptQueue(["first", "second"], target);
  await delay();
  assert.deepEqual(env.appended, ["first"]);
  const run = api.getPromptQueueRunsForThreadIds(["thread"])[0];
  api.advancePromptQueue(run);
  await delay(20);
  assert.deepEqual([...env.saved.values()][0].checkpoint.items.map((item: any) => item.prompt), ["second"]);
  api.stopAllPromptQueueRuns();
  await delay(20);
});

test("unavailable storage prevents dispatch instead of sending unsaved work", async () => {
  const { env, api, target } = await manager();
  env.failWrites = true;
  api.startPromptQueue(["first"], target);
  await delay();
  assert.deepEqual(env.appended, []);
  assert.equal(api.getPromptQueueRunsForThreadIds(["thread"]).length, 1);
  env.failWrites = false;
  api.stopAllPromptQueueRuns();
  await delay(20);
});

test("recovery never replays a dispatched item and preserves pending ids", async () => {
  const { env, api, target } = await manager();
  const saved = { id: "recovered", revision: 4, checkpoint: {
    version: 1, threadId: "thread", projectId: null,
    items: [
      { id: "sent", prompt: "already sent", dispatched: true, settings: target.getDurableSettings() },
      { id: "pending", prompt: "continue", dispatched: false, settings: target.getDurableSettings() },
    ],
  } };
  env.saved.set(saved.id, { revision: saved.revision, checkpoint: saved.checkpoint });
  assert.equal(api.restorePromptQueue(saved, [target]), true);
  assert.equal(api.restorePromptQueue(saved, [target]), false);
  await delay();
  assert.deepEqual(env.appended, ["continue"]);
  api.stopAllPromptQueueRuns();
  await delay(20);
});

test("temporary queue uses the live runtime without leaving checkpoints", async () => {
  const { env, api, target } = await manager();
  api.startPromptQueue(["private"], { ...target, temporary: true, append: () => { env.appended.push("private"); env.running = true; } });
  await delay();
  assert.deepEqual(env.appended, ["private"]);
  assert.equal(env.saved.size, 0);
  api.stopAllPromptQueueRuns();
});

test("private follow-up cannot leak into an already durable queue", async () => {
  const { env, api, target } = await manager();
  env.running = true;
  api.startPromptQueue(["public"], target, true);
  await delay(20);
  api.startPromptQueue(["private"], { ...target, temporary: true }, true);
  await delay(20);
  assert.deepEqual([...env.saved.values()][0].checkpoint.items.map((item: any) => item.prompt), ["public"]);
  api.stopAllPromptQueueRuns();
  await delay(20);
});

test("reordering saved pending items changes recovery order", async () => {
  const { env, api, target } = await manager();
  env.running = true;
  api.startPromptQueue(["first", "second", "third"], target, true);
  await delay(20);
  const run = api.getPromptQueueRunsForThreadIds(["thread"])[0];
  api.movePromptQueueItem(run.items[2].id, run.items[0].id);
  await delay(20);
  assert.deepEqual([...env.saved.values()][0].checkpoint.items.map((item: any) => item.prompt), ["third", "first", "second"]);
  api.stopAllPromptQueueRuns();
  await delay(20);
});

test("logout clears live callbacks while preserving recoverable work for its owner", async () => {
  const { env, api, target } = await manager();
  env.running = true;
  api.startPromptQueue(["pending"], target, true);
  await delay(20);
  env.epoch += 1;
  (globalThis as any).window.dispatchEvent(new Event("cleared"));
  await delay(20);
  assert.equal(api.getPromptQueueRunsForThreadIds(["thread"]).length, 0);
  assert.equal([...env.saved.values()][0].checkpoint.items[0].prompt, "pending");
  assert.deepEqual(env.appended, []);
});

test("recovery refuses another chat and temporary targets", async () => {
  const { env, api, target } = await manager();
  const saved = { id: "recovered", revision: 1, checkpoint: {
    version: 1, threadId: "thread", projectId: null,
    items: [{ id: "pending", prompt: "pending", dispatched: false, settings: target.getDurableSettings() }],
  } };
  assert.equal(api.restorePromptQueue(saved, [{ ...target, getDocumentThreadId: () => "other" }]), false);
  assert.equal(api.restorePromptQueue(saved, [{ ...target, temporary: true }]), false);
  await delay(20);
  assert.deepEqual(env.appended, []);
});

test("consumed deep research is not restored for follow-up prompts", async () => {
  const { env, api, target } = await manager();
  let enabled = true;
  const researchTarget = { ...target, usesDeepResearch: true,
    consumeDeepResearch: () => { enabled = false; },
    getDurableSettings: () => ({ ...target.getDurableSettings(), deepResearchEnabled: enabled }),
  };
  api.startPromptQueue(["research", "follow-up"], researchTarget);
  await delay();
  const saved = [...env.saved.values()][0];
  assert.deepEqual(saved.checkpoint.items.map((item: any) => item.settings.deepResearchEnabled), [false, false]);
  api.stopAllPromptQueueRuns();
  await delay(20);
});
