export type VoiceProvider = "local" | "elevenlabs" | "groq" | "compatible";

export const voiceProviderOptions: Record<
  VoiceProvider,
  {
    name: string;
    model: string;
    endpoint: string;
    keysUrl?: string;
    helpUrl?: string;
  }
> = {
  local: { name: "Whisper", model: "base", endpoint: "" },
  elevenlabs: {
    name: "ElevenLabs",
    model: "scribe_v2",
    endpoint: "https://api.elevenlabs.io/v1/speech-to-text",
    keysUrl: "https://elevenlabs.io/app/developers/api-keys",
    helpUrl:
      "https://elevenlabs.io/docs/help-center/technical/how-do-i-authorize-myself-using-an-api-key",
  },
  groq: {
    name: "Groq",
    model: "whisper-large-v3-turbo",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    keysUrl: "https://console.groq.com/keys",
    helpUrl: "https://console.groq.com/docs/quickstart",
  },
  compatible: { name: "API", model: "whisper-1", endpoint: "" },
};
