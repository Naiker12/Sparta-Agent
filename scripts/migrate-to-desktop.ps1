# Migración completa del código fuente a la arquitectura modular desktop/
Write-Host "=== Iniciando migración a arquitectura modular ===" -ForegroundColor Cyan

$root = "d:\sparta-agent"

# 1. CHAT - Mover componentes de chat
$chatDirs = @(
    @{src="src\components\chat\ChatArea.tsx"; dst="desktop\ia-sparta-chat\src\components\ChatArea.tsx"},
    @{src="src\components\chat\HeroScreen.tsx"; dst="desktop\ia-sparta-chat\src\components\HeroScreen.tsx"},
    @{src="src\components\chat\MarkdownRenderer.tsx"; dst="desktop\ia-sparta-chat\src\components\MarkdownRenderer.tsx"},
    @{src="src\components\chat\MessageActionsDialog.tsx"; dst="desktop\ia-sparta-chat\src\components\MessageActionsDialog.tsx"},
    @{src="src\components\chat\MessageBubble.tsx"; dst="desktop\ia-sparta-chat\src\components\MessageBubble.tsx"},
    @{src="src\components\chat\MessageList.tsx"; dst="desktop\ia-sparta-chat\src\components\MessageList.tsx"},
    @{src="src\components\chat\SpartaIcon.tsx"; dst="desktop\ia-sparta-chat\src\components\SpartaIcon.tsx"},
    @{src="src\components\chat\TokenUsagePill.tsx"; dst="desktop\ia-sparta-chat\src\components\TokenUsagePill.tsx"},
    @{src="src\components\input\ChatInput.tsx"; dst="desktop\ia-sparta-chat\src\components\input\ChatInput.tsx"},
    @{src="src\components\input\AttachMenu.tsx"; dst="desktop\ia-sparta-chat\src\components\input\AttachMenu.tsx"},
    @{src="src\components\input\AudioWaveform.tsx"; dst="desktop\ia-sparta-chat\src\components\input\AudioWaveform.tsx"},
    @{src="src\components\input\ConnectorsSubmenu.tsx"; dst="desktop\ia-sparta-chat\src\components\input\ConnectorsSubmenu.tsx"},
    @{src="src\components\input\ModelPicker.tsx"; dst="desktop\ia-sparta-chat\src\components\input\ModelPicker.tsx"},
    @{src="src\components\input\ModeSwitch.tsx"; dst="desktop\ia-sparta-chat\src\components\input\ModeSwitch.tsx"},
    @{src="src\components\input\SlashCommandMenu.tsx"; dst="desktop\ia-sparta-chat\src\components\input\SlashCommandMenu.tsx"},
    @{src="src\components\input\VoiceRecordButton.tsx"; dst="desktop\ia-sparta-chat\src\components\input\VoiceRecordButton.tsx"}
)

# 2. AGENTS - Mover componentes de agentes
$agentDirs = @(
    @{src="src\components\agents\AgentsPanel.tsx"; dst="desktop\ia-sparta-agents\src\components\AgentsPanel.tsx"},
    @{src="src\components\agents\AgentActivityPanel.tsx"; dst="desktop\ia-sparta-agents\src\components\activity\AgentActivityPanel.tsx"},
    @{src="src\components\agents\PlanWatchPane.tsx"; dst="desktop\ia-sparta-agents\src\components\activity\PlanWatchPane.tsx"},
    @{src="src\components\agents\SubagentWatchPane.tsx"; dst="desktop\ia-sparta-agents\src\components\activity\SubagentWatchPane.tsx"}
)

# 3. EDITOR - Mover componentes del editor
$editorDirs = @(
    @{src="src\components\editor\EditorPanel.tsx"; dst="desktop\ia-sparta-editor\src\EditorPanel.tsx"},
    @{src="src\components\editor\DiffReviewTab.tsx"; dst="desktop\ia-sparta-editor\src\diff\DiffReviewTab.tsx"},
    @{src="src\components\editor\EditorBreadcrumb.tsx"; dst="desktop\ia-sparta-editor\src\EditorBreadcrumb.tsx"},
    @{src="src\components\editor\EditorDialogs.tsx"; dst="desktop\ia-sparta-editor\src\EditorDialogs.tsx"},
    @{src="src\components\editor\EditorEmptyState.tsx"; dst="desktop\ia-sparta-editor\src\EditorEmptyState.tsx"},
    @{src="src\components\editor\EditorSkeleton.tsx"; dst="desktop\ia-sparta-editor\src\EditorSkeleton.tsx"},
    @{src="src\components\editor\EditorStatusBar.tsx"; dst="desktop\ia-sparta-editor\src\EditorStatusBar.tsx"},
    @{src="src\components\editor\EditorTabs.tsx"; dst="desktop\ia-sparta-editor\src\EditorTabs.tsx"},
    @{src="src\components\editor\EditorToolbar.tsx"; dst="desktop\ia-sparta-editor\src\EditorToolbar.tsx"},
    @{src="src\components\editor\FileTreeItem.tsx"; dst="desktop\ia-sparta-editor\src\file-tree\FileTreeItem.tsx"},
    @{src="src\components\editor\FileTreeSidebar.tsx"; dst="desktop\ia-sparta-editor\src\file-tree\FileTreeSidebar.tsx"},
    @{src="src\components\editor\InlineAskWidget.tsx"; dst="desktop\ia-sparta-editor\src\InlineAskWidget.tsx"},
    @{src="src\components\editor\MonacoEditor.tsx"; dst="desktop\ia-sparta-editor\src\MonacoEditor.tsx"},
    @{src="src\components\editor\ProjectFolderPicker.tsx"; dst="desktop\ia-sparta-editor\src\ProjectFolderPicker.tsx"}
)

# 4. TERMINAL
$terminalDirs = @(
    @{src="src\components\terminal\TerminalWorkspace.tsx"; dst="desktop\ia-sparta-terminal\src\TerminalWorkspace.tsx"},
    @{src="src\components\terminal\PersistentTerminal.tsx"; dst="desktop\ia-sparta-terminal\src\persistent-terminal.tsx"},
    @{src="src\components\terminal\TerminalSlot.tsx"; dst="desktop\ia-sparta-terminal\src\TerminalSlot.tsx"},
    @{src="src\components\terminal\agent-terminal-stream.ts"; dst="desktop\ia-sparta-terminal\src\agent-terminal-stream.ts"}
)

# 5. MCP
$mcpDirs = @(
    @{src="src\components\mcp\AddMcpServerDialog.tsx"; dst="desktop\ia-sparta-mcp\src\AddMcpServerDialog.tsx"},
    @{src="src\components\mcp\McpServerCard.tsx"; dst="desktop\ia-sparta-mcp\src\McpServerCard.tsx"},
    @{src="src\components\mcp\McpToolItem.tsx"; dst="desktop\ia-sparta-mcp\src\McpToolItem.tsx"},
    @{src="src\components\views\McpView.tsx"; dst="desktop\ia-sparta-mcp\src\McpView.tsx"}
)

# 6. MEMORY
$memoryDirs = @(
    @{src="src\components\memory\MemoryDialog.tsx"; dst="desktop\ia-sparta-memory\src\MemoryDialog.tsx"},
    @{src="src\components\memory\MemoryEntryItem.tsx"; dst="desktop\ia-sparta-memory\src\MemoryEntryItem.tsx"},
    @{src="src\components\memory\MemoryGraph.tsx"; dst="desktop\ia-sparta-memory\src\MemoryGraph.tsx"},
    @{src="src\components\memory\MemoryGraphControls.tsx"; dst="desktop\ia-sparta-memory\src\MemoryGraphControls.tsx"},
    @{src="src\components\memory\MemoryGraphD3.tsx"; dst="desktop\ia-sparta-memory\src\MemoryGraphD3.tsx"},
    @{src="src\components\memory\MemoryListView.tsx"; dst="desktop\ia-sparta-memory\src\MemoryListView.tsx"},
    @{src="src\components\memory\MemoryNodePanel.tsx"; dst="desktop\ia-sparta-memory\src\MemoryNodePanel.tsx"},
    @{src="src\components\views\MemoryView.tsx"; dst="desktop\ia-sparta-memory\src\MemoryView.tsx"}
)

# 7. PERMISSION
$permissionDirs = @(
    @{src="src\components\permission\PermissionRequestDialog.tsx"; dst="desktop\ia-sparta-permission\src\PermissionRequestDialog.tsx"},
    @{src="src\components\permission\DiffProposalDialog.tsx"; dst="desktop\ia-sparta-permission\src\DiffProposalDialog.tsx"}
)

# 8. PROVIDERS
$providerDirs = @(
    @{src="src\components\providers\ConfigureProviderDialog.tsx"; dst="desktop\ia-sparta-providers\src\ConfigureProviderDialog.tsx"},
    @{src="src\components\providers\ChooseProviderDialog.tsx"; dst="desktop\ia-sparta-providers\src\ChooseProviderDialog.tsx"},
    @{src="src\components\providers\ProviderCard.tsx"; dst="desktop\ia-sparta-providers\src\ProviderCard.tsx"}
)

# 9. SETTINGS
$settingsDirs = @(
    @{src="src\components\settings\SettingsDialog.tsx"; dst="desktop\ia-sparta-settings\src\SettingsDialog.tsx"},
    @{src="src\components\settings\ThemePicker.tsx"; dst="desktop\ia-sparta-settings\src\ThemePicker.tsx"}
)

# 10. SKILLS
$skillsDirs = @(
    @{src="src\components\skills\SkillCard.tsx"; dst="desktop\ia-sparta-skills\src\SkillCard.tsx"},
    @{src="src\components\skills\SkillCreator.tsx"; dst="desktop\ia-sparta-skills\src\SkillCreator.tsx"},
    @{src="src\components\skills\SkillDialog.tsx"; dst="desktop\ia-sparta-skills\src\SkillDialog.tsx"},
    @{src="src\components\skills\SkillExplorer.tsx"; dst="desktop\ia-sparta-skills\src\SkillExplorer.tsx"},
    @{src="src\components\skills\SkillInstaller.ts"; dst="desktop\ia-sparta-skills\src\SkillInstaller.ts"},
    @{src="src\components\skills\SkillMarkdownDialog.tsx"; dst="desktop\ia-sparta-skills\src\SkillMarkdownDialog.tsx"},
    @{src="src\components\skills\SkillToggle.tsx"; dst="desktop\ia-sparta-skills\src\SkillToggle.tsx"},
    @{src="src\components\views\SkillsView.tsx"; dst="desktop\ia-sparta-skills\src\SkillsView.tsx"}
)

# 11. CHANNELS
$channelDirs = @(
    @{src="src\components\channels\ChannelDialog.tsx"; dst="desktop\ia-sparta-channels\src\ChannelDialog.tsx"},
    @{src="src\components\channels\ChannelSidebar.tsx"; dst="desktop\ia-sparta-channels\src\ChannelSidebar.tsx"},
    @{src="src\components\channels\ComingSoonPanel.tsx"; dst="desktop\ia-sparta-channels\src\ComingSoonPanel.tsx"},
    @{src="src\components\channels\IntegrationStatusBadge.tsx"; dst="desktop\ia-sparta-channels\src\IntegrationStatusBadge.tsx"},
    @{src="src\components\channels\InternalChannelView.tsx"; dst="desktop\ia-sparta-channels\src\InternalChannelView.tsx"},
    @{src="src\components\channels\TelegramIntegrationPanel.tsx"; dst="desktop\ia-sparta-channels\src\TelegramIntegrationPanel.tsx"},
    @{src="src\components\views\ChannelsView.tsx"; dst="desktop\ia-sparta-channels\src\ChannelsView.tsx"}
)

# 12. PROJECTS
$projectDirs = @(
    @{src="src\components\projects\ProjectDialog.tsx"; dst="desktop\ia-sparta-projects\src\ProjectDialog.tsx"}
)

# 13. SHELL LAYOUT
$shellDirs = @(
    @{src="src\components\sidebar\AppSidebar.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\AppSidebar.tsx"},
    @{src="src\components\sidebar\ChannelItem.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\ChannelItem.tsx"},
    @{src="src\components\sidebar\McpServerItem.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\McpServerItem.tsx"},
    @{src="src\components\sidebar\ProjectSwitcher.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\ProjectSwitcher.tsx"},
    @{src="src\components\sidebar\SessionItem.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\SessionItem.tsx"},
    @{src="src\components\sidebar\SessionList.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\SessionList.tsx"},
    @{src="src\components\sidebar\SidebarResizeHandle.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\SidebarResizeHandle.tsx"},
    @{src="src\components\sidebar\SkillItem.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\SkillItem.tsx"},
    @{src="src\components\ui\sidebar.tsx"; dst="desktop\ia-sparta-shell-layout\src\sidebar\ui-sidebar.tsx"},
    @{src="src\components\layout\AppShell.tsx"; dst="desktop\ia-sparta-shell-layout\src\layout\AppShell.tsx"},
    @{src="src\components\layout\AppMenu.tsx"; dst="desktop\ia-sparta-shell-layout\src\layout\AppMenu.tsx"},
    @{src="src\components\layout\TitleBar.tsx"; dst="desktop\ia-sparta-shell-layout\src\layout\TitleBar.tsx"},
    @{src="src\components\layout\StatusBar.tsx"; dst="desktop\ia-sparta-shell-layout\src\layout\StatusBar.tsx"},
    @{src="src\components\layout\CronStatusDialog.tsx"; dst="desktop\ia-sparta-shell-layout\src\layout\CronStatusDialog.tsx"},
    @{src="src\components\layout\AgentsStatusDialog.tsx"; dst="desktop\ia-sparta-shell-layout\src\layout\AgentsStatusDialog.tsx"},
    @{src="src\components\layout\GatewayStatusDialog.tsx"; dst="desktop\ia-sparta-shell-layout\src\layout\GatewayStatusDialog.tsx"},
    @{src="src\components\layout\TokenUsageDialog.tsx"; dst="desktop\ia-sparta-shell-layout\src\layout\TokenUsageDialog.tsx"}
)

# 14. DESIGN SYSTEM - UI primitives
$designDirs = @(
    @{src="src\components\ui\button.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\button.tsx"},
    @{src="src\components\ui\card.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\card.tsx"},
    @{src="src\components\ui\dialog.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\dialog.tsx"},
    @{src="src\components\ui\dropdown-menu.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\dropdown-menu.tsx"},
    @{src="src\components\ui\input.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\input.tsx"},
    @{src="src\components\ui\scroll-area.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\scroll-area.tsx"},
    @{src="src\components\ui\separator.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\separator.tsx"},
    @{src="src\components\ui\sheet.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\sheet.tsx"},
    @{src="src\components\ui\skeleton.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\skeleton.tsx"},
    @{src="src\components\ui\sonner.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\sonner.tsx"},
    @{src="src\components\ui\textarea.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\textarea.tsx"},
    @{src="src\components\ui\tooltip.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\tooltip.tsx"},
    @{src="src\components\ui\combobox.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\combobox.tsx"},
    @{src="src\components\ui\confirm-delete-dialog.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\confirm-delete-dialog.tsx"},
    @{src="src\components\ui\BrandIcon.tsx"; dst="desktop\ia-sparta-design-system\src\primitives\BrandIcon.tsx"}
)

# Combine all file mappings
$allFiles = $chatDirs + $agentDirs + $editorDirs + $terminalDirs + $mcpDirs + $memoryDirs + $permissionDirs + $providerDirs + $settingsDirs + $skillsDirs + $channelDirs + $projectDirs + $shellDirs + $designDirs

$copied = 0
$failed = 0
$errors = @()

foreach ($f in $allFiles) {
    $srcPath = Join-Path $root $f.src
    $dstPath = Join-Path $root $f.dst
    
    # Ensure destination directory exists
    $dstDir = Split-Path $dstPath -Parent
    if (-not (Test-Path $dstDir)) {
        New-Item -ItemType Directory -Force -Path $dstDir -ErrorAction SilentlyContinue | Out-Null
    }
    
    if (Test-Path $srcPath) {
        try {
            Copy-Item -Path $srcPath -Destination $dstPath -Force -ErrorAction Stop
            Write-Host "  ✓ $( $f.src )" -ForegroundColor Green
            $copied++
        } catch {
            Write-Host "  ✗ $( $f.src ) -> $($_.Exception.Message)" -ForegroundColor Red
            $errors += $f.src
            $failed++
        }
    } else {
        Write-Host "  ? $( $f.src ) not found (will create later)" -ForegroundColor Yellow
        $failed++
    }
}

Write-Host "`n=== Migration Summary ===" -ForegroundColor Cyan
Write-Host "Copied: $copied files" -ForegroundColor Green
Write-Host "Failed: $failed files" -ForegroundColor Yellow
if ($errors.Count -gt 0) {
    Write-Host "Missing files:" -ForegroundColor Yellow
    foreach ($e in $errors) { Write-Host "  - $e" }
}
Write-Host "=== Done ===" -ForegroundColor Cyan