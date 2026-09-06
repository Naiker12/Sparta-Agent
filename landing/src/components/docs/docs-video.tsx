import { useState } from 'react';
import { Play, FileText, ChevronDown, ChevronUp, Clock, AlertCircle } from 'lucide-react';
import { videoCatalog } from './lib/videos';

export interface DocsVideoProps {
  id: string;
  className?: string;
}

export function DocsVideo({ id, className = '' }: DocsVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const entry = videoCatalog[id];

  // Only render if video is registered and marked ready
  if (!entry || entry.status !== 'ready') {
    return null;
  }

  const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  const videoSrc = `${basePath}${entry.src}`;
  const posterSrc = `${basePath}${entry.poster}`;
  const captionsSrc = entry.captions ? `${basePath}${entry.captions}` : undefined;

  return (
    <figure
      className={`my-6 overflow-hidden rounded-xl border border-[#36382f] bg-[#191a17] text-[#edede7] shadow-lg ${className}`}
      aria-labelledby={`video-title-${id}`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[#111210]">
        {!isPlaying ? (
          <div className="group relative h-full w-full">
            <img
              src={posterSrc}
              alt={`Vista previa de: ${entry.title}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
              loading="lazy"
            />
            {/* Dark overlay with play prompt */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-4 transition-colors group-hover:bg-black/30">
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                className="flex items-center gap-2.5 rounded-full border border-[#dfd68b]/40 bg-[#111210]/90 px-5 py-3 text-sm font-medium text-[#edede7] backdrop-blur-sm transition-all hover:scale-105 hover:border-[#dfd68b] hover:bg-[#333326] focus:outline-none focus:ring-2 focus:ring-[#dfd68b]"
                aria-label={`Reproducir video: ${entry.title}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dfd68b] text-[#111210]">
                  <Play size={16} className="ml-0.5 fill-current" />
                </div>
                <span>Reproducir tutorial</span>
                <span className="flex items-center gap-1 rounded bg-[#292a25] px-2 py-0.5 text-xs text-[#bfc1b5]">
                  <Clock size={12} />
                  {entry.duration}
                </span>
              </button>
            </div>
            {/* Top metadata pill */}
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-[#111210]/80 px-2.5 py-1 text-xs text-[#bfc1b5] backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#dfd68b]" />
              <span>{entry.title}</span>
            </div>
          </div>
        ) : (
          <video
            controls
            autoPlay
            playsInline
            preload="metadata"
            poster={posterSrc}
            className="h-full w-full object-contain"
          >
            <source src={videoSrc} type="video/mp4" />
            {captionsSrc && (
              <track
                kind="subtitles"
                src={captionsSrc}
                srcLang="es"
                label="Español"
                default
              />
            )}
            Tu navegador no soporta reproducción de video HTML5.
          </video>
        )}
      </div>

      {/* Caption & note banner */}
      <figcaption className="border-t border-[#36382f] bg-[#141512] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#bfc1b5]">
            <AlertCircle size={14} className="text-[#dfd68b]" />
            <span>{entry.note || 'Video tutorial de apoyo para la guía.'}</span>
          </div>

          {entry.transcript && entry.transcript.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTranscript(prev => !prev)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[#dfd68b] hover:bg-[#292a25] focus:outline-none"
              aria-expanded={showTranscript}
              aria-controls={`transcript-${id}`}
            >
              <FileText size={13} />
              <span>{showTranscript ? 'Ocultar transcripción' : 'Ver transcripción'}</span>
              {showTranscript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>

        {/* Expandable transcript */}
        {showTranscript && entry.transcript && (
          <div
            id={`transcript-${id}`}
            className="mt-3 space-y-2 border-t border-[#36382f] pt-3 text-xs text-[#bfc1b5]"
          >
            <p className="font-semibold text-[#edede7]">Transcripción por capítulos:</p>
            <div className="grid gap-2">
              {entry.transcript.map(item => (
                <div
                  key={item.time}
                  className="rounded bg-[#191a17] p-2.5 border border-[#2a2b25]"
                >
                  <div className="flex items-center gap-2 font-mono text-[11px] text-[#dfd68b]">
                    <span>{item.time}</span>
                    <span>·</span>
                    <span className="font-sans font-medium text-[#edede7]">{item.chapter}</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-[#bfc1b5]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </figcaption>
    </figure>
  );
}

export default DocsVideo;
