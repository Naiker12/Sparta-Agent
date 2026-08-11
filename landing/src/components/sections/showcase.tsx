import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { SectionHeader } from '../ui/section-header';
import { Monitor, Sparkles } from 'lucide-react';
import { getPublicUrl } from '../../lib/utils';

export function Showcase() {
  const [selectedShot, setSelectedShot] = useState(0);

  const screenshots = [
    {
      id: 'post',
      title: 'Pantalla Principal de Sparta Agent',
      desc: 'Panel de control con logo Spartan, barra de búsqueda de tareas, sugerencias rápidas y selector de modelos (Ollama, Claude 3.5, Gemini).',
      src: getPublicUrl('post.png'),
      badge: 'Main Interface',
    },
    {
      id: 'sparta-escritorio',
      title: 'Icono & Branding Oficial Dark',
      desc: 'Emblema Spartan oficial en alta resolución para el entorno de escritorio.',
      src: getPublicUrl('sparta-escritorio.png'),
      badge: 'Dark Branding',
    },
    {
      id: 'readmin',
      title: 'Vista de Sesión & Chat Agéntico',
      desc: 'Historial de conversaciones, sesiones activas y configuración de herramientas MCP.',
      src: getPublicUrl('readmin.png'),
      badge: 'Session View',
    },
    {
      id: 'escritorio',
      title: 'Icono & Branding Oficial Light',
      desc: 'Emblema Spartan oficial en alta resolución adaptado para modo claro.',
      src: getPublicUrl('escritorio.png'),
      badge: 'Light Branding',
    },
  ];

  const current = screenshots[selectedShot];

  return (
    <section id="galeria" className="py-24 md:py-32 relative bg-transparent border-t border-[rgba(186,215,247,0.12)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="DEMOSTRACIÓN VISUAL"
          title="Interfaz de Grado IDE Profesional"
          description="Una experiencia nativa construida con Electron y React 18, diseñada para máxima productividad."
        />

        {/* Tab Controls with high contrast */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10 max-w-4xl mx-auto">
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
        <Card className="border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.02)] overflow-hidden shadow-2xl p-3 sm:p-5 max-w-5xl mx-auto">
          <div className="rounded-xl border border-[rgba(186,215,247,0.12)] overflow-hidden bg-[#0C0C10]">
            <div className="bg-[#111113] px-4 py-3 border-b border-[rgba(186,215,247,0.08)] flex items-center justify-between">
              <span className="text-xs font-mono text-[#d8ecf8] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" /> {current.title} — {current.badge}
              </span>
              <Badge variant="success" className="text-[10px]">Verificado</Badge>
            </div>
            <div className="relative aspect-[16/9] overflow-hidden bg-[#0a0a0a] flex items-center justify-center p-2">
              <img
                src={current.src}
                alt={current.title}
                className="max-h-full max-w-full object-contain rounded-lg shadow-xl"
                loading="eager"
              />
            </div>
          </div>
          <div className="p-4 text-center mt-2">
            <p className="text-sm text-[#c7d3ea] font-medium">{current.desc}</p>
          </div>
        </Card>
      </div>
    </section>
  );
}
