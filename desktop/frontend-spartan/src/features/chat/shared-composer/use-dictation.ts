/**
 * Sparta Agent – useDictation
 *
 * Hook de dictado para el compositor compartido (modo compare).
 * Gestiona el ciclo de vida de la sesión de dictado STT, incluyendo
 * inicio, parada, transcripción final y cancelación por timeout.
 *
 * Responsabilidad única (SRP): abstrae toda la interacción con
 * StudioDictationAdapter para que SharedComposer no tenga estado de audio.
 */

import {
  isStudioDictationAvailable,
  notifyStudioDictationUnavailable,
  StudioDictationAdapter,
} from "@/features/chat/adapters/studio-dictation-adapter";
import type { StudioDictationSession } from "@/features/chat/adapters/studio-web-speech-dictation-adapter";
import { useVoiceSettingsStore } from "@/features/settings/stores/voice-settings-store";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Gestiona la sesión de dictado para el compositor de comparación.
 *
 * @param setText - Setter del texto del compositor. Recibe el fragmento
 *   transcrito y lo apenda al draft actual.
 * @returns Estado del dictado y handlers `start` / `stop`.
 */
export function useDictation(
  setText: (value: string | ((prev: string) => string)) => void,
) {
  // Forzar re-render cuando el usuario cambia el motor de reconocimiento.
  const dictationEngine = useVoiceSettingsStore((s) => s.dictationEngine);
  const [isDictating, setIsDictating] = useState(false);
  // Verdadero mientras el audio final del segmento terminado se transcribe;
  // un segundo clic en ese estado cancela la transcripción pendiente.
  const [isFinalizing, setIsFinalizing] = useState(false);
  const sessionRef = useRef<StudioDictationSession | null>(null);
  const startingRef = useRef(false);
  const finalizingRef = useRef(false);

  const start = useCallback(async () => {
    if (startingRef.current || sessionRef.current) return;
    // Motor no disponible (ej. Firefox): explicar y dirigir al modelo local.
    if (!isStudioDictationAvailable()) {
      notifyStudioDictationUnavailable();
      return;
    }
    startingRef.current = true;

    let session: StudioDictationSession;
    try {
      // Enruta al motor elegido en Configuración de Voz (navegador o modelo STT),
      // respetando el micrófono, idioma y diccionario seleccionados.
      // Compare alimenta dos panes, por lo que los dictados recientes no deben
      // vincularse al hilo activo (chatId: null).
      session = new StudioDictationAdapter({ chatId: null }).listen();
    } catch {
      startingRef.current = false;
      notifyStudioDictationUnavailable();
      return;
    }
    sessionRef.current = session;
    setIsDictating(true);

    // Apenda transcripciones finales; el adaptador ya aplicó el diccionario
    // y registra la sesión en Dictados recientes.
    session.onSpeech((result) => {
      if (!result.isFinal) return;
      const transcript = result.transcript?.trim() ?? "";
      if (transcript) {
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    });
    session.onEnd?.(() => {
      if (sessionRef.current === session) sessionRef.current = null;
      finalizingRef.current = false;
      setIsFinalizing(false);
      setIsDictating(false);
    });
    startingRef.current = false;
  }, [setText]);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    // Un segundo clic mientras el segmento final se transcribe descarta la
    // transcripción pendiente en lugar de dejar el pane bloqueado hasta timeout.
    if (finalizingRef.current) {
      session.cancel();
      if (sessionRef.current === session) sessionRef.current = null;
      finalizingRef.current = false;
      setIsFinalizing(false);
      setIsDictating(false);
      return;
    }
    finalizingRef.current = true;
    setIsFinalizing(true);
    // Mantiene la sesión viva mientras el audio final se transcribe.
    // onEnd limpia ambas banderas una vez que los callbacks de transcripción corren.
    void session.stop().catch((error) => {
      console.error("Could not stop dictation:", error);
      session.cancel();
      if (sessionRef.current === session) sessionRef.current = null;
      finalizingRef.current = false;
      setIsFinalizing(false);
      setIsDictating(false);
    });
  }, []);

  // Limpieza al desmontar: cancela cualquier sesión activa.
  useEffect(() => {
    return () => {
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, []);

  const supported = StudioDictationAdapter.isSupported(dictationEngine);

  return { isDictating, isFinalizing, start, stop, supported };
}
