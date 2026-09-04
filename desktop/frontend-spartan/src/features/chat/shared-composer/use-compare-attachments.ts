/**
 * Sparta Agent – Compare Attachments Hook
 *
 * Hook para la gestión de adjuntos multimedia (imágenes y audio)
 * en el compositor compartido (modo compare).
 */

import { useCallback, useState } from "react";
import { toast } from "@/lib/toast";
import { fileToBase64, getAudioSizeError } from "@/lib/audio-utils";
import { isVideoFile } from "@/lib/video-utils";
import { pasteClipboardFiles } from "@/features/chat/utils/clipboard-files";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import {
  MAX_IMAGE_SIZE,
  type PendingImage,
} from "./composer-ui-helpers";

export interface PendingAudio {
  name: string;
  base64: string;
  contentType: string;
}

export interface UseCompareAttachmentsOptions {
  attachUnavailableReason: string | null;
}

export function useCompareAttachments({
  attachUnavailableReason,
}: UseCompareAttachmentsOptions) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [pendingAudio, setPendingAudio] = useState<PendingAudio | null>(null);

  const setPendingAudioStore = useChatRuntimeStore((s) => s.setPendingAudio);
  const clearPendingAudioStore = useChatRuntimeStore((s) => s.clearPendingAudio);

  const removePendingImage = useCallback((id: string) => {
    setPendingImages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const removePendingAudio = useCallback(() => {
    setPendingAudio(null);
    clearPendingAudioStore();
  }, [clearPendingAudioStore]);

  const clearAttachments = useCallback(() => {
    setPendingImages([]);
    setPendingAudio(null);
    clearPendingAudioStore();
  }, [clearPendingAudioStore]);

  const addFiles = useCallback(
    (files: FileList | readonly File[] | null) => {
      if (!files?.length) return;
      const next: PendingImage[] = [];
      let droppedImageForUnavailable = false;
      let audioSizeError: string | null = null;
      let videoUnsupported = false;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        // Archivos de audio
        if (file.type.match(/^audio\//i)) {
          const sizeError = getAudioSizeError(file.size);
          if (sizeError) {
            audioSizeError ??= sizeError;
            continue;
          }
          fileToBase64(file).then((base64) => {
            setPendingAudio({ name: file.name, base64, contentType: file.type });
            setPendingAudioStore(base64, file.name);
          });
          continue;
        }

        // Archivos de video no soportados en compare
        if (isVideoFile(file)) {
          videoUnsupported = true;
          continue;
        }

        // Archivos de imagen
        if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/i)) continue;
        if (file.size > MAX_IMAGE_SIZE) continue;
        if (attachUnavailableReason) {
          droppedImageForUnavailable = true;
          continue;
        }
        next.push({ id: crypto.randomUUID(), file });
      }

      if (droppedImageForUnavailable && attachUnavailableReason) {
        toast.error(attachUnavailableReason);
      }
      if (audioSizeError) {
        toast.error(audioSizeError);
      }
      if (videoUnsupported) {
        toast.error("Video can't be attached in compare mode", {
          description: "Open a single chat with a video-capable model instead.",
        });
      }
      setPendingImages((prev) => [...prev, ...next]);
    },
    [setPendingAudioStore, attachUnavailableReason],
  );

  const handleFilePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      pasteClipboardFiles(
        event,
        async (files) => {
          const supported = files.some(
            (file) =>
              file.type.match(/^audio\//i) ||
              (file.type.match(/^image\/(jpeg|png|webp|gif)$/i) &&
                file.size <= MAX_IMAGE_SIZE),
          );
          if (!supported) throw new Error("Unsupported compare attachment");
          addFiles(files);
        },
        () =>
          toast.error("Could not paste files.", {
            description:
              "Compare supports images and audio within the attachment size limits.",
          }),
      );
    },
    [addFiles],
  );

  return {
    pendingImages,
    setPendingImages,
    pendingAudio,
    setPendingAudio,
    addFiles,
    removePendingImage,
    removePendingAudio,
    clearAttachments,
    handleFilePaste,
  };
}
