import { ArchivedChatsSection } from './sections/ArchivedChatsSection'
import { ExportImportSection } from './sections/ExportImportSection'
import { DangerZoneSection } from './sections/DangerZoneSection'

export function DataTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ArchivedChatsSection />
      <ExportImportSection />
      <DangerZoneSection />
    </div>
  )
}
