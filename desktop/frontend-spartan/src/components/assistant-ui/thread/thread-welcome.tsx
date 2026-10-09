/**
 * Spartan - Pantalla de Bienvenida del Hilo (ThreadWelcome)
 * Renderiza el saludo personalizado del usuario según la hora del día,
 * mascota compartida con el perfil y contenedor del composer inicial.
 */

import { ProfileChatAvatar, useUserProfileStore } from "@/features/profile";
import { useChatRuntimeStore } from "@/features/chat";
import { type TranslationKey, useT } from "@/i18n";
import { type FC, type ReactNode, useEffect, useState } from "react";

export const pickRandom = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export type Welcome = { text: string };

export function buildWelcome(
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  hour: number,
  name: string,
): Welcome {
  const g = (
    key: TranslationKey,
    vars?: Record<string, string | number>,
  ): Welcome => ({ text: t(key, vars) });

  const base: Welcome[] = [
    g(
      name ? "chat.welcome.goodToSeeYouNamed" : "chat.welcome.goodToSeeYou",
      name ? { name } : undefined,
    ),
    g("chat.welcome.readyWhenYouAre"),
    g("chat.welcome.default"),
    g("chat.welcome.howCanIHelp"),
  ];

  if (hour >= 4 && hour < 9) {
    const morning = g(
      name ? "chat.welcome.goodMorningNamed" : "chat.welcome.goodMorning",
      name ? { name } : undefined,
    );
    return pickRandom([...base, morning]);
  }
  if (hour >= 17 && hour < 23) {
    const evening: Welcome[] = [
      g(
        name ? "chat.welcome.goodEveningNamed" : "chat.welcome.goodEvening",
        name ? { name } : undefined,
      ),
      g("chat.welcome.whatsOnTonight"),
    ];
    return pickRandom(Math.random() < 0.75 ? evening : base);
  }
  if (hour >= 23 || hour < 4) {
    return pickRandom([
      g("chat.welcome.nightOwlMode"),
      g("chat.welcome.lateNightIdeas"),
      g("chat.welcome.upLateWithAnIdea"),
      g(
        name
          ? "chat.welcome.nightShiftBeginsNamed"
          : "chat.welcome.nightShiftBegins",
        name ? { name } : undefined,
      ),
    ]);
  }
  return pickRandom(base);
}

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
  });

  useEffect(() => {
    const raw = nickname.trim() || (displayName.trim().split(/\s+/)[0] ?? "");
    const name = raw.length > 20 ? `${raw.slice(0, 20)}…` : raw;
    const frame = requestAnimationFrame(() => setWelcome(buildWelcome(t, new Date().getHours(), name)));
    return () => cancelAnimationFrame(frame);
  }, [t, displayName, nickname]);

  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[48rem] grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-start pt-[27.5dvh]">
        <div className="aui-thread-welcome-message flex w-full flex-col justify-center gap-9 px-4">
          <div className="flex flex-col items-center justify-center gap-4">
            {showGreetingSloth && !incognito && (
              <ProfileChatAvatar
                interactive
                className="aui-thread-welcome-logo size-[152px] shrink-0"
              />
            )}
            {incognito && (
              <ProfileChatAvatar
                interactive
                className="aui-thread-welcome-logo size-[152px] shrink-0"
              />
            )}
            <h1 className="aui-thread-welcome-message-inner sparta-welcome-title fade-in slide-in-from-bottom-1 animate-in text-3xl tracking-[-0.02em] duration-200">
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
