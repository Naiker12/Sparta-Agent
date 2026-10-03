import { DemoProfileAvatar } from './demo-profile-avatar';
import { DemoAttachmentInput, DemoAttachmentTray } from './demo-attachments';
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ArrowUp,
  ArrowDown,
  Square,
  Check,
  ChevronDown,
  Code2,
  FileText,
  Folder,
  FolderOpen,
  MessageSquare,
  Search,
  ShieldCheck,
  X,
  Minus,
  PanelLeft,
  Mic,
} from "lucide-react";
import { Button } from "./desktop-demo-button";
import { cn } from "@/lib/utils";
import { WorkspaceSheet, WorkspaceRail, type SheetTab } from './workspace-sheet';
import { ThinkingAvatar } from "../../../../desktop/frontend-spartan/src/components/ui/blobatar-avatar";
import { DesktopStreamingMessage } from './desktop-streaming-message';
import { DemoReasoning } from './demo-reasoning';
import { DemoMessageActions } from './demo-message-actions';
import { DemoToolsMenu, DemoToolPills, DemoReasoningOption, type DemoTools } from './demo-composer-options';
import { DemoToolCall } from './demo-tool-call';
import { useDemoAutoscroll } from './use-demo-autoscroll';
import { DemoMoreMenu, DemoChatRow, DemoPinnedNavigation } from './demo-sidebar-controls';
import { DemoSettingsDialog, type DemoSettingsTab } from './demo-settings-dialog';
import { DEFAULT_DEMO_PREFERENCES, DemoPreferencesProvider, demoAppearanceStyle, type DemoPreferences } from './demo-preferences';
import "streamdown/styles.css";
import "blobatar/motion.css";
import { SpartaMark } from "./sparta-mark";
import desktopLogo from '../../../../desktop/frontend-spartan/public/spartan-logo.svg?url';
import { DemoModelSelector } from './demo-model-selector';
import WorkspaceExplorer, { type WorkspaceView } from "./workspace-explorer";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Folder01Icon,
  BubbleChatIcon,
  BookOpen01Icon,
  ChefHatIcon,
  Globe02Icon,
  Settings02Icon,
  Calendar03Icon,
  Search01Icon,


  PencilEdit02Icon,
  LayoutAlignLeftIcon,
} from "@hugeicons/core-free-icons";

const workspaceSections = [
  { id: "projects", label: "Proyectos", icon: Folder01Icon },
  { id: "recipes", label: "Recetas", icon: ChefHatIcon },
  { id: "api", label: "Monitor API", icon: Globe02Icon },
  { id: "memory", label: "Memoria", icon: BookOpen01Icon },
  { id: "automations", label: "Automatizaciones", icon: Calendar03Icon },
] as const;
const demoModels = [
  { provider: "openrouter", name: "free", reasoning: false, locked: false },
  { provider: "openai", name: "GPT-4.1", reasoning: false, locked: false },
  { provider: "anthropic", name: "Claude Sonnet 4.5", reasoning: true, locked: false },
  { provider: "gemini", name: "Gemini 2.5 Pro", reasoning: true, locked: true },
];

const examples = [
  {
    title: "Tu proyecto",
    prompt: "Revisa el formulario de contacto y mejora sus mensajes de error.",
    files: ["contact-form.tsx", "validation.ts"],
    tool: "Leyendo el formulario y sus validaciones",
    reply:
      "Revisé `contact-form.tsx` y `validation.ts`. El formulario valida los campos, pero el mensaje no explica qué falta.\n\n**Cambio propuesto**\n\n- Mostrar un error específico junto al campo.\n- Conservar las validaciones existentes.\n- Usar un ejemplo de correo válido.\n\nLa propuesta está lista para revisar en el panel de archivos.",
    result: "Propuesta lista para revisar",
    file: "contact-form.tsx",
    lines: [
      "  const emailError = validateEmail(email);",
      "- <span>Entrada inválida</span>",
      "+ <span>Escribe un correo válido, como nombre@equipo.com.</span>",
      "  return <ContactForm errors={errors} />;",
    ],
  },
  {
    title: "Tus documentos",
    prompt: "Resume las decisiones del proyecto y señala los siguientes pasos.",
    files: ["brief.md", "reunion.md"],
    tool: "Consultando los documentos del proyecto",
    reply:
      "El equipo acordó simplificar el formulario y mantener una sola acción principal. El siguiente paso es revisar los mensajes de error y probar el recorrido completo.",
    result: "Resumen con referencias",
    file: "resumen.md",
    lines: [
      "# Decisiones del proyecto",
      "",
      "- Simplificar el formulario [brief.md]",
      "- Una sola acción principal [reunion.md]",
      "",
      "## Siguiente paso",
      "Revisar los mensajes de error y probar el recorrido.",
    ],
  },
  {
    title: "Tu control",
    prompt:
      "Propón un cambio en el formulario. Quiero revisarlo antes de aplicarlo.",
    files: ["contact-form.tsx"],
    tool: "Preparando una propuesta con aprobación manual",
    reply:
      "Preparé una propuesta para el mensaje de error. En este ejemplo, el modo de aprobación es manual: puedes revisar el archivo y decidir si quieres aplicar el cambio.",
    result: "Esperando tu revisión",
    file: "propuesta.diff",
    lines: [
      "Archivo: contact-form.tsx",
      "Alcance: cambiar un mensaje de error",
      "",
      "- Entrada inválida",
      "+ Escribe un correo válido.",
      "",
      "Estado: propuesta pendiente de aprobación",
    ],
  },
];
const stages = [
  "Preparado",
  "Escribiendo solicitud",
  "Revisando contexto",
  "Preparando respuesta",
  "Resultado listo",
];

export default function SpartaPreview() {
  const reducedMotion = useReducedMotion();
  const [example, setExample] = useState(0);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [draft, setDraft] = useState("");
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [panel, setPanel] = useState<"chat" | "file">("chat");
  const [folderOpen, setFolderOpen] = useState(false);
  const folderTrigger = useRef<HTMLButtonElement>(null);
  const folderMenu = useRef<HTMLDivElement>(null);
  const [folder, setFolder] = useState("");
  const [approved, setApproved] = useState(false);
  const [view, setView] = useState<WorkspaceView>("chat");
  useEffect(() => {
    const input = composerInput.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(180, input.scrollHeight)}px`;
  }, [draft, playing, stage, view]);
  const [model, setModel] = useState(0);
  const [reasoning, setReasoning] = useState(true);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [submittedFiles, setSubmittedFiles] = useState<File[]>([]);
  const hasComposerContent = Boolean(draft.trim() || localFiles.length);
  const [chatSearch, setChatSearch] = useState(false);
  const chatSearchInput = useRef<HTMLInputElement>(null);
  const chatSearchTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (chatSearch) chatSearchInput.current?.focus(); else setSearch(''); }, [chatSearch]);
  const [search, setSearch] = useState("");
  const [demoTheme, setDemoTheme] = useState<'light' | 'dark'>('light');
  const [settingsTab, setSettingsTab] = useState<DemoSettingsTab | null>(null);
  const [profileName, setProfileName] = useState('Spartan Agent');
  const [profileAvatar, setProfileAvatar] = useState('Spartan Agent');
  const [collapseThinking, setCollapseThinking] = useState(false);
  const [enterSends, setEnterSends] = useState(true);
  const [preferences, setPreferences] = useState<DemoPreferences>(DEFAULT_DEMO_PREFERENCES);
  const [showWelcomeAvatar, setShowWelcomeAvatar] = useState(true);
  const [reduceDemoMotion, setReduceDemoMotion] = useState(false);
  const [chatNames, setChatNames] = useState(examples.map(item => item.title));
  const [pinnedChats, setPinnedChats] = useState<number[]>([]);
  const [archivedChats, setArchivedChats] = useState<number[]>([]);
  const [projectExpanded, setProjectExpanded] = useState(true);
  const [sheetTab,setSheetTab] = useState<SheetTab>('files');
  const [fileOpenRequest,setFileOpenRequest] = useState(0);
  const [streamChars,setStreamChars] = useState(0);
  const [temporary,setTemporary] = useState(false);
  const [avatarVariant,setAvatarVariant] = useState(1);
  const [permission,setPermission] = useState("auto");
  const [replyOverride, setReplyOverride] = useState<string | null>(null);
  const [replyRound, setReplyRound] = useState(0);
  const [tools, setTools] = useState<DemoTools>({ web: false, code: false, images: false, mcp: false });
  const [cancelled, setCancelled] = useState(false);
  const [queue, setQueue] = useState<{ prompt: string; files: File[] }[]>([]);
  const [history, setHistory] = useState<{ prompt: string; reply: string; files: File[] }[]>([]);
  const [denied, setDenied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [runConfig, setRunConfig] = useState({ model: 0, reasoning: true, permission: 'auto', folder: 'sparta-demo' });
  useEffect(() => {
    if (preferences.themeMode !== 'system') { setDemoTheme(preferences.themeMode); return; }
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDemoTheme(media.matches ? 'dark' : 'light');
    sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync);
  }, [preferences.themeMode]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceDemoMotion(preferences.motion === 'on' || preferences.motion === 'system' && media.matches);
    sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync);
  }, [preferences.motion]);
  const surface = useRef<HTMLDivElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const data = examples[example];
  const reply = replyOverride ?? data.reply;
  const greetingRaw = preferences.nickname.trim() || (profileName.trim() === 'Spartan Agent' ? '' : profileName.trim().split(/\s+/)[0]);
  const greetingName = greetingRaw.length > 20 ? `${greetingRaw.slice(0,20)}…` : greetingRaw;
  const running = playing && stage >= 2 && stage < 4;
  const availablePanels: readonly SheetTab[] = stage < 2 || example === 1 ? ['files'] : example === 2 ? ['files', 'changes'] : ['files', 'changes', 'github', 'agents', 'browser'];
  const waitingApproval = example !== 1 && runConfig.permission === 'ask' && stage === 4 && !approved && !denied;
  const { showJump, jump } = useDemoAutoscroll(conversation, view === 'chat' && stage >= 2);
  function captureRun() { setRunConfig({ model, reasoning, permission, folder: folder || 'sparta-demo' }); }
  const toggleTool = (key: keyof DemoTools) => setTools(value => ({ ...value, [key]: !value[key] }));
  const renderChat = (index: number) => <DemoChatRow key={index} name={chatNames[index]} selected={index === example} pinned={pinnedChats.includes(index)} theme={demoTheme}
    onSelect={() => chooseExample(index)} onPin={() => setPinnedChats(value => value.includes(index) ? value.filter(id => id !== index) : [...value, index])}
    onRename={name => setChatNames(value => value.map((old, id) => id === index ? name : old))} onArchive={() => setArchivedChats(value => [...value, index])} />;
  const chatVisible = (index: number) => !archivedChats.includes(index) && chatNames[index].toLocaleLowerCase().includes(search.toLocaleLowerCase());
  useEffect(()=>{if(reducedMotion||reduceDemoMotion||!visible||!pageVisible)return;const timer=window.setInterval(()=>setAvatarVariant(value=>value%8+1),4000);return ()=>window.clearInterval(timer);},[reducedMotion,reduceDemoMotion,visible,pageVisible]);
  useEffect(()=>{setStreamChars(0);},[stage,example,customPrompt]);
  useEffect(()=>{
    if(stage!==3||!playing||!visible||!pageVisible||reducedMotion||view!=='chat')return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const delay = setTimeout(() => { timer = setInterval(()=>setStreamChars(value=>Math.min(reply.length,value+7+(value%11))),80); }, streamChars === 0 ? 650 : 0);
    return()=>{ clearTimeout(delay); if (timer) clearInterval(timer); };
  },[stage,playing,visible,pageVisible,reducedMotion,reply,view]);
  useEffect(() => {
    if (stage === 3 && streamChars >= reply.length) {
      setStage(4);
      setPlaying(false);
    }
  }, [stage, streamChars, reply.length, example]);


  useEffect(() => {
    setStage(0);
    setPlaying(!reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if (surface.current) observer.observe(surface.current);
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing || !visible || !pageVisible || reducedMotion || view !== 'chat') return;
    if (stage === 4) {
      setPlaying(false);
      return;
    }
    if (stage === 3) return;
    const timer = setTimeout(
      () => {
        if (stage === 1) captureRun();
        setStage((value) => value + 1);
      },
      stage === 0 ? 1400 : stage === 1 ? 2400 : 2600,
    );
    return () => clearTimeout(timer);
  }, [stage, playing, visible, pageVisible, reducedMotion, view, model, reasoning, permission, folder]);

  const takeControl = () => { if (stage < 2) setPlaying(false); };
  useEffect(() => {
    if (stage !== 4 || queue.length === 0 || !visible || !pageVisible || waitingApproval || view !== 'chat') return;
    const timer = window.setTimeout(() => {
      setHistory(value => [...value, { prompt: customPrompt || data.prompt, reply, files: submittedFiles }]);
      setCustomPrompt(queue[0].prompt); setSubmittedFiles(queue[0].files);
      setQueue(value => value.slice(1));
      setReplyOverride(null); setReplyRound(value => value + 1);
      setCancelled(false); setApproved(false); setDenied(false);
      captureRun();
      setStage(reducedMotion ? 4 : 2); setStreamChars(0);
      setPlaying(!reducedMotion); setPanel('chat');
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [stage, queue, visible, pageVisible, customPrompt, data.prompt, reply, reducedMotion, waitingApproval, view, model, reasoning, permission, folder, submittedFiles]);
  useEffect(() => {
    if (!folderOpen) return;
    folderMenu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".folder-picker, .sidebar-project")
      )
        setFolderOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setFolderOpen(false); folderTrigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onEscape);
    };
  }, [folderOpen]);
  function chooseExample(index: number) {
    setLocalFiles([]); setSubmittedFiles([]);
    setMobileSidebarOpen(false);
    if (index === 2) setPermission('ask');
    setRunConfig({ model, reasoning, permission: index === 2 ? 'ask' : permission, folder: folder || 'sparta-demo' });
    setPlaying(false);
    setCancelled(false); setQueue([]); setHistory([]); setDenied(false);
    setReplyOverride(null);
    setReplyRound(value => value + 1);
    setView("chat");
    takeControl();
    setExample(index);
    setStage(4);
    setPanel("chat");
    setDraft("");
    setCustomPrompt("");
    setApproved(false);
    setFolderOpen(false);
  }
  function restart() {
    setLocalFiles([]); setSubmittedFiles([]);
    setMobileSidebarOpen(false);
    setCancelled(false); setQueue([]); setHistory([]); setDenied(false);
    setReplyOverride(null);
    setReplyRound(value => value + 1);
    setView("chat");
    setStage(0);
    setPlaying(false);
    setDraft("");
    setCustomPrompt("");
    setPanel("chat");
    setApproved(false);
    setFolderOpen(false);
  }
  function exportDemoChat() { const url = URL.createObjectURL(new Blob([JSON.stringify({ source: 'landing-demo', history, current: { prompt: customPrompt || data.prompt, reply: stage === 4 ? reply : reply.slice(0, streamChars), files: submittedFiles } }, (_key, value) => value instanceof File ? { name: value.name, size: value.size, type: value.type } : value, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'sparta-chat-demo.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function send() {
    const prompt = draft.trim() || (localFiles.length ? 'Revisa los archivos adjuntos.' : '');
    if (!prompt) return;
    if (running || waitingApproval) { setQueue(value => [...value, { prompt, files: localFiles }]); setLocalFiles([]); setDraft(''); return; }
    setSubmittedFiles(localFiles); setLocalFiles([]);
    if (stage >= 2) setHistory(value => [...value, { prompt: customPrompt || data.prompt, reply: stage === 4 ? reply : reply.slice(0, streamChars), files: submittedFiles }]);
    captureRun();
    if (preferences.autoTitle && stage < 2) setChatNames(old => old.map((name, id) => id === example ? prompt.slice(0, 48) : name));
    setCancelled(false); setDenied(false);
    setReplyOverride(null);
    setReplyRound(value => value + 1);
    takeControl();
    setCustomPrompt(prompt);
    setDraft("");
    setStage(reducedMotion ? 4 : 2);
    setPlaying(!reducedMotion);
    setPanel("chat");
    setFolderOpen(false);
    setApproved(false);
  }

  return (
    <DemoPreferencesProvider prefs={preferences} update={patch => setPreferences(old => ({ ...old, ...patch }))} theme={demoTheme}><div ref={surface} className="preview-wrap">
      <section
        className="sparta-preview"
        data-demo-theme={demoTheme}
        data-reduce-motion={reduceDemoMotion}
        style={demoAppearanceStyle(preferences, demoTheme)}
        aria-label="Demostración interactiva de Sparta Agent"
      >
        <div className="preview-titlebar">
          <span className="demo-window-title">Spartan Agent</span>
          <span className="demo-label">DEMO</span>
          <div className="demo-window-controls" aria-hidden="true"><Minus /><Square /><X /></div>
        </div>
        <div className="preview-workspace" data-sidebar-open={sidebarOpen} data-mobile-sidebar-open={mobileSidebarOpen} data-panel-open={view === 'chat' && panel === 'file'}>
          <aside className="preview-sidebar" aria-label="Proyecto de ejemplo">
            <div className="demo-sidebar-header"><button type="button" className="preview-brand" aria-label="Ir al inicio de la demo" onClick={restart}>
              <span className="demo-desktop-logo" style={{ maskImage: `url(${desktopLogo})` }} />
              <span>SPARTAN AGENT</span>
            </button><div className="demo-sidebar-header-actions">
              <Button ref={chatSearchTrigger} variant="ghost" size="icon" aria-label="Buscar chats de ejemplo" title="Buscar chats" aria-expanded={chatSearch} aria-controls="demo-chat-search" onClick={() => setChatSearch(value => !value)}><HugeiconsIcon icon={Search01Icon} strokeWidth={1.75} /></Button>
              <Button variant="ghost" size="icon" aria-label={mobileSidebarOpen ? 'Ocultar navegación de la demo' : sidebarOpen ? 'Contraer barra lateral' : 'Expandir barra lateral'} title="Barra lateral" onClick={() => { if (mobileSidebarOpen) setMobileSidebarOpen(false); else setSidebarOpen(value => !value); }}><HugeiconsIcon icon={LayoutAlignLeftIcon} strokeWidth={1.75} /></Button>
            </div></div>
            <Button variant="ghost" onClick={restart} aria-label="Nuevo chat" title="Nuevo chat">
              <HugeiconsIcon
                icon={PencilEdit02Icon}
                data-icon="inline-start"
                strokeWidth={1.75}
              />{" "}
              <span>Nuevo chat</span>
            </Button>
            {chatSearch && (
              <input
                ref={chatSearchInput}
                id="demo-chat-search"
                className="demo-chat-search"
                aria-label="Buscar conversaciones de ejemplo"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setChatSearch(false); chatSearchTrigger.current?.focus(); } }}
                placeholder="Buscar conversaciones…"
              />
            )}
            <nav
              className="demo-sidebar-navigation"
              aria-label="Secciones de Sparta"
            >
              <button type="button" title="Chat temporal" aria-label="Chat temporal" aria-pressed={temporary} onClick={()=>{restart();setTemporary(value=>!value);}}><HugeiconsIcon icon={BubbleChatIcon} strokeWidth={1.75} /><span>Chat temporal</span></button>
              <DemoPinnedNavigation active={view} onNavigate={id => { takeControl(); setView(id); setMobileSidebarOpen(false); setFolderOpen(false); }} onExport={exportDemoChat} />
              <button type="button" disabled className="demo-channels" aria-label="Canales, próximamente"><HugeiconsIcon icon={BubbleChatIcon} strokeWidth={1.75} /><span>Canales</span><small>Próximo</small></button>
              <DemoMoreMenu theme={demoTheme} onNavigate={id => { takeControl(); setView(id); setMobileSidebarOpen(false); }} onExport={exportDemoChat} onCustomize={() => { takeControl(); setSettingsTab('appearance'); }} />
            </nav>
            {preferences.showProjects && <><p className="sidebar-label">Proyectos</p>
            <button
              type="button"
              className="sidebar-project"
              aria-expanded={projectExpanded}
              onClick={() => {
                takeControl();
                setProjectExpanded(value => !value);
              }}
            >
              <Folder /> <span>{folder || 'sparta-demo'}</span>
              <ChevronDown />
            </button>
            {projectExpanded && chatVisible(0) && !pinnedChats.includes(0) && <div className="demo-project-chats">{renderChat(0)}</div>}</>}
            {pinnedChats.some(chatVisible) && <><p className="sidebar-label">Fijados</p>{pinnedChats.filter(chatVisible).map(renderChat)}</>}
            <p className="sidebar-label">Recientes</p>
            {(preferences.showProjects ? [1, 2] : [0, 1, 2]).filter(index => chatVisible(index) && !pinnedChats.includes(index)).map(renderChat)}
            {chatSearch && search.trim() && ![0,1,2].some(chatVisible) && <p className="demo-sidebar-empty" role="status">No hay chats que coincidan con tu búsqueda.</p>}
            <div className="sidebar-bottom">
              <DemoProfileAvatar seed={profileAvatar} image={preferences.avatarImage} shape={preferences.avatarShape} size={24} />
              <span>
                {profileName || 'Spartan Agent'}
                <br />
                <small>{preferences.nickname || 'Sparta Agent'}</small>
              </span>
              <button
                type="button"
                aria-label="Abrir configuración de la demo"
                onClick={() => {
                  takeControl();
                  setSettingsTab('profile');
                }}
              >
                <HugeiconsIcon icon={Settings02Icon} strokeWidth={1.75} />
              </button>
            </div>
          </aside>
          <div className={cn("preview-main",view==="chat"&&panel==="file"&&"sheet-mobile-hidden",view==="chat"&&stage<2&&"demo-idle")}>
            <header className="preview-chat-header">
              <Button className="demo-main-sidebar-toggle" variant="ghost" size="icon" aria-label={mobileSidebarOpen ? 'Ocultar navegación de la demo' : 'Mostrar navegación de la demo'} onClick={() => setMobileSidebarOpen(value => !value)}><PanelLeft /></Button>
              <span>
                <MessageSquare />
                {view === "chat"
                  ? chatNames[example]
                  : workspaceSections.find((item) => item.id === view)?.label}
              </span>
</header>
            <div className="preview-mobile-section">
              <label className="sr-only" htmlFor="demo-section-select">
                Sección de Sparta
              </label>
              <select
                id="demo-section-select"
                value={view}
                onChange={(event) => {
                  takeControl();
                  setView(event.target.value as WorkspaceView);
                  setMobileSidebarOpen(false);
                }}
              >
                <option value="chat">Conversación</option>
                {workspaceSections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {view === "chat" ? (
              <>
                <div className="preview-content">
                  <div
                    ref={conversation}
                    className={cn(
                      "preview-conversation",
                      panel === "file" && "mobile-hidden",
                    )}
                  >
                    {stage < 2 ? (
                      <div className="preview-welcome">
                        {showWelcomeAvatar && <DemoProfileAvatar image={preferences.avatarImage} shape={preferences.avatarShape} seed={profileAvatar === 'Spartan Agent' ? (temporary ? "sparta-temporary-chat" : "sparta-agent")+"-0"+(reduceDemoMotion ? 1 : avatarVariant) : profileAvatar} size={152} />}
                        <h3>{temporary ? "Chat temporal" : greetingName ? `Qué bueno verte, ${greetingName}` : "Qué bueno verte"}</h3>

                      </div>
                    ) : (
                      <div className="preview-messages">
                        {history.map((item, index) => <div className="demo-history-turn" key={index}><div className="demo-user-message">{item.prompt}</div><DemoAttachmentTray files={item.files} theme={demoTheme} /><article className="demo-assistant-message"><DesktopStreamingMessage text={item.reply} running={false} messageId={`history:${index}`} /></article></div>)}
                        <div className="demo-user-message">
                          {customPrompt || data.prompt}
                        </div>
                        {submittedFiles.length > 0 && <DemoAttachmentTray files={submittedFiles} theme={demoTheme} />}
                        {stage >= 2 ? (
                          <article className="demo-assistant-message">
                            <div className="assistant-name">
                              <SpartaMark tone={demoTheme === "light" ? "black" : "white"} />
                              Sparta
                            </div>
                            {customPrompt && (
                              <p className="demo-disclosure">
                                Respuesta de ejemplo para explorar este
                                recorrido.
                              </p>
                            )}
                            {stage === 2 && !(runConfig.reasoning && demoModels[runConfig.model].reasoning) && <div className="demo-thinking"><ThinkingAvatar name="sparta-assistant" size={24} fallback={<span />} /><span>{playing ? 'Revisando el contexto…' : 'Revisión en pausa'}</span></div>}
                            {runConfig.reasoning && demoModels[runConfig.model].reasoning && <DemoReasoning key={`${example}:${replyRound}`} messageId={`${example}:${replyRound}`}
                              pending={stage === 2}
                              collapseByDefault={collapseThinking}
                              active={stage === 2 && playing && visible && pageVisible}
                              text={`${data.tool}. Revisaré ${data.files.map(file => `\`${file}\``).join(' y ')} para preparar una respuesta con el contexto de este proyecto. La propuesta se mostrará antes de aplicar cualquier cambio.`} />}
                            {stage >= 3 && <DemoToolCall key={`tool:${example}:${replyRound}`} path={`${runConfig.folder}/${data.files[0]}`} content={example === 1 ? '# Brief del proyecto\n\nSimplificar el formulario y mantener una acción principal.' : 'const emailError = validateEmail(email);\n<span>Entrada inválida</span>\nreturn <ContactForm errors={errors} />;'} running={stage === 3 && streamChars === 0 && playing} cancelled={stage === 3 && streamChars === 0 && cancelled} />}
                            {stage >= 3 && <>
                            <DesktopStreamingMessage messageId={`${example}:${replyRound}:${customPrompt}:reply`}
                              running={stage === 3 && playing && visible && pageVisible && view === 'chat'}
                              text={stage === 4 ? reply : reply.slice(0, streamChars)} />
                            {stage===4 && <button
                              type="button"
                              className="demo-result"
                              onClick={() => {
                                takeControl();
                                setPanel("file");
                                setSheetTab('files');
                                setFileOpenRequest(value=>value+1);
                                setStage(4);
                              }}
                            >
                              <FileText />
                              <span>
                                {data.file}
                                <small>
                                  {approved
                                    ? "Propuesta aprobada en la demo"
                                    : denied ? 'Propuesta rechazada en la demo' : data.result}
                                </small>
                              </span>
                              <Code2 />
                            </button>}
                            {stage === 4 && <DemoMessageActions theme={demoTheme} text={reply} model={demoModels[runConfig.model].name}
                              onRegenerate={() => { captureRun(); setApproved(false); setDenied(false); setCancelled(false); setReplyOverride(null); setReplyRound(value => value + 1); setStage(reducedMotion ? 4 : 2); setStreamChars(0); setPlaying(!reducedMotion); setPanel('chat'); }}
                              onEdit={setReplyOverride}
                              onDelete={() => { takeControl(); setStage(0); setPanel('chat'); setCustomPrompt(''); }}
                              onFork={() => { restart(); setTemporary(true); setDraft(`Continúa a partir de esta respuesta:\n\n${reply}`); }} />}
                            {example !== 1 && runConfig.permission === 'ask' && stage === 4 && (
                              <div className="demo-approval-card" role="group" aria-label="Aprobación de herramienta">
                              <strong><ShieldCheck />{approved ? 'Acción permitida' : denied ? 'Acción rechazada' : 'Esperando aprobación'}</strong>
                              <p>Editar <code>{data.file.endsWith('.diff') ? data.files[0] : data.file}</code> · Propuesta de ejemplo</p>
                              <div>
                              <Button
                                variant="outline"
                                disabled={approved || denied}
                                onClick={() => {
                                  takeControl();
                                  setApproved(true);
                                }}
                              >
                                <ShieldCheck data-icon="inline-start" />
                                {approved
                                  ? "Aprobado en la demo"
                                  : "Permitir"}
                              </Button>
                              <Button variant="ghost" disabled={approved || denied} onClick={() => setDenied(true)}>Rechazar</Button>
                              </div><small>Solo cambia el estado de esta demostración.</small>
                              </div>
                            )}
                            </>}
                            {cancelled && stage < 4 && <div className="demo-continue"><span>Generación detenida</span><Button variant="outline" size="sm" onClick={() => { setCancelled(false); setPlaying(true); }}>Continuar respuesta</Button></div>}
                          </article>
                        ) : (
                          <div className="demo-thinking">
                            {playing ? <ThinkingAvatar name="sparta-assistant" size={24} fallback={<span />} /> : <Square size={16} />}
                            {playing ? "Generando respuesta…" : "Generación detenida"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {showJump && <Button variant="outline" size="icon" className="demo-jump-latest" aria-label="Ir al último mensaje" onClick={jump}><ArrowDown /></Button>}
                </div>
                <form
                  className="preview-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  {queue.length > 0 && <div className="demo-prompt-queue" aria-label="Mensajes en cola"><strong>{queue.length} {queue.length === 1 ? 'mensaje en cola' : 'mensajes en cola'}</strong>{queue.map((prompt, index) => <div key={`${index}:${prompt.prompt}`}><button type="button" aria-label={`Editar mensaje en cola ${index + 1}`} onClick={() => { setDraft(prompt.prompt); setLocalFiles(files => [...files, ...prompt.files]); setQueue(value => value.filter((_, i) => i !== index)); }}>{prompt.prompt}{prompt.files.length > 0 ? ` · ${prompt.files.length} adjuntos` : ''}</button><button type="button" aria-label={`Quitar mensaje en cola ${index + 1}`} onClick={() => setQueue(value => value.filter((_, i) => i !== index))}><X /></button></div>)}</div>}
                  <div className="preview-folder-bar">
                    <div className="folder-picker">
                      <button
                        type="button"
                        aria-expanded={folderOpen}
                        aria-controls="demo-folder-options"
                        ref={folderTrigger}
                        onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); takeControl(); setFolderOpen(true); } }}
                        onClick={() => {
                          takeControl();
                          setFolderOpen((value) => !value);
                        }}
                      >
                        <FolderOpen />
                        {folder || 'Trabajar en una carpeta'}
                        <ChevronDown />
                      </button>
                      {folderOpen && (
                        <div
                          id="demo-folder-options"
                          ref={folderMenu}
                          role="group" aria-label="Carpetas de ejemplo"
                          className="demo-folder-menu"
                        >
                          <p>
                            <Search />
                            Carpetas de ejemplo
                          </p>
                          {["sparta-demo", "mi-proyecto"].map((name) => (
                            <button
                              type="button"
                              key={name}
                              aria-pressed={folder === name}
                              onClick={() => {
                                setFolder(name);
                                setFolderOpen(false);
                                folderTrigger.current?.focus();
                              }}
                            >
                              <Folder />
                              {name}
                              {folder === name && <Check />}
                            </button>
                          ))}
                          <button type="button" aria-pressed={!folder} onClick={() => { setFolder(''); setFolderOpen(false); folderTrigger.current?.focus(); }}><X />Sin carpeta{!folder && <Check />}</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="demo-compose-surface">
                    <DemoAttachmentInput inputRef={attachmentInput} onFiles={files => { takeControl(); setLocalFiles(previous => [...previous, ...files]); }} />
                    {localFiles.length > 0 && <DemoAttachmentTray files={localFiles} theme={demoTheme} onRemove={index => setLocalFiles(files => files.filter((_, i) => i !== index))} />}
                    <label className="sr-only" htmlFor="demo-prompt">
                      Mensaje de ejemplo
                    </label>
                    <textarea
                      ref={composerInput}
                      id="demo-prompt"
                      rows={1}
                      value={playing && stage === 1 ? data.prompt : draft}
                      placeholder="Pregunta lo que sea…"
                      maxLength={20000}
                      onPaste={event => {
                        const text = event.clipboardData.getData('text/plain');
                        if (preferences.pasteThreshold > 0 && text.length >= preferences.pasteThreshold) { event.preventDefault(); takeControl(); setLocalFiles(files => [...files, new File([text], 'texto-pegado.txt', { type: 'text/plain' })]); }
                      }}
                      onFocus={takeControl}
                      onChange={(event) => {
                        takeControl();
                        setDraft(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          enterSends &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          send();
                        }
                      }}
                    />
                    <div className="demo-compose-actions">
                      <DemoToolsMenu theme={demoTheme} tools={tools} onToggle={toggleTool} onAttach={() => { takeControl(); attachmentInput.current?.click(); }} onPrompt={() => setDraft('Revisa el proyecto y prepara una propuesta antes de editar archivos.')} onProject={() => { takeControl(); setView('projects'); }} onPermissions={() => { takeControl(); setSettingsTab('general'); }} onExport={exportDemoChat} />
                      <label className="demo-permission"><ShieldCheck /><select aria-label="Permisos de ejemplo" value={permission} onChange={event=>{takeControl();setPermission(event.target.value);}}><option value="ask">Pedir aprobación</option><option value="auto">Aprobar por mí</option><option value="off">Ejecutar automáticamente</option><option value="full">Acceso completo</option></select></label>
                      <div className="demo-compose-right" role="group" aria-label="Modelo y envío">
<DemoModelSelector theme={demoTheme} models={demoModels} selected={model} onOpen={() => { takeControl(); setFolderOpen(false); }} onSelect={index => { setModel(index); if (demoModels[index].locked) setReasoning(true); }} />
                      {demoModels[model].reasoning && <DemoReasoningOption theme={demoTheme} enabled={reasoning} onChange={setReasoning} model={demoModels[model].name} locked={demoModels[model].locked} />}
                      <button
                        type="button"
                        className="demo-mic"
                        disabled
                        aria-label="Dictado disponible en la aplicación de escritorio"
                        title="El dictado se usa en la aplicación de escritorio"
                      >
                        <Mic strokeWidth={1.75} />
                      </button>
                      <Button
                        size="icon"
                        aria-label={waitingApproval ? "Añadir mensaje a la cola" : running ? hasComposerContent ? "Añadir mensaje a la cola" : "Detener generación de ejemplo" : "Enviar mensaje de ejemplo"}
                        disabled={!running&&!hasComposerContent}
                        type={running && !hasComposerContent ? "button" : "submit"}
                        onClick={() => { if (running && !hasComposerContent) { setPlaying(false); setCancelled(true); } }}
                      >
                        {running && !hasComposerContent ? <Square /> : <ArrowUp />}
                      </Button>
                      </div>
                    </div>
                    <DemoToolPills tools={tools} onToggle={toggleTool} />
                  </div>
                </form>
                {preferences.showDisclaimer && <p className="demo-model-disclaimer">Los LLM pueden cometer errores.</p>}
              </>
            ) : (
              <WorkspaceExplorer view={view} onChat={() => chooseExample(0)} />
            )}
          </div>
          {view==='chat' && panel==='file' && <WorkspaceSheet tab={sheetTab} folder={stage >= 2 ? runConfig.folder : folder || 'sparta-demo'} file={data.file} sourceFiles={data.files} lines={data.lines} approved={approved} fileRequest={fileOpenRequest} onClose={()=>{takeControl();setPanel('chat');}} />}
          {view==='chat' && <WorkspaceRail available={availablePanels} tab={sheetTab} open={panel==='file'} onSelect={tab=>{takeControl();setSheetTab(tab);setPanel(panel==='file'&&sheetTab===tab ? 'chat' : 'file');}} />}
        </div>
      </section>
      <DemoSettingsDialog tab={settingsTab} onTab={setSettingsTab} onClose={() => setSettingsTab(null)} theme={demoTheme} onTheme={setDemoTheme}
        profileName={profileName} onProfileName={setProfileName} avatar={profileAvatar} onAvatar={setProfileAvatar}
        collapseThinking={collapseThinking} onCollapseThinking={setCollapseThinking} enterSends={enterSends} onEnterSends={setEnterSends}
        mcp={tools.mcp} onMcp={value => setTools(old => ({ ...old, mcp: value }))}
        chats={chatNames} archived={archivedChats} onArchive={id => setArchivedChats(old => old.includes(id) ? old : [...old, id])} onRestore={id => setArchivedChats(old => old.filter(item => item !== id))} history={history}
        showAvatar={showWelcomeAvatar} onShowAvatar={setShowWelcomeAvatar} selectedModel={demoModels[model].name}
        compact={!sidebarOpen} onCompact={value => setSidebarOpen(!value)} onReduceMotion={setReduceDemoMotion}
        permission={permission} onPermission={value => { takeControl(); setPermission(value); }}
        onReset={() => { setChatNames(examples.map(item => item.title)); setPinnedChats([]); setArchivedChats([]); restart(); }} />
      <div className="preview-caption">
        <span role="status" aria-live="polite">
          <i />
          {view === "chat" ? stages[stage] : workspaceSections.find(item=>item.id===view)?.label}
          {!playing && stage < 4 ? " · En pausa" : ""}
        </span>
        <span>Vista de la próxima versión · Datos de ejemplo</span>
      </div>
    </div></DemoPreferencesProvider>
  );
}
