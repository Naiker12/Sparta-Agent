"""Shared local transcription lifecycle, independent of HTTP and channel identity."""
import asyncio
import threading

_slot = threading.BoundedSemaphore(1)


async def transcribe_local(raw, model, language, fast, engine, *, sidecar=None, load_stt=None,
                           cancel_event=None, max_audio_seconds=None):
    from . import stt_registry
    sidecar = sidecar if sidecar is not None else stt_registry.sidecar_for(engine)
    load_stt = load_stt if load_stt is not None else stt_registry.load
    owner = cancel_event if cancel_event is not None else threading.Event()
    def run():
        from .stt_sidecar import SttModelBusyError, SttTranscriptionCancelledError
        if not _slot.acquire(blocking=False):
            raise SttModelBusyError('Local transcription is busy.')
        try:
            if owner.is_set():
                raise SttTranscriptionCancelledError('Transcription cancelled.')
            load_stt(model, engine, owner)
            if owner.is_set():
                raise SttTranscriptionCancelledError('Transcription cancelled.')
            kwargs = {'max_audio_seconds': max_audio_seconds} if max_audio_seconds is not None else {}
            return sidecar.transcribe(raw, model, language, fast, owner, **kwargs)
        finally:
            _slot.release()
    try:
        return await asyncio.to_thread(run)
    except asyncio.CancelledError:
        owner.set()
        # Request-owned cancellation must not wait for the shared sidecar lock.
        threading.Thread(target=sidecar.cancel_transcription, args=(owner,), daemon=True).start()
        raise
