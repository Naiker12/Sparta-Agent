import { Database, FileKey, Lock, Shield, SlidersHorizontal } from 'lucide-react';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { DiagramEmbed } from '../diagrams/diagram-embed';
import { CodeBlock } from './code-block';

export function VaultSection() {
  return (
    <section id="vault" className="max-w-4xl">
      <SectionHeader
        eyebrow="Seguridad"
        title="Vault y gestión segura de credenciales"
        description="Las integraciones con proveedores de IA y servicios MCP se apoyan en el paquete ia-sparta-vault. El bridge IPC evita que los tokens de autenticación o API keys se expongan en el DOM o en los prompts del agente."
      />

      <DiagramEmbed caption="Figura 7: Aislamiento del Vault y almacenamiento cifrado en el Proceso Principal">
        <svg viewBox="0 0 800 200" className="w-full h-auto text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="200" rx="12" fill="#09090b" />

          {/* Renderer Process */}
          <rect x="40" y="45" width="210" height="110" rx="10" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
          <text x="60" y="75" fill="#f4f4f5" fontSize="13" fontWeight="600">Renderer Process (UI)</text>
          <text x="60" y="100" fill="#a1a1aa" fontSize="11">• Vista de Configuración</text>
          <text x="60" y="118" fill="#a1a1aa" fontSize="11">• Solo muestra máscaras (••••)</text>
          <text x="60" y="136" fill="#ef4444" fontSize="10">✗ Sin acceso directo a keys</text>

          {/* IPC */}
          <path d="M250 100 L300 100" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 3" />

          {/* Electron Main Process & Vault Enclave */}
          <rect x="300" y="35" width="460" height="130" rx="10" fill="#18181b" stroke="#10b981" strokeWidth="1.5" />
          <text x="320" y="65" fill="#34d399" fontSize="14" fontWeight="600">Main Process Enclave (ia-sparta-vault)</text>

          {/* Sub box 1 */}
          <rect x="320" y="80" width="200" height="70" rx="6" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
          <text x="335" y="105" fill="#e4e4e7" fontSize="12" fontWeight="600">Electron safeStorage</text>
          <text x="335" y="125" fill="#a1a1aa" fontSize="10">Cifrado a nivel de SO (DPAPI/Keychain)</text>

          {/* Sub box 2 */}
          <rect x="540" y="80" width="200" height="70" rx="6" fill="#27272a" stroke="#3f3f46" strokeWidth="1" />
          <text x="555" y="105" fill="#e4e4e7" fontSize="12" fontWeight="600">Invocación Segura</text>
          <text x="555" y="125" fill="#a1a1aa" fontSize="10">Headers inyectados en runtime</text>
        </svg>
      </DiagramEmbed>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <Lock className="mb-4 size-5 text-amber-300" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Cifrado Nativo</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Utiliza las primitivas de cifrado nativas del sistema operativo (DPAPI en Windows, Keychain en macOS, Libsecret en Linux).
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <Shield className="mb-4 size-5 text-emerald-400" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Aislamiento de Memoria</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Las claves se descifran únicamente en el momento exacto del request hacia la API y no persisten en texto plano en la UI.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-5">
          <SlidersHorizontal className="mb-4 size-5 text-blue-400" strokeWidth={1.6} />
          <h3 className="font-medium text-white">Multi-Proveedor</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Administración unificada para OpenAI, Anthropic, Google Gemini, Groq, Ollama y tokens OAuth.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <p className="mb-3 text-sm font-medium text-zinc-400">Canal IPC de Vault en el proceso principal:</p>
        <CodeBlock
          command="vault:set-secret (key, value) -> Encrypted at rest\nvault:get-masked-keys () -> List only names/status"
          title="vault-ipc-contracts"
        />
      </div>

      <SectionCta />
    </section>
  );
}
