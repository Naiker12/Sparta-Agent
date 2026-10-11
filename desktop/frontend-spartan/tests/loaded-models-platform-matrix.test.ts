// Hardware payload coverage for the supported chat and dictation runtimes.

import assert from "node:assert/strict";
import test from "node:test";

import type { InferenceStatusResponse } from "../src/features/chat/types/api.ts";
import {
  type SttStatusResponse,
  describeInferenceStatus,
  describeSttStatus,
  mergeLoadedModels,
} from "../src/features/loaded-models/loaded-models-sources.ts";

// The handler returns a bare model with every flag false when nothing is
// loaded, so a partial fixture stands in for the full response.
function chat(
  overrides: Partial<InferenceStatusResponse>,
): InferenceStatusResponse {
  return {
    active_model: null,
    loaded: [],
    is_gguf: false,
    is_mlx: false,
    is_vision: false,
    is_audio: false,
    audio_type: null,
    gguf_variant: null,
    ...overrides,
  } as InferenceStatusResponse;
}

test("a GGUF chat model reads the same on every accelerator", () => {
  // llama.cpp runs on NVIDIA, AMD, Intel, Apple and plain CPU, and the GGUF
  // branch is chosen purely by llama_backend.is_loaded with no hardware gate.
  // is_mlx is force-set false there, so it must never win the runtime ladder.
  for (const host of ["nvidia", "rocm", "xpu", "cpu-only", "apple"]) {
    const rows = describeInferenceStatus(
      chat({
        active_model: "unsloth/Qwen3-4B-GGUF",
        loaded: ["unsloth/Qwen3-4B-GGUF"],
        is_gguf: true,
        gguf_variant: "Q4_K_M",
      }),
    );
    assert.equal(rows.length, 1, host);
    assert.equal(rows[0].kind, "text", host);
    assert.equal(rows[0].detail, "GGUF · Q4_K_M", host);
  }
});

test("Apple Silicon MLX is labelled MLX, and only there", () => {
  const mlx = describeInferenceStatus(
    chat({ active_model: "mlx-community/Qwen3-4B-4bit", is_mlx: true }),
  );
  assert.equal(mlx[0].detail, "MLX");
  // An Intel Mac, or Apple Silicon whose MLX stack is unusable, falls back to
  // DeviceType.CPU and reports is_mlx false -- so it must read as Transformers.
  const intelMac = describeInferenceStatus(
    chat({ active_model: "unsloth/Qwen3-4B", is_mlx: false }),
  );
  assert.equal(intelMac[0].detail, "Transformers");
});

test("GGUF wins over MLX if a payload ever claims both", () => {
  // Defensive: the backend force-sets is_mlx false on the GGUF branch, but the
  // ladder must not depend on that to avoid mislabelling the runtime.
  const rows = describeInferenceStatus(
    chat({
      active_model: "unsloth/Qwen3-4B-GGUF",
      is_gguf: true,
      is_mlx: true,
      gguf_variant: "UD-Q4_K_XL",
    }),
  );
  assert.equal(rows[0].detail, "GGUF · UD-Q4_K_XL");
});

test("a vision model is marked on any backend", () => {
  const rows = describeInferenceStatus(
    chat({
      active_model: "unsloth/gemma-3-4b-it",
      is_vision: true,
    }),
  );
  assert.equal(rows[0].detail, "Transformers · Vision");
  assert.equal(rows[0].kind, "text", "vision is still a chat row");
});

// ── Chat runtime: every audio_type the backend can emit ─────────────────

test("audio models split three ways, not two", () => {
  // VALID_AUDIO_TYPES in model_config.py. is_audio means TTS here, as
  // mlx_inference documents, so the split is not simply in-vs-out: whisper is
  // the ASR sidecar, audio_vlm is a chat model that listens and still answers
  // prompts, and the remaining four speak.
  const speaks = ["snac", "csm", "bicodec", "dac"];
  for (const audioType of speaks) {
    const rows = describeInferenceStatus(
      chat({ active_model: `m/${audioType}`, is_audio: true, audio_type: audioType }),
    );
    assert.equal(rows[0].kind, "tts", `${audioType} produces audio`);
  }
  const whisper = describeInferenceStatus(
    chat({ active_model: "m/whisper", is_audio: true, audio_type: "whisper" }),
  );
  assert.equal(whisper[0].kind, "stt", "whisper transcribes, it does not answer");
  // Gemma 3n. The Transformers path can report is_audio true for it (the codec
  // load at inference.py:520 is skipped by name, not by the flag), so filing it
  // by the flag alone would hide a chat model under Speech or Dictation.
  const vlm = describeInferenceStatus(
    chat({ active_model: "unsloth/gemma-3n-E4B-it", is_audio: true, audio_type: "audio_vlm" }),
  );
  assert.equal(vlm[0].kind, "text", "an audio VLM is a chat model that listens");
});

test("an audio flag with no type still reads as speech", () => {
  // audio_type detection can come back null on a model the tokenizer scan could
  // not classify. It is not an input type, so the TTS default is right.
  const rows = describeInferenceStatus(
    chat({ active_model: "m/unknown", is_audio: true, audio_type: null }),
  );
  assert.equal(rows[0].kind, "tts");
});

test("audio_type without is_audio does not make an audio row", () => {
  const rows = describeInferenceStatus(
    chat({ active_model: "m/x", is_audio: false, audio_type: "whisper" }),
  );
  assert.equal(rows[0].kind, "text");
});

// ── Diffusion: the device vocabulary, and the two engines ───────────────

// ── Video: NVIDIA/Intel only in practice, but the payload is the contract ──

// ── Dictation: three engines, and a "device" that is not a device ────────

test("each dictation engine reports its own row", () => {
  const rows = describeSttStatus({
    transformers: { loaded_model: "large-v3", device: "cuda" },
    mtmd: { loaded_model: "qwen3-asr-0.6b", device: "llama.cpp" },
    gguf: { loaded_model: "ggml-base.en", device: "whisper.cpp" },
  } as SttStatusResponse);
  assert.deepEqual(
    rows.map((row) => row.detail),
    // The sidecars put their engine name in device, so it must not print twice.
    ["Transformers · cuda", "llama.cpp", "whisper.cpp"],
  );
  assert.deepEqual(
    rows.map((row) => row.sttEngine),
    ["transformers", "mtmd", "gguf"],
  );
});

test("dictation on Apple and on CPU-only hosts", () => {
  // _pick_device() in stt_sidecar.py knows only cuda/mps/cpu -- notably NOT xpu,
  // so an Intel GPU host reports cpu here while images report xpu.
  for (const device of ["mps", "cpu"]) {
    const rows = describeSttStatus({
      transformers: { loaded_model: "small", device },
    } as SttStatusResponse);
    assert.equal(rows[0].detail, `Transformers · ${device}`, device);
  }
});

test("an engine holding nothing contributes no row", () => {
  const rows = describeSttStatus({
    transformers: { loaded_model: null, device: null },
    mtmd: { loaded_model: null, device: null },
    gguf: { loaded_model: null, device: null },
  } as SttStatusResponse);
  assert.deepEqual(rows, []);
});

// ── The merge, across a fully loaded host ───────────────────────────────

test("a whisper model in chat and in dictation is two rows, not one", () => {
  // These really are two resident copies: chat loads it inside the inference
  // subprocess, dictation in its own in-process sidecar. Collapsing them would
  // hide a copy the user cannot then free.
  const rows = mergeLoadedModels([
    describeInferenceStatus(
      chat({
        active_model: "openai/whisper-large-v3",
        is_audio: true,
        audio_type: "whisper",
      }),
    ),
    describeSttStatus({
      transformers: { loaded_model: "openai/whisper-large-v3", device: "cuda" },
    } as SttStatusResponse),
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((row) => row.source),
    ["chat", "stt"],
    "each row must eject through its own runtime",
  );
});

test("a host holding chat and dictation lists them in a fixed order", () => {
  const rows = mergeLoadedModels([
    describeInferenceStatus(chat({ active_model: "chat/model", is_gguf: true })),
    describeSttStatus({ transformers: { loaded_model: "large-v3", device: "cuda" } } as SttStatusResponse),
  ]);
  assert.deepEqual(rows.map((row) => row.source), ["chat", "stt"]);
  assert.equal(new Set(rows.map((row) => row.id)).size, 2);
});
