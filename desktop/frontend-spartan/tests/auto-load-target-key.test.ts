
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAutoLoadTarget } from "../src/features/chat/api/chat-adapter/model-autoload-selection.ts";

const sameKey = (a: string, b: string) => normalizeAutoLoadTarget(a) === normalizeAutoLoadTarget(b);

test("one Windows file spelled with either separator is one candidate", () => {
  // Two keys meant one spelling burned an attempt on the same file, and a
  // remembered record written as C:\ never matched C:/.
  assert.ok(sameKey("C:\\Users\\a\\models\\M.gguf", "C:/Users/a/models/M.gguf"));
});

test("Windows and UNC paths still fold case", () => {
  assert.ok(sameKey("C:\\Users\\a\\M.gguf", "c:\\users\\a\\m.gguf"));
  assert.ok(sameKey("\\\\srv\\share\\M.gguf", "\\\\SRV\\share\\m.gguf"));
});

test("WSL UNC paths keep their case, because they address ext4", () => {
  // Folding merged two real files onto one key, so the second never loaded.
  assert.ok(
    !sameKey("\\\\wsl$\\Ubuntu\\home\\a\\M.gguf", "\\\\wsl$\\Ubuntu\\home\\a\\m.gguf"),
  );
  assert.ok(sameKey("\\\\wsl$\\Ubuntu\\home\\a\\M.gguf", "//wsl$/Ubuntu/home/a/M.gguf"));
});

test("POSIX paths keep their case", () => {
  assert.ok(!sameKey("/home/a/M.gguf", "/home/a/m.gguf"));
});

test("a decomposed filename is the same candidate as its composed form", () => {
  // macOS hands back NFD, so a remembered model was never re-attempted.
  assert.ok(sameKey("/home/a/caf\u00e9.gguf", "/home/a/cafe\u0301.gguf"));
});

test("repo ids still fold case", () => {
  assert.ok(sameKey("unsloth/Qwen3-0.6B-GGUF", "UNSLOTH/qwen3-0.6b-gguf"));
});
