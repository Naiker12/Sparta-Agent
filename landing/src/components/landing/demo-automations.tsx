import { useEffect, useState } from 'react';
import { CalendarClock, Check, MessageSquare, Play, Send } from 'lucide-react';
import { Button } from './desktop-demo-button';

export function DemoAutomationRun({ onChat }: { onChat: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step === 0 || step === 3) return;
    const timer = window.setTimeout(() => setStep(value => value + 1), 1200);
    return () => window.clearTimeout(timer);
  }, [step]);
  return <div className="explorer-card">
    <div className="explorer-card-title"><CalendarClock /><strong>Revisión semanal del proyecto</strong><span>{step === 0 ? 'Programada' : step === 3 ? 'Completada' : 'En curso'}</span></div>
    <p>Resumir las instrucciones guardadas y preparar los siguientes pasos.</p>
    <div className="explorer-meta">Proyecto sparta-demo · Lunes, 09:00 · Ejemplo de programación</div>
    <div className="demo-settings-button-row"><Button variant="outline" disabled={step > 0 && step < 3} onClick={() => setStep(1)}><Play data-icon="inline-start" />{step === 3 ? 'Repetir demostración' : 'Simular ejecución'}</Button>{step > 0 && <Button variant="outline" onClick={onChat}><MessageSquare data-icon="inline-start" />Abrir chat del proyecto</Button>}</div>
    {step > 0 && <ol className="demo-automation-events" aria-label="Progreso de la automatización" aria-live="polite">
      <li><Send /><div><strong>Inicio · 09:00</strong><span>Chat creado para esta ejecución. Aviso de inicio al Telegram personal de ejemplo.</span></div></li>
      {step >= 2 && <li><MessageSquare /><div><strong>Respuesta en curso</strong><span>El resultado se guarda en el chat vinculado a sparta-demo.</span></div></li>}
      {step === 3 && <li><Check /><div><strong>Final · 09:01</strong><span>Resultado disponible y aviso de final enviado en el ejemplo.</span></div></li>}
    </ol>}
    <p className="explorer-meta">Simulación local: no programa tareas ni envía mensajes. La automatización del escritorio genera texto; el trabajo con archivos y herramientas sigue pendiente.</p>
  </div>;
}
