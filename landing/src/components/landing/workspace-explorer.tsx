import {
  BookOpen,
  CalendarClock,
  ChefHat,
  Check,
  FileCode,
  FileText,
  FolderOpen,
  Globe,
  Pause,
  Play,
  ArrowUpRight,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./desktop-demo-button";
import { getPublicUrl } from "@/lib/utils";
import { DemoAutomationRun } from './demo-automations';

export type WorkspaceView =
  | "channels"
  | "chat"
  | "projects"
  | "memory"
  | "automations"
  | "api"
  | "recipes";
const screens = {
  projects: {
    title: "Proyectos",
    subtitle: "Carpetas, conversaciones y archivos en un mismo lugar.",
    icon: FolderOpen,
    guide: "features/attachments-and-files",
  },
  memory: {
    title: "Memoria",
    subtitle:
      "Revisa el contexto que quieres conservar para próximas conversaciones.",
    icon: BookOpen,
    guide: "features/multimodal-rag",
  },
  automations: {
    title: "Automatizaciones",
    subtitle: "Tareas programadas y resultados que puedes revisar.",
    icon: CalendarClock,
    guide: "guides/first-task",
  },
  api: {
    title: "Monitor API",
    subtitle: "Consulta tus conexiones y el uso de tus proveedores.",
    icon: Globe,
    guide: "features/api-monitor",
  },
  recipes: {
    title: "Recetas",
    subtitle: "Organiza recorridos de trabajo que puedes volver a ejecutar.",
    icon: ChefHat,
    guide: "features/recipe-studio",
  },
};
export default function WorkspaceExplorer({
  view,
  onChat,
  onAutomationChat,
}: {
  view: Exclude<WorkspaceView, "chat" | "channels">;
  onChat: () => void;
  onAutomationChat: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [paused, setPaused] = useState(false);
  const screen = screens[view];
  const Icon = screen.icon;
  return (
    <section
      className="workspace-explorer"
      aria-label={`${screen.title} de ejemplo`}
    >
      <div className="explorer-heading">
        <span>
          <Icon />
        </span>
        <div>
          <h3>{screen.title}</h3>
          <p>{screen.subtitle}</p>
        </div>
      </div>
      {view === "projects" && (
        <div className="explorer-card">
          <div className="explorer-card-title">
            <FolderOpen />
            <strong>sparta-demo</strong>
            <span>3 archivos</span>
          </div>
          <p>
            Un proyecto de ejemplo para explorar el chat y el panel de archivos.
          </p>
          <div className="explorer-file-list">
            <span>
              <FileCode />
              contact-form.tsx
            </span>
            <span>
              <FileCode />
              validation.ts
            </span>
            <span>
              <FileText />
              brief.md
            </span>
          </div>
          <Button variant="outline" onClick={onChat}>
            Abrir conversación <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>
      )}
      {view === "memory" && (
        <div className="explorer-card">
          <div className="explorer-card-title">
            <BookOpen />
            <strong>Preferencia del proyecto</strong>
            <span>{reviewed ? "Revisado" : "Por revisar"}</span>
          </div>
          <p>Usar mensajes de error claros, breves y en español.</p>
          <div className="explorer-meta">
            Origen: conversación del proyecto · Memoria de ejemplo
          </div>
          <Button
            variant="outline"
            disabled={reviewed}
            onClick={() => setReviewed(true)}
          >
            <Check data-icon="inline-start" />
            {reviewed ? "Revisado en la demo" : "Marcar como revisado"}
          </Button>
        </div>
      )}
      {view === "automations" && <DemoAutomationRun onChat={onAutomationChat} />}
      {view === "api" && (
        <>
          <div className="explorer-stats">
            <div>
              <span>Solicitudes</span>
              <strong>24</strong>
            </div>
            <div>
              <span>Tokens de ejemplo</span>
              <strong>18.2k</strong>
            </div>
            <div>
              <span>Proveedores</span>
              <strong>3</strong>
            </div>
          </div>
          <div className="explorer-card api-example-list">
            {[
              ["openai", "OpenAI"],
              ["anthropic", "Anthropic"],
              ["gemini", "Gemini"],
            ].map(([id, name]) => (
              <div key={id}>
                <img src={getPublicUrl(`brand/${id}.svg`)} alt="" />
                <strong>{name}</strong>
                <span>
                  <i />
                  Conexión de ejemplo
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {view === "recipes" && (
        <div className="explorer-card">
          <div className="explorer-card-title">
            <ChefHat />
            <strong>Revisión de un formulario</strong>
            <span>3 pasos</span>
          </div>
          <div className="recipe-steps">
            <span>
              <i>1</i>Leer el contexto del proyecto
            </span>
            <span>
              <i>2</i>Preparar una propuesta de cambio
            </span>
            <span>
              <i>3</i>Revisar el resultado
            </span>
          </div>
          <Button variant="outline" onClick={onChat}>
            Explorar en el chat <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>
      )}
      <div className="explorer-note">
        Datos de ejemplo. Estas acciones solo cambian la demo.
        <a href={getPublicUrl(`?docs=${screen.guide}`)}>
          Ver guía <ArrowUpRight />
        </a>
      </div>
    </section>
  );
}
