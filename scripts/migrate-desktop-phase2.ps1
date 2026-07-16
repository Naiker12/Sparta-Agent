$root = "d:\sparta-agent"
Write-Host "=== Phase 2: Migrating electron/ipc, stores, hooks, services ==="

function Copy-File {
    param($src, $dst)
    $srcPath = Join-Path $root $src
    $dstPath = Join-Path $root $dst
    $dstDir = Split-Path $dstPath -Parent
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
    }
    if (Test-Path $srcPath) {
        Copy-Item -Path $srcPath -Destination $dstPath -Force
        Write-Host "  OK $src" -ForegroundColor Green
    } else {
        Write-Host "  ?? $src (not found)" -ForegroundColor Yellow
    }
}

# === IPC BRIDGE (electron/ipc/* + preload) ===
Copy-File "electron\preload.ts" "desktop\ia-sparta-ipc-bridge\src\preload.ts"
Copy-File "electron\ipc\chat.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\chat.ipc.ts"
Copy-File "electron\ipc\file-watcher.ts" "desktop\ia-sparta-ipc-bridge\src\channels\file-watcher.ts"
Copy-File "electron\ipc\filesystem.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\filesystem.channel.ts"
Copy-File "electron\ipc\keymanager.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\keymanager.ipc.ts"
Copy-File "electron\ipc\memory.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\memory.ipc.ts"
Copy-File "electron\ipc\models.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\models.channel.ts"
Copy-File "electron\ipc\permission.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\permission.channel.ts"
Copy-File "electron\ipc\security.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\security.ipc.ts"
Copy-File "electron\ipc\sidecar.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\sidecar.channel.ts"
Copy-File "electron\ipc\skills.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\skills.channel.ts"
Copy-File "electron\ipc\terminal.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\terminal.channel.ts"
Copy-File "electron\ipc\vault.ipc.ts" "desktop\ia-sparta-ipc-bridge\src\channels\vault.ipc.ts"

# === CHAT IPC (electron/ipc/chat/*) ===
Copy-File "electron\ipc\chat\index.ts" "desktop\ia-sparta-chat-ipc\src\index.ts"
Copy-File "electron\ipc\chat\shared.ts" "desktop\ia-sparta-chat-ipc\src\shared.ts"
Copy-File "electron\ipc\chat\on-message.ts" "desktop\ia-sparta-chat-ipc\src\on-message.channel.ts"
Copy-File "electron\ipc\chat\send.ipc.ts" "desktop\ia-sparta-chat-ipc\src\send.channel.ts"
Copy-File "electron\ipc\chat\agent-task.ipc.ts" "desktop\ia-sparta-chat-ipc\src\agent-task.channel.ts"
Copy-File "electron\ipc\chat\audio.ipc.ts" "desktop\ia-sparta-chat-ipc\src\audio.channel.ts"
Copy-File "electron\ipc\chat\editor-diff.ipc.ts" "desktop\ia-sparta-chat-ipc\src\editor-diff.channel.ts"
Copy-File "electron\ipc\chat\mcp-test.ipc.ts" "desktop\ia-sparta-chat-ipc\src\mcp-test.channel.ts"
Copy-File "electron\ipc\chat\memory.ipc.ts" "desktop\ia-sparta-chat-ipc\src\memory.channel.ts"
Copy-File "electron\ipc\chat\sidecar-status.ipc.ts" "desktop\ia-sparta-chat-ipc\src\sidecar-status.channel.ts"

# === VAULT (electron/vault.ts ya copiado manualmente) ===
# vault-store.ts ya existe en ia-sparta-vault/src/

# === STORES ===
Copy-File "src\stores\chat\chat.messages.slice.ts" "desktop\ia-sparta-chat\src\stores\chat.messages.slice.ts"
Copy-File "src\stores\chat\chat.sessions.slice.ts" "desktop\ia-sparta-chat\src\stores\chat.sessions.slice.ts"

# === HOOKS ===
Copy-File "src\hooks\useStreamEvents.ts" "desktop\ia-sparta-stream-events\src\useStreamEvents.ts"
Copy-File "src\hooks\useChatSession.ts" "desktop\ia-sparta-chat\src\hooks\useChatSession.ts"

# === SERVICES ===
Copy-File "src\services\chat.service.ts" "desktop\ia-sparta-chat\src\services\chat.service.ts"
Copy-File "src\services\agents.service.ts" "desktop\ia-sparta-agents\src\services\agents.service.ts"
Copy-File "src\services\mcp.service.ts" "desktop\ia-sparta-mcp\src\mcp.service.ts"
Copy-File "src\services\memory.service.ts" "desktop\ia-sparta-memory\src\memory.service.ts"

# === ANIMATE UI (design system) ===
Copy-File "src\components\animate-ui\primitives\effects\highlight.tsx" "desktop\ia-sparta-design-system\src\primitives\effects\highlight.tsx"

# === I18N ===
Copy-File "src\i18n\es.ts" "desktop\ia-sparta-i18n\src\locales\es.ts"
Copy-File "src\i18n\en.ts" "desktop\ia-sparta-i18n\src\locales\en.ts"

# === CORE ===
Copy-File "src\lib\utils.ts" "desktop\ia-sparta-core\src\utils.ts"

# === ELECTRON MAIN ===
Copy-File "electron\main.ts" "desktop\ia-sparta-app-shell\src\electron-main.ts"
Copy-File "electron\vault.ts" "desktop\ia-sparta-vault\src\vault-store.ts"

Write-Host "=========================================="
Write-Host "PHASE 2 COMPLETE" -ForegroundColor Cyan
Write-Host "=========================================="