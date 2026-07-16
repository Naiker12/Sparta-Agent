# 24 — Arquitectura modular Web AI (Sparta Agent)

> Fase 2 del rediseño estructural. Aplica el **mismo método** que la fase 1 (`docs/23-arquitectura-modular-desktop.md`), pero ahora para la versión web de la app.

**Pre-requisito:** Fase 1 validada y funcionando.

---

## 1. Qué es "Web AI"

La versión web de Sparta Agent que corre en el navegador, sin Electron. Incluye:

- **Frontend:** React + Vite (mismo código UI que desktop, pero sin IPC)
- **Backend:** API REST/WebSocket en Node.js o Python
- **IA:** Llamadas directas a proveedores AI (OpenAI, Anthropic, etc.) sin sidecar Python local
- **Estado:** Zustand stores (misma lógica que desktop)

---

## 2. Estructura propuesta

```
web/
│
├── ia-sparta-app/                    # App raíz React + routing
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── App.tsx
│       └── routes/
│
├── ia-sparta-chat/                   # Misma lógica que desktop/ia-sparta-chat
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       └── services/
│
├── ia-sparta-agents/                 # Igual que desktop
├── ia-sparta-editor/                 # Igual que desktop
├── ia-sparta-terminal/               # Sin node-pty, usa xterm + WebSocket
├── ia-sparta-mcp/                    # Igual que desktop
├── ia-sparta-memory/                 # Igual que desktop
├── ia-sparta-permission/             # Igual que desktop
├── ia-sparta-providers/              # Igual que desktop
├── ia-sparta-settings/               # Igual que desktop
├── ia-sparta-skills/                 # Igual que desktop
├── ia-sparta-channels/               # Igual que desktop
├── ia-sparta-projects/               # Igual que desktop
├── ia-sparta-shell-layout/           # Igual que desktop
├── ia-sparta-design-system/          # Igual que desktop
├── ia-sparta-i18n/                   # Igual que desktop
├── ia-sparta-core/                   # Igual que desktop
│
└── runtime/
    └── ia-sparta-api-server/         # Backend API (Node.js o Python)
        ├── package.json
        └── src/
            ├── index.ts
            ├── routes/
            ├── controllers/
            └── services/
```

---

## 3. Diferencias clave vs Desktop

| Aspecto | Desktop | Web AI |
|---|---|---|
| **Runtime** | Electron | Navegador |
| **IPC** | electron/ipc | REST/WebSocket API |
| **Sidecar** | Python local | API server remoto |
| **Terminal** | node-pty | xterm + WebSocket |
| **Storage** | safeStorage + archivos | IndexedDB + API |
| **Build** | electron-builder | Vite + deploy |

---

## 4. Plan de migración

1. **Crear estructura base** `web/` con package.json raíz
2. **Migrar módulos UI puros** (design-system, i18n, core) — sin cambios
3. **Migrar módulos con lógica** (chat, agents, editor, etc.) — adaptar servicios
4. **Crear API server** `runtime/ia-sparta-api-server/`
5. **Reemplazar IPC por fetch/WebSocket** en servicios
6. **Configurar Vite para SPA** con routing
7. **Tests de integración** web vs desktop

---

## 5. Siguiente paso

Una vez validada esta base, seguir con **Fase 3: Mobile** (React Native + mismas módulos).