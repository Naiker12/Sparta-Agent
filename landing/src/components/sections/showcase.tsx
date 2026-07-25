import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Monitor, Sparkles, ExternalLink } from 'lucide-react';

export function Showcase() {
  const [selectedShot, setSelectedShot] = useState(0);

  const screenshots = [
    {
      id: 'post',
      title: 'Pantalla Principal de Sparta Agent',
      desc: 'Panel de control con logo Spartan, barra de búsqueda de tareas, sugerencias rápidas y selector de modelos (Ollama, Claude 3.5, Gemini).',
      src: '/post.png',
      badge: 'Main Interface',
    },
    {
      id: 'sparta-escritorio',
      title: 'Icono & Branding Oficial Dark',
      desc: 'Emblema Spartan oficial en alta resolución para el entorno de escritorio.',
      src: '/sparta-escritorio.png',
      badge: 'Dark Branding',
    },
    {
      id: 'readmin',
      title: 'Vista de Sesión & Chat Agéntico',
      desc: 'Historial de conversaciones, sesiones activas y configuración de herramientas MCP.',
      src: '/readmin.png',
      badge: 'Session View',
    },
    {
      id: 'escritorio',
      title: 'Icono & Branding Oficial Light',
      desc: 'Emblema Spartan oficial en alta resolución adaptado para modo claro.',
      src: '/escritorio.png',
      badge: 'Light Branding',
    },
  ];

  const current = screenshots[selectedShot];

  return (
    <section className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <Badge variant="accent" className="px-3.5 py-1 text-xs uppercase font-mono tracking-wider">
            Demostración Visual
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-[var(--text-display)]">
            Interfaz de Grado IDE Profesional
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-secondary)]">
            Una experiencia nativa construida con Electron y React 18, diseñada para máxima productividad.
          </p>
        </div>

        {/* Tab Controls with high contrast */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
          {screenshots.map((shot, idx) => (
            <Button
              key={shot.id}
              variant={selectedShot === idx ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedShot(idx)}
              className="gap-2 text-xs font-mono font-semibold"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>{shot.title}</span>
            </Button>
          ))}
        </div>

        {/* Image Showcase Frame */}
        <Card className="border-[var(--border-strong)] bg-[var(--bg-surface)] overflow-hidden shadow-2xl p-3 sm:p-5">
          <div className="rounded-xl border border-[var(--border-normal)] overflow-hidden bg-[#0C0C10]">
            <div className="bg-[#0F0F14] px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> {current.title} — {current.badge}
              </span>
              <Badge variant="success" className="text-[10px]">Verificado</Badge>
            </div>
            <div className="relative aspect-[16/9] overflow-hidden bg-[#0C0C10] flex items-center justify-center p-2">
              <img
                src={current.src}
                alt={current.title}
                className="max-h-full max-w-full object-contain rounded-lg shadow-xl"
                loading="eager"
              />
            </div>
          </div>
          <div className="p-4 text-center">
            <p className="text-sm text-[var(--text-primary)] font-medium">{current.desc}</p>
          </div>
        </Card>
      </div>
    </section>
  );
}
