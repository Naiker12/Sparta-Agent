$root = "d:\sparta-agent"
Write-Host "=== Migrating files to desktop/ ==="

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

# === CHAT ===
Copy-File "src\components\chat\ChatArea.tsx" "desktop\ia-sparta-chat\src\components\ChatArea.tsx"
Copy-File "src\components\chat\HeroScreen.tsx" "desktop\ia-sparta-chat\src\components\HeroScreen.tsx"
Copy-File "src\components\chat\MarkdownRenderer.tsx" "desktop\ia-sparta-chat\src\components\MarkdownRenderer.tsx"
Copy-File "src\components\chat\MessageActionsDialog.tsx" "desktop\ia-sparta-chat\src\components\MessageActionsDialog.tsx"
Copy-File "src\components\chat\MessageBubble.tsx" "desktop\ia-sparta-chat\src\components\MessageBubble.tsx"
Copy-File "src\components\chat\MessageList.tsx" "desktop\ia-sparta-chat\src\components\MessageList.tsx"
Copy-File "src\components\chat\SpartaIcon.tsx" "desktop\ia-sparta-chat\src\components\SpartaIcon.tsx"
Copy-File "src\components\chat\TokenUsagePill.tsx" "desktop\ia-sparta-chat\src\components\TokenUsagePill.tsx"
Copy-File "src\components\input\ChatInput.tsx" "desktop\ia-sparta-chat\src\components\input\ChatInput.tsx"
Copy-File "src\components\input\AttachMenu.tsx" "desktop\ia-sparta-chat\src\components\input\AttachMenu.tsx"
Copy-File "src\components\input\AudioWaveform.tsx" "desktop\ia-sparta-chat\src\components\input\AudioWaveform.tsx"
Copy-File "src\components\input\ConnectorsSubmenu.tsx" "desktop\ia-sparta-chat\src\components\input\ConnectorsSubmenu.tsx"
Copy-File "src\components\input\ModelPicker.tsx" "desktop\ia-sparta-chat\src\components\input\ModelPicker.tsx"
Copy-File "src\components\input\ModeSwitch.tsx" "desktop\ia-sparta-chat\src\components\input\ModeSwitch.tsx"
Copy-File "src\components\input\SlashCommandMenu.tsx" "desktop\ia-sparta-chat\src\components\input\SlashCommandMenu.tsx"
Copy-File "src\components\input\VoiceRecordButton.tsx" "desktop\ia-sparta-chat\src\components\input\VoiceRecordButton.tsx"
Copy-File "src\components\chat\reasoning\" "desktop\ia-sparta-chat\src\components\reasoning\"

# === AGENTS ===
Copy-File "src\components\agents\AgentsPanel.tsx" "desktop\ia-sparta-agents\src\components\AgentsPanel.tsx"
Copy-File "src\components\agents\AgentActivityPanel.tsx" "desktop\ia-sparta-agents\src\components\AgentActivityPanel.tsx"
Copy-File "src\components\agents\PlanWatchPane.tsx" "desktop\ia-sparta-agents\src\components\PlanWatchPane.tsx"
Copy-File "src\components\agents\SubagentWatchPane.tsx" "desktop\ia-sparta-agents\src\components\SubagentWatchPane.tsx"

# === EDITOR ===
Copy-File "src\components\editor\EditorPanel.tsx" "desktop\ia-sparta-editor\src\EditorPanel.tsx"
Copy-File "src\components\editor\DiffReviewTab.tsx" "desktop\ia-sparta-editor\src\diff\DiffReviewTab.tsx"
Copy-File "src\components\editor\EditorBreadcrumb.tsx" "desktop\ia-sparta-editor\src\EditorBreadcrumb.tsx"
Copy-File "src\components\editor\EditorDialogs.tsx" "desktop\ia-sparta-editor\src\EditorDialogs.tsx"
Copy-File "src\components\editor\EditorEmptyState.tsx" "desktop\ia-sparta-editor\src\EditorEmptyState.tsx"
Copy-File "src\components\editor\EditorSkeleton.tsx" "desktop\ia-sparta-editor\src\EditorSkeleton.tsx"
Copy-File "src\components\editor\EditorStatusBar.tsx" "desktop\ia-sparta-editor\src\EditorStatusBar.tsx"
Copy-File "src\components\editor\EditorTabs.tsx" "desktop\ia-sparta-editor\src\EditorTabs.tsx"
Copy-File "src\components\editor\EditorToolbar.tsx" "desktop\ia-sparta-editor\src\EditorToolbar.tsx"
Copy-File "src\components\editor\FileTreeItem.tsx" "desktop\ia-sparta-editor\src\file-tree\FileTreeItem.tsx"
Copy-File "src\components\editor\FileTreeSidebar.tsx" "desktop\ia-sparta-editor\src\file-tree\FileTreeSidebar.tsx"
Copy-File "src\components\editor\InlineAskWidget.tsx" "desktop\ia-sparta-editor\src\InlineAskWidget.tsx"
Copy-File "src\components\editor\MonacoEditor.tsx" "desktop\ia-sparta-editor\src\MonacoEditor.tsx"
Copy-File "src\components\editor\ProjectFolderPicker.tsx" "desktop\ia-sparta-editor\src\ProjectFolderPicker.tsx"

# === TERMINAL ===
Copy-File "src\components\terminal\TerminalWorkspace.tsx" "desktop\ia-sparta-terminal\src\TerminalWorkspace.tsx"
Copy-File "src\components\terminal\PersistentTerminal.tsx" "desktop\ia-sparta-terminal\src\PersistentTerminal.tsx"
Copy-File "src\components\terminal\TerminalSlot.tsx" "desktop\ia-sparta-terminal\src\TerminalSlot.tsx"
Copy-File "src\components\terminal\agent-terminal-stream.ts" "desktop\ia-sparta-terminal\src\agent-terminal-stream.ts"

# === MCP ===
Copy-File "src\components\mcp\AddMcpServerDialog.tsx" "desktop\ia-sparta-mcp\src\AddMcpServerDialog.tsx"
Copy-File "src\components\mcp\McpServerCard.tsx" "desktop\ia-sparta-mcp\src\McpServerCard.tsx"
Copy-File "src\components\mcp\McpToolItem.tsx" "desktop\ia-sparta-mcp\src\McpToolItem.tsx"
Copy-File "src\components\views\McpView.tsx" "desktop\ia-sparta-mcp\src\McpView.tsx"

# === MEMORY ===
Copy-File "src\components\memory\MemoryDialog.tsx" "desktop\ia-sparta-memory\src\MemoryDialog.tsx"
Copy-File "src\components\memory\MemoryEntryItem.tsx" "desktop\ia-sparta-memory\src\MemoryEntryItem.tsx"
Copy-File "src\components\memory\MemoryGraph.tsx" "desktop\ia-sparta-memory\src\MemoryGraph.tsx"
Copy-File "src\components\memory\MemoryGraphControls.tsx" "desktop\ia-sparta-memory\src\MemoryGraphControls.tsx"
Copy-File "src\components\memory\MemoryGraphD3.tsx" "desktop\ia-sparta-memory\src\MemoryGraphD3.tsx"
Copy-File "src\components\memory\MemoryListView.tsx" "desktop\ia-sparta-memory\src\MemoryListView.tsx"
Copy-File "src\components\memory\MemoryNodePanel.tsx" "desktop\ia-sparta-memory\src\MemoryNodePanel.tsx"
Copy-File "src\components\views\MemoryView.tsx" "desktop\ia-sparta-memory\src\MemoryView.tsx"

# === PERMISSION ===
Copy-File "src\components\permission\PermissionRequestDialog.tsx" "desktop\ia-sparta-permission\src\PermissionRequestDialog.tsx"
Copy-File "src\components\permission\DiffProposalDialog.tsx" "desktop\ia-sparta-permission\src\DiffProposalDialog.tsx"

# === PROVIDERS ===
Copy-File "src\components\providers\ConfigureProviderDialog.tsx" "desktop\ia-sparta-providers\src\ConfigureProviderDialog.tsx"
Copy-File "src\components\providers\ChooseProviderDialog.tsx" "desktop\ia-sparta-providers\src\ChooseProviderDialog.tsx"
Copy-File "src\components\providers\ProviderCard.tsx" "desktop\ia-sparta-providers\src\ProviderCard.tsx"

# === SETTINGS ===
Copy-File "src\components\settings\SettingsDialog.tsx" "desktop\ia-sparta-settings\src\SettingsDialog.tsx"
Copy-File "src\components\settings\ThemePicker.tsx" "desktop\ia-sparta-settings\src\ThemePicker.tsx"

# === SKILLS ===
Copy-File "src\components\skills\SkillCard.tsx" "desktop\ia-sparta-skills\src\SkillCard.tsx"
Copy-File "src\components\skills\SkillCreator.tsx" "desktop\ia-sparta-skills\src\SkillCreator.tsx"
Copy-File "src\components\skills\SkillDialog.tsx" "desktop\ia-sparta-skills\src\SkillDialog.tsx"
Copy-File "src\components\skills\SkillExplorer.tsx" "desktop\ia-sparta-skills\src\SkillExplorer.tsx"
Copy-File "src\components\skills\SkillInstaller.ts" "desktop\ia-sparta-skills\src\SkillInstaller.ts"
Copy-File "src\components\skills\SkillMarkdownDialog.tsx" "desktop\ia-sparta-skills\src\SkillMarkdownDialog.tsx"
Copy-File "src\components\skills\SkillToggle.tsx" "desktop\ia-sparta-skills\src\SkillToggle.tsx"
Copy-File "src\components\views\SkillsView.tsx" "desktop\ia-sparta-skills\src\SkillsView.tsx"

# === CHANNELS ===
Copy-File "src\components\channels\ChannelDialog.tsx" "desktop\ia-sparta-channels\src\ChannelDialog.tsx"
Copy-File "src\components\channels\ChannelSidebar.tsx" "desktop\ia-sparta-channels\src\ChannelSidebar.tsx"
Copy-File "src\components\channels\ComingSoonPanel.tsx" "desktop\ia-sparta-channels\src\ComingSoonPanel.tsx"
Copy-File "src\components\channels\IntegrationStatusBadge.tsx" "desktop\ia-sparta-channels\src\IntegrationStatusBadge.tsx"
Copy-File "src\components\channels\InternalChannelView.tsx" "desktop\ia-sparta-channels\src\InternalChannelView.tsx"
Copy-File "src\components\channels\TelegramIntegrationPanel.tsx" "desktop\ia-sparta-channels\src\TelegramIntegrationPanel.tsx"
Copy-File "src\components\views\ChannelsView.tsx" "desktop\ia-sparta-channels\src\ChannelsView.tsx"

# === PROJECTS ===
Copy-File "src\components\projects\ProjectDialog.tsx" "desktop\ia-sparta-projects\src\ProjectDialog.tsx"

# === SHELL LAYOUT ===
Copy-File "src\components\sidebar\AppSidebar.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\AppSidebar.tsx"
Copy-File "src\components\sidebar\ChannelItem.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\ChannelItem.tsx"
Copy-File "src\components\sidebar\McpServerItem.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\McpServerItem.tsx"
Copy-File "src\components\sidebar\ProjectSwitcher.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\ProjectSwitcher.tsx"
Copy-File "src\components\sidebar\SessionItem.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\SessionItem.tsx"
Copy-File "src\components\sidebar\SessionList.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\SessionList.tsx"
Copy-File "src\components\sidebar\SidebarResizeHandle.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\SidebarResizeHandle.tsx"
Copy-File "src\components\sidebar\SkillItem.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\SkillItem.tsx"
Copy-File "src\components\layout\AppShell.tsx" "desktop\ia-sparta-shell-layout\src\layout\AppShell.tsx"
Copy-File "src\components\layout\AppMenu.tsx" "desktop\ia-sparta-shell-layout\src\layout\AppMenu.tsx"
Copy-File "src\components\layout\TitleBar.tsx" "desktop\ia-sparta-shell-layout\src\layout\TitleBar.tsx"
Copy-File "src\components\layout\StatusBar.tsx" "desktop\ia-sparta-shell-layout\src\layout\StatusBar.tsx"
Copy-File "src\components\layout\CronStatusDialog.tsx" "desktop\ia-sparta-shell-layout\src\layout\CronStatusDialog.tsx"
Copy-File "src\components\layout\AgentsStatusDialog.tsx" "desktop\ia-sparta-shell-layout\src\layout\AgentsStatusDialog.tsx"
Copy-File "src\components\layout\GatewayStatusDialog.tsx" "desktop\ia-sparta-shell-layout\src\layout\GatewayStatusDialog.tsx"
Copy-File "src\components\layout\TokenUsageDialog.tsx" "desktop\ia-sparta-shell-layout\src\layout\TokenUsageDialog.tsx"

# === DESIGN SYSTEM - UI primitives ===
Copy-File "src\components\ui\sidebar.tsx" "desktop\ia-sparta-shell-layout\src\sidebar\sidebar-component.tsx"
Copy-File "src\components\ui\button.tsx" "desktop\ia-sparta-design-system\src\primitives\button.tsx"
Copy-File "src\components\ui\card.tsx" "desktop\ia-sparta-design-system\src\primitives\card.tsx"
Copy-File "src\components\ui\dialog.tsx" "desktop\ia-sparta-design-system\src\primitives\dialog.tsx"
Copy-File "src\components\ui\dropdown-menu.tsx" "desktop\ia-sparta-design-system\src\primitives\dropdown-menu.tsx"
Copy-File "src\components\ui\input.tsx" "desktop\ia-sparta-design-system\src\primitives\input.tsx"
Copy-File "src\components\ui\scroll-area.tsx" "desktop\ia-sparta-design-system\src\primitives\scroll-area.tsx"
Copy-File "src\components\ui\separator.tsx" "desktop\ia-sparta-design-system\src\primitives\separator.tsx"
Copy-File "src\components\ui\sheet.tsx" "desktop\ia-sparta-design-system\src\primitives\sheet.tsx"
Copy-File "src\components\ui\skeleton.tsx" "desktop\ia-sparta-design-system\src\primitives\skeleton.tsx"
Copy-File "src\components\ui\sonner.tsx" "desktop\ia-sparta-design-system\src\primitives\sonner.tsx"
Copy-File "src\components\ui\textarea.tsx" "desktop\ia-sparta-design-system\src\primitives\textarea.tsx"
Copy-File "src\components\ui\tooltip.tsx" "desktop\ia-sparta-design-system\src\primitives\tooltip.tsx"
Copy-File "src\components\ui\combobox.tsx" "desktop\ia-sparta-design-system\src\primitives\combobox.tsx"
Copy-File "src\components\ui\confirm-delete-dialog.tsx" "desktop\ia-sparta-design-system\src\primitives\confirm-delete-dialog.tsx"
Copy-File "src\components\ui\BrandIcon.tsx" "desktop\ia-sparta-design-system\src\primitives\BrandIcon.tsx"

Write-Host "=========================================="
Write-Host "COMPONENT COPY COMPLETE" -ForegroundColor Cyan
Write-Host "Now migrating electron/ipc and remaining files"
Write-Host "=========================================="