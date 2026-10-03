import { useEffect, useRef, useState } from 'react';
import { SettingsSection } from '../../../../desktop/frontend-spartan/src/features/settings/components/settings-section';
import { DEFAULT_INFERENCE_PARAMS } from '../../../../desktop/frontend-spartan/src/features/chat/types/runtime';
import { SHORTCUT_DEFS } from './desktop-shortcuts.generated';
import { Button } from './desktop-demo-button';
import { DemoSettingRow } from './demo-setting-row';
import { useDemoPreferences } from './demo-preferences';

export function DemoResponseSettings({ selectedModel }: { selectedModel: string }) {
  const [params, setParams] = useState({ ...DEFAULT_INFERENCE_PARAMS });
  const { prefs } = useDemoPreferences();
  const perModel = useRef<Record<string, typeof params>>({});
  const previousModel = useRef(selectedModel);
  useEffect(() => { setParams({ ...DEFAULT_INFERENCE_PARAMS }); perModel.current = {}; }, [prefs.resetEpoch]);
  useEffect(() => {
    if (previousModel.current === selectedModel) return;
    if (prefs.rememberParams) { perModel.current[previousModel.current] = params; setParams(perModel.current[selectedModel] || { ...DEFAULT_INFERENCE_PARAMS }); }
    previousModel.current = selectedModel;
  }, [selectedModel, prefs.rememberParams, params]);
  return <SettingsSection title="Respuesta del modelo" description="Valores compartidos con el escritorio. El formulario es local; las respuestas de la demo son ejemplos predeterminados.">
    <DemoSettingRow label="Instrucción del sistema" description="Indicación base para las conversaciones nuevas."><textarea aria-label="Instrucciones del sistema" rows={3} value={params.systemPrompt} onChange={event => setParams(old => ({ ...old, systemPrompt: event.target.value }))} placeholder="Ejemplo: responde de forma clara y en español." /></DemoSettingRow>
    {([{ key: 'temperature', label: 'Temperatura', description: 'Baja para respuestas más consistentes; súbela para más variedad.', min: 0, max: 2, step: .1 }, { key: 'topP', label: 'Top P', description: '', min: 0, max: 1, step: .05 }] as const).map(item => <DemoSettingRow label={item.label} description={item.description} key={item.key}><input aria-label={item.label} type="number" min={item.min} max={item.max} step={item.step} value={params[item.key]} onChange={event => setParams(old => ({ ...old, [item.key]: Math.min(item.max, Math.max(item.min, Number(event.target.value) || 0)) }))} /></DemoSettingRow>)}
    <DemoSettingRow label="Máximo de tokens de respuesta"><input aria-label="Máximo de tokens" type="number" min={1} max={131072} value={params.maxTokens} onChange={event => setParams(old => ({ ...old, maxTokens: Math.max(1, Math.min(131072, Number(event.target.value) || 1)) }))} /></DemoSettingRow>
    <DemoSettingRow label="Restablecer ajustes de respuesta"><Button variant="ghost" size="sm" onClick={() => setParams({ ...DEFAULT_INFERENCE_PARAMS })}>Usar valores predeterminados</Button></DemoSettingRow>
  </SettingsSection>;
}

export function DemoApiKeys() {
  const [name, setName] = useState('');
  const [keys, setKeys] = useState<{ id: number; name: string; token: string }[]>([]);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [revoke, setRevoke] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  return <SettingsSection title="Claves API de Sparta" description="Acceso a la API de la aplicación. Los tokens de esta demostración son inválidos y no conceden acceso.">
    <form className="demo-settings-inline-form" onSubmit={event => { event.preventDefault(); if (!name.trim()) return; const id = Date.now(); setKeys(old => [...old, { id, name: name.trim(), token: `demo-invalid-${id}` }]); setRevealed(id); setName(''); }}><label>Nombre de la clave<input aria-label="Nombre de la clave" value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="Mi integración" /></label><Button type="submit" variant="outline" disabled={!name.trim()}>Crear clave de ejemplo</Button></form>
    {keys.length === 0 && <p className="demo-settings-empty">No hay claves de ejemplo.</p>}
    {keys.map(key => <div className="demo-settings-key" key={key.id}><div><strong>{key.name}</strong><code>{revealed === key.id ? key.token : 'demo-invalid-••••••'}</code></div><div className="demo-settings-button-row"><Button variant="ghost" size="sm" onClick={() => setRevealed(revealed === key.id ? null : key.id)}>{revealed === key.id ? 'Ocultar' : 'Revelar'}</Button><Button variant="outline" size="sm" onClick={() => setRevoke(key.id)}>Revocar</Button></div>{revoke === key.id && <div role="group" aria-label={`Confirmar revocación de ${key.name}`}><p>¿Revocar esta clave de ejemplo?</p><Button size="sm" onClick={() => { setKeys(old => old.filter(item => item.id !== key.id)); setRevoke(null); setNotice('Clave de ejemplo revocada.'); }}>Confirmar revocación</Button><Button variant="ghost" size="sm" onClick={() => setRevoke(null)}>Cancelar</Button></div>}</div>)}
    {notice && <p role="status">{notice}</p>}
  </SettingsSection>;
}

export function DemoConnections() {
  const [providers, setProviders] = useState<{ name: string; endpoint: string; model: string }[]>([{ name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', model: 'free' }]);
  const [provider, setProvider] = useState('OpenAI');
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('');
  const [notice, setNotice] = useState('');
  return <><SettingsSection title="Proveedores de IA" description="Esta sección corresponde a Conexiones del escritorio. El formulario guarda metadatos locales de ejemplo y no llama a ningún proveedor.">
    {providers.map(item => <div className="demo-settings-provider" key={item.name}><div><strong>{item.name}</strong><p>{item.endpoint}<br />{item.model || 'Sin modelo manual'}</p></div><div className="demo-settings-button-row"><Button variant="ghost" size="sm" onClick={() => { setProvider(item.name); setEndpoint(item.endpoint); setModel(item.model); }}>Editar {item.name}</Button><Button variant="outline" size="sm" onClick={() => setProviders(old => old.filter(value => value.name !== item.name))}>Quitar {item.name}</Button></div></div>)}
  </SettingsSection><SettingsSection title="Añadir conexión">
    <form onSubmit={event => { event.preventDefault(); try { const url = new URL(endpoint); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol'); } catch { setNotice('Introduce una URL HTTP o HTTPS válida.'); return; } setProviders(old => [...old.filter(item => item.name !== provider), { name: provider, endpoint: endpoint.trim(), model: model.trim() }]); setNotice(`Conexión de ejemplo ${provider} guardada${model.trim() ? ` · ${model.trim()}` : ''}.`); }}>
      <label>Proveedor<select aria-label="Proveedor de conexión" value={provider} onChange={event => { setProvider(event.target.value); setEndpoint(({ OpenAI: 'https://api.openai.com/v1', Anthropic: 'https://api.anthropic.com', Gemini: 'https://generativelanguage.googleapis.com', OpenRouter: 'https://openrouter.ai/api/v1', 'Compatible con OpenAI': 'http://localhost:1234/v1' } as Record<string, string>)[event.target.value]); }}>{['OpenAI', 'Anthropic', 'Gemini', 'OpenRouter', 'Compatible con OpenAI'].map(name => <option key={name}>{name}</option>)}</select></label>
      <label>URL base<input aria-label="URL base" value={endpoint} onChange={event => setEndpoint(event.target.value)} /></label>
      <label>Modelo manual<input aria-label="Modelo manual" value={model} onChange={event => setModel(event.target.value)} placeholder="Identificador del modelo" /></label>
      <label>Clave del proveedor<input aria-label="Clave del proveedor" disabled placeholder="Solo disponible en la aplicación instalada" /></label>
      <Button variant="outline" type="submit">Guardar conexión de ejemplo</Button>
    </form>{notice && <p role="status">{notice}</p>}
  </SettingsSection></>;
}

const shortcutLabels: Record<string, string> = { newChat: 'Nuevo chat', searchChats: 'Buscar conversaciones', toggleSidebar: 'Mostrar u ocultar barra lateral', openSettings: 'Abrir configuración', openKeyboardShortcuts: 'Abrir atajos' };
export function DemoShortcuts() {
  const [query, setQuery] = useState('');
  return <SettingsSection title="Atajos del escritorio" description="Definiciones compartidas con la aplicación. Los atajos globales y su personalización requieren el escritorio; en la web se conservan los del navegador.">
    <input aria-label="Buscar atajo" placeholder="Buscar atajo" value={query} onChange={event => setQuery(event.target.value)} />
    <dl className="demo-settings-shortcuts">{SHORTCUT_DEFS.filter(item => shortcutLabels[item.id].toLowerCase().includes(query.toLowerCase())).map(item => <div key={item.id}><dt>{shortcutLabels[item.id]}</dt><dd><kbd>{item.defaultBinding?.replace('Mod', 'Ctrl / ⌘').replace('Key', '').replace('Comma', ',').replace('Slash', '/')}</kbd></dd></div>)}</dl>
    <h3>Controles de esta demo</h3><dl className="demo-settings-shortcuts"><div><dt>Enviar mensaje, si está activado</dt><dd><kbd>Enter</kbd></dd></div><div><dt>Nueva línea</dt><dd><kbd>Shift + Enter</kbd></dd></div><div><dt>Cerrar diálogo</dt><dd><kbd>Esc</kbd></dd></div></dl>
  </SettingsSection>;
}

export function DemoLogs({ theme, profileName }: { theme: string; profileName: string }) {
  const [snapshot, setSnapshot] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = () => setSnapshot(JSON.stringify({ source: 'landing-demo', capturedAt: new Date().toISOString(), theme, profileName, responseSource: 'local-fixtures', providerRequests: 0 }, null, 2));
  return <SettingsSection title="Diagnóstico local" description="En el escritorio este visor consulta los registros de la aplicación. Aquí inspecciona únicamente el estado de la demostración."><div className="demo-settings-button-row"><Button variant="outline" size="sm" onClick={refresh}>Actualizar diagnóstico</Button><Button variant="outline" size="sm" disabled={!snapshot} onClick={async () => { try { await navigator.clipboard.writeText(snapshot); setNotice('Diagnóstico copiado.'); } catch { setNotice('El navegador no permitió copiar.'); } }}>Copiar diagnóstico</Button></div><pre className="demo-settings-log">{snapshot || 'Actualiza para capturar el estado local de la demo.'}</pre>{notice && <p role="status">{notice}</p>}</SettingsSection>;
}
