import { mkdirSync, writeFileSync } from 'node:fs';

const scenes = [
  {
    id: 'startup',
    chapter: 'Instalación',
    tag: 'PRIMER ARRANQUE',
    title: ['Bienvenido', 'a Sparta', 'Agent.'],
    lead: 'Instala la aplicación de escritorio y prepara tu entorno de trabajo.',
    panel: `<div class="file">SPARTA AGENT <span>v0.2.20</span></div><div class="doc-title">Inicio rápido</div><div class="check"><b>✓</b><div><strong>Aplicación instalada</strong><p>Escritorio listo para iniciar.</p></div></div><div class="small-note">Inicia el asistente para configurar tu motor local.</div>`,
    note: 'Descarga siempre la versión compatible desde las releases oficiales.'
  },
  {
    id: 'engine',
    chapter: 'Motor local',
    tag: 'PREPARACIÓN DEL ENTORNO',
    title: ['El motor', 'prepara sus', 'dependencias.'],
    lead: 'El sistema configura el entorno Python en tu directorio de datos.',
    panel: `<div class="file">MOTOR LOCAL <span>Preparación inicial</span></div><div class="detail"><span>Entorno</span><strong>Python Runtime</strong></div><div class="detail"><span>Descarga</span><strong>Dependencias base</strong></div><div class="rule"></div><div class="focus">[ Espera de descarga recortada ]</div><div class="small-note">La primera inicialización prepara los paquetes necesarios.</div>`,
    note: 'Abre los detalles de la consola si necesitas inspeccionar la descarga.'
  },
  {
    id: 'providers',
    chapter: 'Proveedores',
    tag: 'CONEXIÓN DE MODELOS',
    title: ['Conecta tu', 'proveedor de', 'inferencia.'],
    lead: 'Configura un modelo local (Ollama) o remoto (OpenAI, Anthropic, Gemini).',
    panel: `<div class="file">PROVEEDORES <span>Modelos compatibles</span></div><div class="mode-pill">○ Ollama / Local <span>localhost:11434</span></div><div class="mode-pill active">● Proveedor Cloud <span>Credenciales cifradas</span></div><div class="small-note">Las claves se guardan en tu almacenamiento seguro local.</div>`,
    note: 'Introduce las credenciales en configuración, nunca en el chat.'
  },
  {
    id: 'prompt',
    chapter: 'Primer mensaje',
    tag: 'PETICIÓN DE PRUEBA',
    title: ['Envía tu', 'primera', 'conversación.'],
    lead: 'Comprueba que el modelo responde antes de habilitar herramientas.',
    panel: `<div class="file">CHAT <span>Prueba básica de respuesta</span></div><div class="quote">«Responde con una frase y explica qué necesitas para ayudarme.»</div><div class="rule"></div><div class="detail"><span>Proveedor</span><strong>Activo y conectado</strong></div><div class="detail"><span>Modo inicial</span><strong>Modo Chat (Consulta)</strong></div>`,
    note: 'Una respuesta confirma el flujo básico de comunicación.'
  },
  {
    id: 'response',
    chapter: 'Respuesta',
    tag: 'VERIFICACIÓN DE CONEXIÓN',
    title: ['El modelo', 'responde con', 'éxito.'],
    lead: 'Observa la velocidad de generación y la calidad de la respuesta.',
    panel: `<div class="file">SPARTA <span>Respuesta generada</span></div><div class="diff fresh">«¡Hola! Estoy listo para trabajar con tus archivos y proyectos.»</div><div class="rule"></div><div class="check"><b>✓</b><div><strong>Conexión establecida</strong><p>Inferencia operativa y lista.</p></div></div>`,
    note: 'El motor está preparado para asociar proyectos y carpetas.'
  },
  {
    id: 'finish',
    chapter: 'Siguiente paso',
    tag: 'CONTINÚA EL FLUJO',
    title: ['Tu entorno', 'está listo', 'para crear.'],
    lead: 'Vincula una carpeta y continúa con la guía «Tu primera tarea».',
    panel: `<div class="file">LISTO PARA TRABAJAR <span>Resumen</span></div><div class="check"><b>1</b><div><strong>Motor activo</strong><p>Entorno local preparado.</p></div></div><div class="check"><b>2</b><div><strong>Modelo conectado</strong><p>Proveedor verificado.</p></div></div><div class="check"><b>3</b><div><strong>Primera tarea</strong><p>Aprende a leer y editar archivos con seguridad.</p></div></div>`,
    note: 'Continúa en la documentación con «Tu primera tarea».'
  }
];

const css = `
*{box-sizing:border-box} .layout{position:absolute;inset:0;color:#edede7;font-family:Inter,sans-serif}
.copy{position:absolute;left:100px;top:215px;width:740px}.kicker{font-size:24px;letter-spacing:4px;color:#dfd68b;margin:0 0 25px;font-weight:600}
h1{font-size:88px;line-height:1.04;letter-spacing:-4px;margin:0 0 32px;font-weight:650}h1 span{display:block}.lead{font-size:32px;line-height:1.5;color:#bfc1b5;margin:0;max-width:690px}
.panel{position:absolute;left:970px;top:240px;width:850px;min-height:570px;padding:40px;background:#191a17;border:2px solid #36382f;border-radius:20px}
.file{display:flex;justify-content:space-between;align-items:center;font-size:27px;color:#edede7;padding-bottom:26px;border-bottom:2px solid #36382f;font-weight:600}.file span{font-size:24px;color:#bfc1b5;font-weight:400}
.doc-title{font-size:40px;margin:38px 0 28px;font-weight:600}
.line{height:12px;margin:24px 0;background:#36382f;border-radius:6px;width:90%}
.focus{font-size:30px;padding:22px 20px;background:#333326;color:#dfd68b;border-radius:10px;margin:28px 0;text-align:center;font-weight:550}
.mode-pill{display:flex;justify-content:space-between;align-items:center;padding:24px;border-radius:12px;margin-top:28px;background:#242620;border:2px solid #36382f;font-size:30px;font-weight:600;color:#edede7}
.mode-pill span{font-size:24px;font-weight:400;color:#bfc1b5}
.mode-pill.active{background:#333326;border-color:#77774e;color:#dfd68b}
.mode-pill.active span{color:#dfd68b}
.quote{font-size:35px;line-height:1.45;color:#dfd68b;margin:32px 0}
.rule{height:2px;background:#36382f;margin:25px 0}
.detail{display:flex;justify-content:space-between;font-size:27px;margin-top:22px;gap:20px}.detail span{color:#bfc1b5}.detail strong{font-weight:500}
.check{display:flex;gap:24px;align-items:center;margin-top:34px}.check b{display:grid;place-items:center;flex-shrink:0;width:52px;height:52px;border-radius:50%;border:2px solid #77774e;color:#dfd68b;font-size:26px;font-weight:500}.check strong{font-size:32px;font-weight:550}.check p{font-size:26px;color:#bfc1b5;margin:8px 0 0}
.diff{font-size:30px;line-height:1.35;padding:20px;border-radius:8px;margin:24px 0}
.fresh{background:#333326;color:#dfd68b}
.small-note{font-size:25px;margin-top:26px;color:#bfc1b5}
.note{position:absolute;left:100px;top:860px;width:1720px;font-size:28px;line-height:1.4;color:#bfc1b5;padding-top:22px;border-top:2px solid #36382f}
`;

mkdirSync('compositions', { recursive: true });

for (const [i, s] of scenes.entries()) {
  writeFileSync(`compositions/${s.id}.html`, `<!doctype html><html lang="es"><body><template><style>#${s.id}{position:absolute;width:1920px;height:1080px;inset:0}${css}</style><div id="${s.id}" data-composition-id="${s.id}" data-width="1920" data-height="1080" data-duration="10"><div class="layout"><div class="copy"><div class="kicker">${String(i+1).padStart(2,'0')} / ${s.tag}</div><h1>${s.title.map(t=>`<span>${t}</span>`).join('')}</h1><p class="lead">${s.lead}</p></div><div class="panel">${s.panel}</div><div class="note">${s.note}</div></div></div><script>
{ const tl=gsap.timeline({paused:true});
tl.fromTo('#${s.id} .copy',{y:25,opacity:0},{y:0,opacity:1,duration:.55,ease:'power3.out'},0);
tl.fromTo('#${s.id} .panel',{x:45,opacity:0},{x:0,opacity:1,duration:.7,ease:'power2.out'},.15);
tl.fromTo('#${s.id} .note',{opacity:0},{opacity:1,duration:.45},.65);
tl.fromTo('#${s.id} .panel > :not(.file)',{opacity:0,y:10},{opacity:1,y:0,duration:.5,stagger:.18,ease:'power2.out'},.65);
tl.to('#${s.id} .layout',{opacity:0,duration:.25},9.75);
window.__timelines['${s.id}']=tl; }
</script></template></body></html>`);
}

writeFileSync('index.html', `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Sparta · Inicio rápido</title><script src="assets/gsap.min.js"></script><style>
@font-face{font-family:Inter;src:url('assets/inter-latin-wght-normal.woff2') format('woff2');font-weight:100 900;font-display:block}*{box-sizing:border-box}body{margin:0;background:#111210}#main{position:relative;width:1920px;height:1080px;overflow:hidden;background:#111210;color:#edede7;font-family:Inter,sans-serif}.clip{position:absolute;inset:0}.masthead{position:absolute;left:100px;right:100px;top:60px;display:flex;justify-content:space-between;align-items:center;height:70px;border-bottom:2px solid #36382f;padding-bottom:28px;font-size:28px}.brand{font-weight:700;font-size:36px}.brand span{font-weight:400;color:#bfc1b5;font-size:26px;margin-left:24px}.badge{color:#dfd68b;font-size:24px;letter-spacing:2px}.footer{position:absolute;left:100px;top:985px;width:1720px;display:flex;justify-content:space-between;color:#bfc1b5;font-size:25px}.progress{position:absolute;left:100px;top:960px;width:1720px;height:3px;background:#36382f}.fill{width:1720px;height:3px;background:#dfd68b;transform-origin:left}.footer span{width:250px}.footer span:last-child{text-align:right}
</style></head><body><div id="main" data-composition-id="main" data-width="1920" data-height="1080" data-duration="60"><div class="masthead"><div class="brand">Sparta<span>Inicio rápido</span></div><div class="badge">PRIMEROS PASOS · 03</div></div>${scenes.map((s,i)=>`<div id="host-${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${i*10}" data-duration="10" data-track-index="${i+1}" data-width="1920" data-height="1080"></div>`).join('')}<div class="progress"><div class="fill"></div></div><div class="footer">${scenes.map(s=>`<span id="label-${s.id}">${s.chapter}</span>`).join('')}</div></div><script>const tl=gsap.timeline({paused:true});tl.fromTo('.fill',{scaleX:0},{scaleX:1,duration:60,ease:'none'},0);${scenes.map((s,i)=>`tl.to('#label-${s.id}',{color:'#dfd68b',duration:.2},${i*10});`).join('')}window.__timelines['main']=tl;</script></body></html>`);

writeFileSync('STORYBOARD.md', `# Inicio rápido · Tutorial visual\n\n60 segundos. Paleta de Sparta. Adaptador GSAP y control de progreso.\n\n${scenes.map((s,i)=>`## Frame ${i+1}\nstatus: animated\nsrc: compositions/${s.id}.html\ntime: ${i*10}–${(i+1)*10}s\n\n${s.title.join(' ')} ${s.lead}\n\n${s.note}\n`).join('\n')}`);

writeFileSync('transcript.md', `# Inicio rápido: preparar el motor y primera conversación\n\nVideo explicativo de 60 segundos sobre el primer arranque, inicialización del motor local y conexión de modelos.\n\n${scenes.map((s,i)=>`## ${i*10}–${(i+1)*10} segundos · ${s.chapter}\n\n${s.title.join(' ')} ${s.lead} ${s.note}\n`).join('\n')}`);

const stamp = n => `00:${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}.000`;
writeFileSync('captions.es.vtt', `WEBVTT\n\n${scenes.map((s,i)=>`${i+1}\n${stamp(i*10)} --> ${stamp((i+1)*10)}\n${s.title.join(' ')}\n${s.note}\n`).join('\n')}`);

console.log('Built six scenes, 60 seconds, transcript and WebVTT for quickstart.');
