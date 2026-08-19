import { DictationSection } from './sections/DictationSection'
import { TextToSpeechSection } from './sections/TextToSpeechSection'

export function VoiceTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <DictationSection />
      <TextToSpeechSection />
    </div>
  )
}
