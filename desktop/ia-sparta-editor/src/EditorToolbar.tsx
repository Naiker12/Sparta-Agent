import { PanelLeft, PanelRight, FolderX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from '@/i18n'

export function EditorToolbar({
  explorerVisible,
  onToggleExplorer,
  agentPanelVisible,
  onToggleAgentPanel,
  projectName,
  onCloseProject,
  onCloseEditor,
}: {
  explorerVisible: boolean
  onToggleExplorer: () => void
  agentPanelVisible: boolean
  onToggleAgentPanel: () => void
  projectName?: string
  onCloseProject: () => void
  onCloseEditor: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      className="flex items-center gap-1 shrink-0"
      style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-normal)',
        background: 'var(--bg-surface)',
      }}
    >
      <TooltipProvider delay={400}>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={explorerVisible}
              className={explorerVisible ? 'bg-[var(--bg-active)]' : ''}
              onClick={onToggleExplorer}
            >
              <PanelLeft size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t('editor.toolbar.toggleExplorer')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delay={400}>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={agentPanelVisible}
              className={agentPanelVisible ? 'bg-[var(--bg-active)]' : ''}
              onClick={onToggleAgentPanel}
            >
              <PanelRight size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t('editor.toolbar.toggleAgentPanel')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1" />

      {projectName && (
        <>
          <TooltipProvider delay={400}>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-[11px]"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={onCloseProject}
                >
                  <FolderX size={12} />
                  <span>{t('editor.toolbar.closeProject')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {t('editor.toolbar.closeProject')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="mx-1 h-4" />
        </>
      )}

      <TooltipProvider delay={400}>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onCloseEditor}
            >
              <X size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {t('editor.toolbar.closeEditor')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
