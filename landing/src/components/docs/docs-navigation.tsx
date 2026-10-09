import type { Root } from "fumadocs-core/page-tree";
import { BookOpen, Rocket, Info, Folder, MessageSquare, Plug, Settings, Layers, Code, Send, ShieldCheck, Mic, Globe, FileText, Wrench } from "lucide-react";
import { catalog } from "./lib/catalog.generated";
import { docsPath, groups } from "./lib/navigation";

const labels: Record<string, string> = {
  index: "Introducción", quickstart: "Inicio rápido", "project/status-and-scope": "Qué incluye Spartan",
  "guides/first-task": "Primera tarea", "guides/workspace": "Espacio de trabajo",
  "core-concepts/chat-vs-agent-mode": "Chat y agente", "core-concepts/models-and-providers": "Proveedores y modelos",
  "features/attachments-and-files": "Archivos adjuntos", "features/multimodal-rag": "Contexto del proyecto",
  "features/deep-research": "Investigación", "features/live-tools": "Herramientas",
  "features/code-execution": "Ejecución de código", "mcp/introduction": "Qué es MCP",
  "mcp/configuration": "Configurar MCP", "mcp/supported-servers": "Servidores MCP", "skills/overview": "Skills",
  "core-concepts/security-and-sandbox": "Seguridad y permisos", "features/api-monitor": "Consumo de API",
  "features/voice-audio": "Voz y transcripción", "features/remote-access": "Acceso remoto",
  "features/recipe-studio": "Recetas", "guides/performance": "Rendimiento", "guides/troubleshooting": "Solucionar problemas",
  "architecture/overview": "Visión general", "architecture/frontend-ui": "Interfaz React",
  "architecture/backend-architecture": "Backend Python", "architecture/ipc-bridge": "Puente de escritorio",
  "development/local-setup": "Entorno local", "development/project-structure": "Estructura del código",
};
const icons = [BookOpen, Rocket, MessageSquare, Plug, Settings, Layers, Code];

export const docsTree: Root = {
  name: "Documentación",
  children: groups.flatMap<Root["children"][number]>((group, index) => {
    const Icon = icons[index] ?? Folder;
    const pages = group.pages.flatMap<Root["children"][number]>(slug => {
      const page = catalog.find(item => item.slug === slug);
      if (!page) return [];
      if (slug === "features/channels") return [{
        type: "folder", name: "Canales", icon: <Send />, defaultOpen: false,
        children: [
          { type: "page", name: "Telegram", icon: <Send />, url: docsPath(slug) },
          ...["Discord", "WhatsApp", "Slack"].map(name => ({ type: "separator" as const, name: <span className="docs-nav-upcoming">{name}<small>Próximamente</small></span> })),
        ],
      }];
      const PageIcon = slug === "quickstart" ? Rocket : slug === "index" ? BookOpen : slug === "project/status-and-scope" ? Info : slug.includes("voice") ? Mic : slug.includes("security") ? ShieldCheck : slug.includes("provider") ? Globe : slug.includes("tools") ? Wrench : FileText;
      return [{ type: "page", name: labels[slug] ?? page.title, icon: <PageIcon />, url: docsPath(slug) }];
    });
    if (index < 2) return pages;
    return [{ type: "folder", name: group.title, icon: <Icon />, defaultOpen: false, children: pages }];
  }),
};
