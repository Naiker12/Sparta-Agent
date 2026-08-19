import { LiveMonitorSection } from './sections/LiveMonitorSection'
import { InferenceBackendSection } from './sections/InferenceBackendSection'
import { ModelMemorySection } from './sections/ModelMemorySection'
import { EnvironmentSection } from './sections/EnvironmentSection'

export function SystemTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <LiveMonitorSection />
      <InferenceBackendSection />
      <ModelMemorySection />
      <EnvironmentSection />
    </div>
  )
}
