/**
 * Sparta Agent - Pantalla de Bienvenida del Hilo (ThreadWelcome)
 * Renderiza el saludo personalizado del usuario según la hora del día,
 * avatar animado rotativo y contenedor del composer inicial.
 */

import {
  useEffect,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { GeneratedAvatar } from "@/components/ui/blobatar-avatar";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useUserProfileStore } from "@/features/profile/stores/user-profile-store";
import { useT, type TranslationKey } from "@/i18n";

export const pickRandom = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export type Welcome = { text: string; sloth: string };

export function buildWelcome(
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  hour: number,
  name: string,
): Welcome {
  const g = (
    key: TranslationKey,
    sloth: string,
    vars?: Record<string, string | number>,
  ): Welcome => ({ text: t(key, vars), sloth });

  const base: Welcome[] = [
    g(
      name ? "chat.welcome.goodToSeeYouNamed" : "chat.welcome.goodToSeeYou",
      "large sloth wave.png",
      name ? { name } : undefined,
    ),
    g("chat.welcome.readyWhenYouAre", "large sloth thumbs.png"),
    g("chat.welcome.default", "sloth magnify final.png"),
    g("chat.welcome.howCanIHelp", "sloth sir large.png"),
  ];

  if (hour >= 4 && hour < 9) {
    const morning = g(
      name ? "chat.welcome.goodMorningNamed" : "chat.welcome.goodMorning",
      "large sloth drink.png",
      name ? { name } : undefined,
    );
    return pickRandom([...base, morning]);
  }
  if (hour >= 17 && hour < 23) {
    const evening: Welcome[] = [
      g(
        name ? "chat.welcome.goodEveningNamed" : "chat.welcome.goodEvening",
        "sloth shy large.png",
        name ? { name } : undefined,
      ),
      g("chat.welcome.whatsOnTonight", "large sloth glasses.png"),
    ];
    return pickRandom(Math.random() < 0.75 ? evening : base);
  }
  if (hour >= 23 || hour < 4) {
    return pickRandom([
      g("chat.welcome.nightOwlMode", "large sloth glasses.png"),
      g("chat.welcome.lateNightIdeas", "large sloth yay.png"),
      g("chat.welcome.upLateWithAnIdea", "large sloth heart.png"),
      g(
        name
          ? "chat.welcome.nightShiftBeginsNamed"
          : "chat.welcome.nightShiftBegins",
        "large sloth drink.png",
        name ? { name } : undefined,
      ),
    ]);
  }
  return pickRandom(base);
}

export const WELCOME_AVATAR_VARIANTS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
] as const;
export const WELCOME_AVATAR_INTERVAL_MS = 4_000;

export const RotatingWelcomeAvatar: FC<{ prefix: string }> = ({ prefix }) => {
  const [variant, setVariant] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;
    const timer = window.setInterval(
      () =>
        setVariant((current) => (current + 1) % WELCOME_AVATAR_VARIANTS.length),
      WELCOME_AVATAR_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  const seed = `${prefix}-${WELCOME_AVATAR_VARIANTS[variant]}`;
  return (
    <GeneratedAvatar
      name={seed}
      className="aui-thread-welcome-logo size-[152px] shrink-0"
      fallback={
        <span className="aui-thread-welcome-logo size-[152px] shrink-0 rounded-full bg-muted" />
      }
    />
  );
};

export interface ThreadWelcomeProps {
  hideComposer?: boolean;
  threadId?: string | null;
  composer?: ReactNode;
}

export const ThreadWelcome: FC<ThreadWelcomeProps> = ({
  hideComposer,
  composer,
}) => {
  const t = useT();
  const incognito = useChatRuntimeStore((s) => s.incognito);
  const displayName = useUserProfileStore((s) => s.displayName);
  const nickname = useUserProfileStore((s) => s.nickname);
  const showGreetingSloth = useUserProfileStore((s) => s.showGreetingSloth);
  const [welcome, setWelcome] = useState<Welcome>({
    text: t("chat.welcome.default"),
    sloth: "sloth magnify final.png",
  });

  useEffect(() => {
    const raw = nickname.trim() || (displayName.trim().split(/\s+/)[0] ?? "");
    const name = raw.length > 20 ? `${raw.slice(0, 20)}…` : raw;
    setWelcome(buildWelcome(t, new Date().getHours(), name));
  }, [t, displayName, nickname]);

  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-start pt-[27.5dvh]">
        <div className="aui-thread-welcome-message flex w-full flex-col justify-center gap-9 px-4">
          <div className="flex flex-col items-center justify-center gap-4">
            {showGreetingSloth && !incognito && (
              <RotatingWelcomeAvatar prefix="sparta-agent" />
            )}
            {incognito && (
              <RotatingWelcomeAvatar prefix="sparta-temporary-chat" />
            )}
            <h1 className="aui-thread-welcome-message-inner unsloth-welcome-title fade-in slide-in-from-bottom-1 animate-in text-3xl tracking-[-0.02em] duration-200">
              {incognito ? t("chat.welcome.temporaryChat") : welcome.text}
            </h1>
          </div>
          {incognito && (
            <p className="aui-thread-welcome-message-inner fade-in -mt-2 animate-in text-center font-heading font-normal text-muted-foreground text-sm duration-200">
              {t("chat.welcome.temporaryChatDescription")}
            </p>
          )}
          {!hideComposer && composer}
        </div>
      </div>
    </div>
  );
};
