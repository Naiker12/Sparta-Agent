import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

test("image reads respect unmount, newer selections and current failures", async () => {
  const env = { refs: [] as any[], effects: [] as (() => void)[], readers: [] as any[], values: [] as unknown[], errors: [] as unknown[] };
  (globalThis as any).__picker = env;
  const mocks: Record<string, string> = {
    react: `export const useRef=value=>{const ref={current:value};globalThis.__picker.refs.push(ref);return ref};
      export const useState=value=>[value,()=>{}];export const useCallback=fn=>fn;
      export const useEffect=fn=>{const clean=fn();if(clean)globalThis.__picker.effects.push(clean)};`,
    "@hugeicons/core-free-icons": "export const Delete02Icon={},ImageAdd02Icon={};",
    "@hugeicons/react": "export const HugeiconsIcon=()=>null;",
    "@/components/ui/button": "export const Button=()=>null;",
    "@/components/ui/tooltip": "export const Tooltip=()=>null,TooltipContent=()=>null,TooltipTrigger=()=>null;",
    "@/features/native-intents": "export const readNativeAttachmentFile=async()=>({}),registerNativeAttachmentPath=async()=>({}),useNativeDropTarget=()=>null;",
    "@/lib/toast": "export const toast={error:value=>globalThis.__picker.errors.push(value)};",
    "@/lib/utils": "export const cn=(...values)=>values.filter(Boolean).join(' ');",
  };
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("../src/components/image-dropzone.tsx", import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", external: ["react/jsx-runtime"], jsx: "automatic", plugins: [{ name: "picker-boundaries", setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: "mock" } : null);
    builder.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: mocks[args.path], loader: "js" }));
  } }] });
  const module = { exports: {} as any };
  new Function("module", "exports", "require", bundle.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
  const previousReader = globalThis.FileReader;
  (globalThis as any).FileReader = class {
    result = "data:image/png;base64,test";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { env.readers.push(this); }
    readAsDataURL() {}
  };
  try {
    const render = () => module.exports.ImageDropzone({ value: null, onChange: (value: unknown) => env.values.push(value) });
    const element = render();
    const choose = () => element.props.children.find((child: any) => child.type === "input").props.onChange({ target: { files: [{ type: "image/png" }] } });
    choose(); choose();
    env.readers[0].onload(); env.readers[0].onerror();
    assert.deepEqual(env.values, []);
    assert.deepEqual(env.errors, []);
    env.readers[1].onload();
    assert.equal(env.values.length, 1);
    choose();
    env.readers[2].onerror();
    assert.equal(env.errors.length, 1);
    choose();
    env.effects.forEach(clean => clean());
    env.readers[3].onload(); env.readers[3].onerror();
    assert.equal(env.values.length, 1, "unmounted picker must not write");
    assert.equal(env.errors.length, 1, "unmounted picker must not toast");
  } finally {
    globalThis.FileReader = previousReader;
    delete (globalThis as any).__picker;
  }
});
