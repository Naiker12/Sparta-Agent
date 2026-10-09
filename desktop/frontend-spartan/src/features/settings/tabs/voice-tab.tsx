import { useEffect, useId, useRef, useState } from "react";
import { authFetch } from "@/features/auth";
import { useT } from "@/i18n";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HugeiconsIcon } from "@hugeicons/react";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import {
  voiceProviderOptions as providers,
  type VoiceProvider as Provider,
} from "./voice-provider-options";
import { LocalVoiceTab } from "./local-voice-tab";

type Profile = { model: string; endpoint: string; has_key: boolean };
type Configuration = {
  provider: Provider;
  profiles: Partial<Record<Provider, Profile>>;
};
export function VoiceTab() {
  const t = useT();
  const id = useId();
  const editRevision = useRef(0);
  const [pane, setPane] = useState("providers");
  const [verified, setVerified] = useState(false);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [selected, setSelected] = useState<Provider>("local");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [key, setKey] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sample, setSample] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [testProblem, setTestProblem] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  function choose(provider: Provider, configuration = config) {
    const profile = configuration?.profiles[provider];
    setSelected(provider);
    setVerified(false);
    setModel(profile?.model ?? providers[provider].model);
    setEndpoint(profile?.endpoint ?? providers[provider].endpoint);
    setKey("");
    setConsent(false);
    setSample(null);
    setTranscript("");
    setProblem(null);
    setTestProblem(null);
  }
  useEffect(() => {
    const controller = new AbortController();
    void authFetch("/api/voice/configuration", {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const value: Configuration = await response.json();
        if (!controller.signal.aborted) {
          setConfig(value);
          setFailed(false);
          if (editRevision.current === 0) choose(value.provider, value);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
    // Initial settings read; edits must not be overwritten by a locale change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);
  async function save(remove = false) {
    if (busy || testing) return;
    setBusy(true);
    setProblem(null);
    try {
      const response = await authFetch(
        remove
          ? `/api/voice/configuration/${selected}`
          : "/api/voice/configuration",
        {
          method: remove ? "DELETE" : "PUT",
          headers: { "Content-Type": "application/json" },
          ...(remove
            ? {}
            : {
                body: JSON.stringify({
                  provider: selected,
                  model,
                  endpoint,
                  api_key: key,
                  consent,
                }),
              }),
        },
        { retryNetworkErrors: false },
      );
      if (!response.ok) {
        const value = await response.json().catch(() => ({}));
        throw new Error(
          typeof value.detail === "string" ? value.detail : "voice_test_failed",
        );
      }
      const value: Configuration = await response.json();
      setConfig(value);
      setFailed(false);
      editRevision.current += 1;
      choose(value.provider, value);
      setPane("providers");
      toast.success(t("channels.voice.configurationSaved"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const message = t(
        code === "voice_key_required"
          ? "channels.voice.keyRequired"
          : code === "invalid_voice_endpoint"
            ? "channels.voice.endpointInvalid"
            : code === "invalid_voice_model"
              ? "channels.voice.modelInvalid"
              : "channels.voice.configurationFailed",
      );
      setProblem(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    if (!sample || testing || busy) return;
    if (sample.size > 20 * 1024 * 1024) {
      setTestProblem(t("channels.voice.sampleTooLarge"));
      return;
    }
    setTesting(true);
    setTestProblem(null);
    setVerified(false);
    setTranscript("");

    try {
      const body = new FormData();
      body.append("file", sample);
      const response = await authFetch(
        "/api/voice/test",
        { method: "POST", body, signal: AbortSignal.timeout(180000) },
        { retryNetworkErrors: false },
      );
      if (!response.ok) {
        const value = await response.json().catch(() => ({}));
        throw new Error(
          typeof value.detail === "string" ? value.detail : "voice_test_failed",
        );
      }
      const value = await response.json();
      setTranscript(value.text);
      setVerified(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const message = t(
        code === "voice_decoder_unavailable"
          ? "channels.voice.decoderUnavailable"
          : code === "audio_invalid"
            ? "channels.voice.invalidSample"
            : code === "audio_empty"
              ? "channels.voice.emptySample"
              : code === "voice_network_failed"
                ? "channels.voice.networkFailed"
                : code === "audio_unavailable"
                  ? "channels.voice.providerUnavailable"
                  : code === "voice_not_ready"
                    ? "channels.voice.configurationFailed"
                    : code === "voice_permission_missing"
                      ? "channels.voice.permissionMissing"
                      : code === "voice_auth_failed"
                        ? "channels.voice.authenticationFailed"
                        : code === "voice_rate_limited"
                          ? "channels.voice.rateLimited"
                          : code === "audio_too_large"
                            ? "channels.voice.sampleTooLarge"
                            : code === "audio_too_long"
                              ? "channels.voice.sampleTooLong"
                              : code === "voice_timeout"
                                ? "channels.voice.timeout"
                                : code === "voice_model_failed"
                                  ? "channels.voice.modelUnavailable"
                                  : "channels.voice.testFailed",
      );
      setTestProblem(message);
    } finally {
      setTesting(false);
    }
  }
  const remote = selected !== "local";
  const saved = config?.profiles[selected];
  const retainedKey = saved?.has_key && saved.endpoint === endpoint;
  const matches =
    config?.provider === selected &&
    saved?.model === model &&
    saved?.endpoint === endpoint &&
    !key;
  return (
    <Tabs value={pane} onValueChange={setPane} className="flex flex-col gap-5">
      <TabsList className="self-start">
        <TabsTrigger value="providers" disabled={busy || testing}>
          {t("channels.voice.providersTab")}
        </TabsTrigger>
        <TabsTrigger value="configuration" disabled={busy || testing}>
          {t("channels.voice.configurationTab")}
        </TabsTrigger>
        <TabsTrigger
          value="test"
          disabled={busy || testing || !remote || !matches}
        >
          {t("channels.voice.testTab")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="providers" className="flex flex-col gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Whisper</CardTitle>
            <CardDescription>
              {t("channels.voice.local")} · {t("channels.voice.recommended")}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                choose("local");
                setPane("configuration");
              }}
            >
              {t("channels.voice.configurationTab")}
            </Button>
          </CardFooter>
        </Card>
        {config &&
          Object.entries(config.profiles).some(
            ([, profile]) => profile?.has_key,
          ) && (
            <div className="flex flex-col gap-3">
              <h3 className="font-medium">
                {t("channels.voice.connectedProviders")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.entries(config.profiles) as [Provider, Profile][])
                  .filter(([, profile]) => profile.has_key)
                  .map(([provider, profile]) => (
                    <Card key={provider} size="sm">
                      <CardHeader>
                        <CardTitle>{providers[provider].name}</CardTitle>
                        <CardDescription>{profile.model}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Badge variant="secondary">
                          {t(
                            config.provider === provider
                              ? "channels.voice.activeProvider"
                              : "channels.voice.configurationReady",
                          )}
                        </Badge>
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy || testing}
                          onClick={() => {
                            editRevision.current += 1;
                            choose(provider);
                            setPane("configuration");
                          }}
                        >
                          {t("channels.voice.editProvider")}
                        </Button>
                        {config.provider === provider && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy || testing}
                            onClick={() => {
                              choose(provider);
                              setPane("test");
                            }}
                          >
                            {t("channels.voice.testTab")}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        <Button
          className="self-start"
          variant="outline"
          onClick={() => {
            choose(
              config?.provider === "local"
                ? "elevenlabs"
                : (config?.provider ?? "elevenlabs"),
            );
            setPane("configuration");
          }}
        >
          {t("channels.voice.addProvider")}
        </Button>
      </TabsContent>
      <TabsContent value="configuration" className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-provider`}>
              {t("channels.voice.transcriptionProvider")}
            </FieldLabel>
            <Select
              value={selected}
              onValueChange={(value) => {
                editRevision.current += 1;
                choose(value as Provider);
                setPane("configuration");
              }}
              disabled={busy || testing}
            >
              <SelectTrigger id={`${id}-provider`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="local">
                    Whisper · {t("channels.voice.local")} ·{" "}
                    {t("channels.voice.recommended")}
                  </SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="compatible">
                    {t("channels.voice.compatibleApi")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              {t("channels.voice.providerScope")}
            </FieldDescription>
          </Field>
        </FieldGroup>
        {!config &&
          (failed ? (
            <Alert variant="destructive">
              <AlertDescription>
                {t("channels.voice.configurationFailed")}
              </AlertDescription>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFailed(false);
                  setReload((value) => value + 1);
                }}
              >
                {t("channels.voice.retry")}
              </Button>
            </Alert>
          ) : (
            <Spinner label={t("channels.loading")} />
          ))}
        {problem && (
          <Alert variant="destructive">
            <AlertDescription>{problem}</AlertDescription>
          </Alert>
        )}
        {!remote && (
          <>
            {config && config.provider !== "local" && (
              <Button
                className="self-start"
                disabled={busy}
                onClick={() => void save()}
              >
                {t("channels.voice.useLocal")}
              </Button>
            )}
            <LocalVoiceTab />
          </>
        )}
        {remote && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{providers[selected].name}</span>
                <Badge variant="secondary">
                  {t(
                    matches
                      ? "channels.voice.configurationReady"
                      : "channels.voice.notSaved",
                  )}
                </Badge>
              </div>
              {providers[selected].keysUrl && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={providers[selected].keysUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <HugeiconsIcon
                      icon={LinkSquare02Icon}
                      data-icon="inline-start"
                    />
                    {t("channels.voice.getApiKey")}
                  </a>
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {t(
                selected === "elevenlabs"
                  ? "channels.voice.elevenlabsKeyHelp"
                  : selected === "groq"
                    ? "channels.voice.groqKeyHelp"
                    : "channels.voice.customKeyHelp",
              )}
            </p>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${id}-model`}>
                  {t("channels.voice.transcriptionModel")}
                </FieldLabel>
                <Input
                  id={`${id}-model`}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={busy || testing}
                  maxLength={200}
                  autoComplete="off"
                />
              </Field>
              {selected === "compatible" ? (
                <Field>
                  <FieldLabel htmlFor={`${id}-endpoint`}>
                    {t("channels.voice.endpoint")}
                  </FieldLabel>
                  <Input
                    id={`${id}-endpoint`}
                    value={endpoint}
                    onChange={(e) => {
                      setEndpoint(e.target.value);
                      setConsent(false);
                    }}
                    readOnly={selected !== "compatible"}
                    disabled={busy || testing}
                    placeholder="https://api.example.com/v1/audio/transcriptions"
                    maxLength={1500}
                    autoComplete="off"
                  />
                  <FieldDescription>
                    {t("channels.voice.endpointHelp")}
                  </FieldDescription>
                </Field>
              ) : (
                <details>
                  <summary className="cursor-pointer text-sm">
                    {t("channels.voice.connectionDetails")}
                  </summary>
                  <p className="break-all pt-2 text-xs text-muted-foreground">
                    {endpoint}
                  </p>
                </details>
              )}
              <Field>
                <FieldLabel htmlFor={`${id}-key`}>
                  {t("channels.voice.apiKey")}
                  {retainedKey && !key && (
                    <Badge variant="secondary">
                      {t("channels.voice.savedCredential")}
                    </Badge>
                  )}
                </FieldLabel>
                <Input
                  id={`${id}-key`}
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  disabled={busy || testing}
                  autoComplete="new-password"
                  maxLength={4096}
                  placeholder={retainedKey ? t("channels.voice.keySaved") : ""}
                />
                <FieldDescription>
                  {t(
                    retainedKey && !key
                      ? "channels.voice.retainedCredentialHelp"
                      : "channels.voice.keyPrivacy",
                  )}
                </FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id={`${id}-consent`}
                  checked={consent}
                  onCheckedChange={(value) => setConsent(value === true)}
                  disabled={busy || testing}
                />
                <FieldLabel htmlFor={`${id}-consent`}>
                  {t("channels.voice.remoteConsent")}
                </FieldLabel>
              </Field>
            </FieldGroup>
            <div className="flex flex-wrap gap-2">
              {config && (
                <Button
                  variant="ghost"
                  disabled={busy || testing}
                  onClick={() => {
                    choose(config.provider);
                    setPane("providers");
                  }}
                >
                  {t("channels.voice.backToProviders")}
                </Button>
              )}
              <Button
                disabled={
                  busy ||
                  testing ||
                  !consent ||
                  !model ||
                  !endpoint ||
                  (!key && !retainedKey)
                }
                onClick={() => void save()}
              >
                {busy && <Spinner label={t("channels.loading")} />}
                {t("channels.voice.saveProvider")}
              </Button>
              {saved && (
                <Button
                  variant="outline"
                  disabled={busy || testing}
                  onClick={() => void save(true)}
                >
                  {t("channels.voice.removeProvider")}
                </Button>
              )}
            </div>
            {providers[selected].helpUrl && (
              <Button asChild variant="link" size="sm" className="self-start">
                <a
                  href={providers[selected].helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("channels.voice.keyGuide")}
                </a>
              </Button>
            )}
          </>
        )}
      </TabsContent>
      <TabsContent value="test" className="flex flex-col gap-4">
        {remote && matches && (
          <Alert>
            <AlertDescription>
              {t(
                verified
                  ? "channels.voice.testPassed"
                  : "channels.voice.savedNotTested",
              )}
            </AlertDescription>
          </Alert>
        )}
        {remote && matches && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>{t("channels.voice.testConnection")}</CardTitle>
              <CardDescription>
                {providers[selected].name} · {model}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {testProblem && (
                <Alert variant="destructive">
                  <AlertDescription>{testProblem}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor={`${id}-sample`}>
                    {t("channels.voice.sampleAudio")}
                  </FieldLabel>
                  <Input
                    id={`${id}-sample`}
                    type="file"
                    accept="audio/*,.ogg,.wav,.mp3,.m4a,.webm,.flac"
                    disabled={testing}
                    onChange={(e) => {
                      setSample(e.target.files?.[0] ?? null);
                      setTranscript("");
                    }}
                  />
                  <FieldDescription>
                    {t("channels.voice.testHelp")}
                  </FieldDescription>
                </Field>
                <Button
                  className="self-start"
                  disabled={!sample || testing}
                  onClick={() => void test()}
                >
                  {testing && <Spinner label={t("channels.voice.testing")} />}
                  {t(
                    testing
                      ? "channels.voice.testing"
                      : testProblem
                        ? "channels.voice.retry"
                        : "channels.voice.testConnection",
                  )}
                </Button>
              </FieldGroup>
              {transcript && (
                <p
                  className="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm"
                  role="status"
                >
                  {transcript}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
