import { Cloud, KeyRound, Server } from 'lucide-react';
import { motion } from 'framer-motion';
import { getPublicUrl } from '@/lib/utils';
import { SectionHeader } from './content/section-header';
import { SectionCta } from './content/section-cta';

type Provider = {
  id: string;
  label: string;
  kind: 'cloud' | 'local';
  connection: string;
  icon?: string;
};

const providers: Provider[] = [
  { id: 'anthropic', label: 'Anthropic', kind: 'cloud', connection: 'ANTHROPIC_API_KEY', icon: 'anthropic_black.svg' },
  { id: 'openai', label: 'OpenAI', kind: 'cloud', connection: 'OPENAI_API_KEY', icon: 'openai.svg' },
  { id: 'google', label: 'Google', kind: 'cloud', connection: 'GOOGLE_API_KEY', icon: 'gemini.svg' },
  { id: 'groq', label: 'Groq', kind: 'cloud', connection: 'GROQ_API_KEY', icon: 'groq.svg' },
  { id: 'mistral', label: 'Mistral', kind: 'cloud', connection: 'MISTRAL_API_KEY', icon: 'mistral-ai_logo.svg' },
  { id: 'azure', label: 'Azure OpenAI', kind: 'cloud', connection: 'AZURE_OPENAI_API_KEY', icon: 'azure.svg' },
  { id: 'deepseek', label: 'DeepSeek', kind: 'cloud', connection: 'DEEPSEEK_API_KEY', icon: 'deepseek.svg' },
  { id: 'together', label: 'Together AI', kind: 'cloud', connection: 'TOGETHER_API_KEY', icon: 'togetherai_light.svg' },
  { id: 'fireworks', label: 'Fireworks AI', kind: 'cloud', connection: 'FIREWORKS_API_KEY', icon: 'fireworks-ai.svg' },
  { id: 'openrouter', label: 'OpenRouter', kind: 'cloud', connection: 'OPENROUTER_API_KEY', icon: 'openrouter_light.svg' },
  { id: 'cohere', label: 'Cohere', kind: 'cloud', connection: 'COHERE_API_KEY', icon: 'cohere.svg' },
  { id: 'perplexity', label: 'Perplexity', kind: 'cloud', connection: 'PERPLEXITY_API_KEY' },
  { id: 'xai', label: 'xAI', kind: 'cloud', connection: 'XAI_API_KEY', icon: 'xai_light.svg' },
  { id: 'nvidia', label: 'NVIDIA', kind: 'cloud', connection: 'NVIDIA_API_KEY', icon: 'nvidia.svg' },
  { id: 'ollama', label: 'Ollama', kind: 'local', connection: 'http://localhost:11434', icon: 'ollama_light.svg' },
  { id: 'lmstudio', label: 'LM Studio', kind: 'local', connection: 'http://localhost:1234/v1', icon: 'lmstudio_light.svg' },
  { id: 'llamacpp', label: 'llama.cpp', kind: 'local', connection: 'http://localhost:8080/v1' },
  { id: 'custom', label: 'Servidor personalizado', kind: 'local', connection: 'URL compatible configurada por el usuario' },
];

function ProviderCard({ provider }: { provider: Provider }) {
  const Icon = provider.kind === 'cloud' ? Cloud : Server;
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-white/10 bg-white/[.02] p-4 shadow-sm transition-shadow hover:border-white/20"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-zinc-950">
          {provider.icon ? (
            <img className="size-5 object-contain" src={getPublicUrl(`icons/brands/${provider.icon}`)} alt="" />
          ) : (
            <Icon className="size-4 text-zinc-500" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-white">{provider.label}</h3>
          <p className="text-xs text-zinc-400">{provider.kind === 'cloud' ? 'Proveedor cloud' : 'Proveedor local'}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-md bg-zinc-950 px-2.5 py-2 font-mono text-[11px] text-zinc-400">
        <KeyRound className="size-3.5 shrink-0 text-amber-300" />
        <span className="truncate">{provider.connection}</span>
      </div>
    </motion.article>
  );
}

export function ProvidersSection() {
  const cloud = providers.filter((provider) => provider.kind === 'cloud');
  const local = providers.filter((provider) => provider.kind === 'local');

  return (
    <section id="proveedores" className="max-w-4xl">
      <SectionHeader
        eyebrow="Proveedores"
        title="Modelos cloud, locales y configurables"
        description="Sparta Agent guarda la configuración de cada proveedor de forma independiente. Los servicios cloud requieren la clave indicada; los locales se conectan a la URL de su servidor. La disponibilidad de modelos se consulta dinámicamente desde el proveedor configurado."
      />

      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
          <Cloud className="size-4 text-amber-300" /> Cloud · {cloud.length} proveedores
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cloud.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
          <Server className="size-4 text-emerald-400" /> Local y personalizado · {local.length} opciones
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {local.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </div>

      <SectionCta />
    </section>
  );
}
