import { Cloud, KeyRound, Server } from 'lucide-react';
import { motion } from 'framer-motion';
import { getPublicUrl } from '@/lib/utils';

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
    <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} whileHover={{ y: -2 }} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/[.02]">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950">
          {provider.icon ? <img className="size-5 object-contain" src={getPublicUrl(`icons/brands/${provider.icon}`)} alt="" /> : <Icon className="size-4 text-zinc-500" />}
        </div>
        <div className="min-w-0"><h3 className="truncate text-sm font-medium">{provider.label}</h3><p className="text-xs text-zinc-500 dark:text-zinc-400">{provider.kind === 'cloud' ? 'Proveedor cloud' : 'Proveedor local'}</p></div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-md bg-zinc-50 px-2.5 py-2 font-mono text-[11px] text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400"><KeyRound className="size-3.5 shrink-0" /><span className="truncate">{provider.connection}</span></div>
    </motion.article>
  );
}

export function ProvidersSection() {
  const cloud = providers.filter((provider) => provider.kind === 'cloud');
  const local = providers.filter((provider) => provider.kind === 'local');
  return (
    <section id="proveedores" className="scroll-mt-24 mt-20 max-w-4xl border-t border-zinc-200 pt-12 dark:border-white/10">
      <p className="text-sm font-medium text-zinc-500">Proveedores</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">Modelos cloud, locales y configurables</h2>
      <p className="mt-4 max-w-2xl leading-7 text-zinc-600 dark:text-zinc-400">Sparta Agent guarda la configuración de cada proveedor de forma independiente. Los servicios cloud requieren la clave indicada; los locales se conectan a la URL de su servidor. La disponibilidad de modelos se consulta desde el proveedor configurado.</p>
      <div className="mt-8"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Cloud className="size-4 text-zinc-500" /> Cloud · {cloud.length} proveedores</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cloud.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}</div></div>
      <div className="mt-8"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Server className="size-4 text-zinc-500" /> Local y personalizado · {local.length} opciones</div><div className="grid gap-3 sm:grid-cols-2">{local.map((provider) => <ProviderCard key={provider.id} provider={provider} />)}</div></div>
    </section>
  );
}
