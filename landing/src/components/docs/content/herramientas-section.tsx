import { motion } from 'framer-motion';
import { CloudSun, Clock, Globe, Zap } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { CodeBlock } from './code-block';

export function HerramientasSection() {
  return (
    <section className="max-w-4xl">
      <SectionHeader
        eyebrow="Integración con el Mundo Real"
        title="Herramientas Nativas en Tiempo Real"
        description="Sparta Agent incluye utilidades integradas de alta velocidad para acceder al clima global, fecha del sistema y contenido web sin necesidad de APIs externas de pago."
      />

      <div className="mt-8 space-y-6">
        {/* Clima */}
        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CloudSun className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Clima en Vivo (Open-Meteo)</h3>
              <span className="text-xs text-amber-400 font-mono">get_weather</span>
            </div>
          </div>
          <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
            Obtén pronósticos meteorológicos en tiempo real (temperatura, sensación térmica, humedad, viento y precipitación) por geolocalización IP o búsqueda por nombre de ciudad.
          </p>
          <CodeBlock
            title="Respuesta del clima"
            command={`get_weather(location="Madrid")
# -> Condición: Despejado / Soleado ☀️
# -> Temperatura: 22.4 °C (Sensación térmica: 21.8 °C)
# -> Humedad: 48% | Viento: 8.5 km/h`}
          />
        </div>

        {/* Fecha y Hora */}
        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Fecha y Hora Local</h3>
              <span className="text-xs text-blue-400 font-mono">get_current_datetime</span>
            </div>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Permite al modelo situarse temporalmente con respecto a la hora local, día de la semana y zona horaria del usuario.
          </p>
        </div>

        {/* Búsqueda Web */}
        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Búsqueda Web Filtrada</h3>
              <span className="text-xs text-emerald-400 font-mono">web_search</span>
            </div>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Búsqueda web con reintentos automáticos, respeto a dominios permitidos/bloqueados y extracción directa de texto para alimentar respuestas fundamentadas.
          </p>
        </div>
      </div>

      <SectionCta
        title="Protocolo Model Context Protocol (MCP)"
        description="Conecta servidores externos de Notion, Google Drive, Slack y GitHub."
      />
    </section>
  );
}
