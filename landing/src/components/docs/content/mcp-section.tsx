import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SectionHeader } from './section-header';
import { SectionCta } from './section-cta';
import { DiagramEmbed } from '../diagrams/diagram-embed';

export function McpSection() {
  return (
    <section id="servidores-mcp" className="max-w-4xl">
      <SectionHeader
        eyebrow="Extensibilidad"
        title="Conecta herramientas con el Protocolo MCP"
        description="El módulo ia-sparta-mcp incluye el catálogo, el alta de servidores (stdio y SSE), pruebas de conexión, flujo OAuth 2.0 y una vista para inspeccionar herramientas expuestas. Las acciones del agente quedan separadas de los transportes y de la interfaz."
      />

      <DiagramEmbed caption="Figura 4: Flujo de conexión e invocación de herramientas MCP">
        <svg viewBox="0 0 800 220" className="w-full h-auto text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="220" rx="12" fill="#09090b" />

          {/* Sparta Agent App */}
          <rect x="30" y="45" width="210" height="130" rx="10" fill="#18181b" stroke="#3b82f6" strokeWidth="1.2" />
          <text x="50" y="75" fill="#60a5fa" fontSize="14" fontWeight="600">Sparta Agent</text>
          <text x="50" y="100" fill="#a1a1aa" fontSize="11">• UI &amp; Agente</text>
          <text x="50" y="120" fill="#a1a1aa" fontSize="11">• McpProcessManager</text>
          <text x="50" y="140" fill="#a1a1aa" fontSize="11">• Gestor de Sesiones</text>

          {/* Transport / Channel */}
          <rect x="290" y="45" width="220" height="130" rx="10" fill="#18181b" stroke="#f59e0b" strokeWidth="1.2" />
          <text x="310" y="75" fill="#fbbf24" fontSize="14" fontWeight="600">Transporte MCP</text>
          <text x="310" y="100" fill="#a1a1aa" fontSize="11">• JSON-RPC 2.0</text>
          <text x="310" y="120" fill="#a1a1aa" fontSize="11">• stdio / Child Process</text>
          <text x="310" y="140" fill="#a1a1aa" fontSize="11">• Server-Sent Events (SSE)</text>

          {/* External Servers */}
          <rect x="560" y="45" width="210" height="130" rx="10" fill="#18181b" stroke="#10b981" strokeWidth="1.2" />
          <text x="580" y="75" fill="#34d399" fontSize="14" fontWeight="600">Servidores MCP</text>
          <text x="580" y="100" fill="#a1a1aa" fontSize="11">• Google Drive / Gmail</text>
          <text x="580" y="120" fill="#a1a1aa" fontSize="11">• Notion / Slack</text>
          <text x="580" y="140" fill="#a1a1aa" fontSize="11">• Filesystem / Git / DBs</text>

          {/* Arrows */}
          <path d="M240 110 L290 110" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 2" />
          <path d="M510 110 L560 110" stroke="#10b981" strokeWidth="2" />
        </svg>
      </DiagramEmbed>

      <Accordion className="mt-8 rounded-xl border border-white/10 px-5 bg-white/[.02]" defaultValue={['catalogo']}>
        <AccordionItem value="catalogo" className="border-white/10">
          <AccordionTrigger className="text-white hover:text-amber-300 font-medium">
            Catálogo y configuración
          </AccordionTrigger>
          <AccordionContent className="text-zinc-400 leading-6">
            Agrega una configuración de servidor desde la interfaz y valida su disponibilidad antes de
            delegar herramientas al agente. Soporta configuración de variables de entorno y argumentos por servidor.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="ejecucion" className="border-white/10">
          <AccordionTrigger className="text-white hover:text-amber-300 font-medium">
            Ejecución visible
          </AccordionTrigger>
          <AccordionContent className="text-zinc-400 leading-6">
            Las llamadas MCP se representan en los eventos de la sesión con sus argumentos y respuestas, por lo que el usuario puede auditar el trabajo y sus resultados paso a paso.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="oauth" className="border-b-0">
          <AccordionTrigger className="text-white hover:text-amber-300 font-medium">
            Conectores OAuth 2.0
          </AccordionTrigger>
          <AccordionContent className="text-zinc-400 leading-6">
            Los conectores que requieren autorización de terceros (como Google o Notion) se gestionan mediante el diálogo OAuth integrado, manteniendo los tokens cifrados en el Vault local.
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <SectionCta />
    </section>
  );
}
