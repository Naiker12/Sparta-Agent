import { mkdirSync, writeFileSync } from 'node:fs';

const scenes = [
  {
    id: 'mode-selector',
    chapter: 'Selector',
    tag: 'CONTROL TOTAL',
    title: ['Dos modos.', 'Diferentes', 'permisos.'],
    lead: 'Sparta separa la consulta segura de la modificación con herramientas.',
    panel: `<div class="file">SELECTOR DE MODO <span>Barra de estado</span></div><div class="mode-pill active">● Modo Chat <span>Solo lectura · Consultas</span></div><div class="mode-pill">○ Modo Agente <span>Herramientas · Modificación</span></div><div class="small-note">Cambia de modo según la tarea que necesites realizar.</div>`,
    note: 'El modo seleccionado define si el modelo solo analiza o puede actuar.'
  },
  {
    id: 'chat-mode',
    chapter: 'Modo Chat',
    tag: 'CONSULTA SEGURA',
    title: ['Lectura y', 'búsqueda', 'sin riesgo.'],
    lead: 'Permite inspeccionar, listar y entender tus archivos sin alterar nada.',
    panel: `<div class="file">MODO CHAT <span>Operaciones permitidas</span></div><div class="check"><b>✓</b><div><strong>search_files</strong><p>Buscar en el código</p></div></div><div class="check"><b>✓</b><div><strong>read_file</strong><p>Leer contenido de archivos</p></div></div><div class="check"><b>✓</b><div><strong>web_search</strong><p>Consultas y documentación</p></div></div>`,
    note: 'En Modo Chat queda prohibido crear, modificar o eliminar archivos.'
  },
  {
    id: 'safety-guard',
    chapter: 'Protección',
    tag: 'REGLA DE SEGURIDAD',
    title: ['¿Intentas', 'editar en', 'Modo Chat?'],
    lead: 'Si pides una edición o borrado, el sistema detiene la acción y te avisa.',
    panel: `<div class="file">AVISO DEL SISTEMA <span>Protección activa</span></div><div class="quote">«Debes activar el Modo Agente en el selector de modo para crear, editar o borrar recursos.»</div><div class="rule"></div><div class="detail"><span>Petición</span><strong>Crear / Modificar</strong></div><div class="detail"><span>Estado</span><strong style="color:#dfd68b">Acción bloqueada</strong></div>`,
    note: 'El modelo no puede saltarse la protección de solo lectura.'
  },
  {
    id: 'agent-mode',
    chapter: 'Modo Agente',
    tag: 'ACCIÓN AUTORIZADA',
    title: ['Edición y', 'comandos', 'bajo tu mando.'],
    lead: 'Habilita herramientas de escritura y ejecución en tu espacio de trabajo.',
    panel: `<div class="file">MODO AGENTE <span>Herramientas de acción</span></div><div class="check"><b>⚡</b><div><strong>write_file</strong><p>Crear y editar archivos</p></div></div><div class="check"><b>⚡</b><div><strong>run_command</strong><p>Ejecutar en la terminal</p></div></div><div class="check"><b>⚡</b><div><strong>delete_file</strong><p>Eliminar recursos autorizados</p></div></div>`,
    note: 'Cada modificación exige una tarjeta de confirmación previa.'
  },
  {
    id: 'permission-modal',
    chapter: 'Permisos',
    tag: 'TARJETA MODAL PREVIA',
    title: ['Tú apruebas', 'cada cambio', 'antes de actuar.'],
    lead: 'Revisa la herramienta, el archivo exacto y el contenido propuesto.',
    panel: `<div class="file">SOLICITUD DE PERMISO <span>Modal interactivo</span></div><div class="detail"><span>Herramienta</span><strong>write_file</strong></div><div class="detail"><span>Destino</span><strong>src/config.ts</strong></div><div class="rule"></div><div class="diff fresh">Actualizar variable API_ENDPOINT</div><div class="actions"><span class="btn-approve">Aprobar acción</span><span class="btn-reject">Rechazar</span></div>`,
    note: 'Si el alcance no coincide con lo esperado, rechaza la acción.'
  },
  {
    id: 'summary',
    chapter: 'Resumen',
    tag: 'RESUMEN DEL FLUJO',
    title: ['Consulta.', 'Autoriza.', 'Verifica.'],
    lead: 'Un flujo predecible garantiza que tu proyecto se mantenga seguro.',
    panel: `<div class="file">RESUMEN <span>Flujo de trabajo</span></div><div class="check"><b>1</b><div><strong>Usa Modo Chat</strong><p>Para preguntas, análisis y exploración.</p></div></div><div class="check"><b>2</b><div><strong>Activa Modo Agente</strong><p>Para ediciones con confirmación modal.</p></div></div><div class="check"><b>3</b><div><strong>Revisa el resultado</strong><p>Comprueba siempre el diff final en el archivo.</p></div></div>`,
    note: 'Más detalles en la guía: «Chat y modo agente».'
  }
];

const css = `
*{box-sizing:border-box} .layout{position:absolute;inset:0;color:#edede7;font-family:Inter,sans-serif}
.copy{position:absolute;left:100px;top:215px;width:740px}.kicker{font-size:24px;letter-spacing:4px;color:#dfd68b;margin:0 0 25px;font-weight:600}
h1{font-size:88px;line-height:1.04;letter-spacing:-4px;margin:0 0 32px;font-weight:650}h1 span{display:block}.lead{font-size:32px;line-height:1.5;color:#bfc1b5;margin:0;max-width:690px}
.panel{position:absolute;left:970px;top:240px;width:850px;min-height:570px;padding:40px;background:#191a17;border:2px solid #36382f;border-radius:20px}
.file{display:flex;justify-content:space-between;align-items:center;font-size:27px;color:#edede7;padding-bottom:26px;border-bottom:2px solid #36382f;font-weight:600}.file span{font-size:24px;color:#bfc1b5;font-weight:400}
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
.actions{display:flex;gap:20px;margin-top:30px}
.btn-approve{flex:1;text-align:center;padding:18px;background:#dfd68b;color:#111210;font-weight:700;font-size:26px;border-radius:10px}
.btn-reject{flex:1;text-align:center;padding:18px;background:#292a25;color:#bfc1b5;font-weight:500;font-size:26px;border-radius:10px;border:1px solid #36382f}
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

writeFileSync('index.html', `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Sparta · Chat vs Modo Agente</title><script src="assets/gsap.min.js"></script><style>
@font-face{font-family:Inter;src:url('assets/inter-latin-wght-normal.woff2') format('woff2');font-weight:100 900;font-display:block}*{box-sizing:border-box}body{margin:0;background:#111210}#main{position:relative;width:1920px;height:1080px;overflow:hidden;background:#111210;color:#edede7;font-family:Inter,sans-serif}.clip{position:absolute;inset:0}.masthead{position:absolute;left:100px;right:100px;top:60px;display:flex;justify-content:space-between;align-items:center;height:70px;border-bottom:2px solid #36382f;padding-bottom:28px;font-size:28px}.brand{font-weight:700;font-size:36px}.brand span{font-weight:400;color:#bfc1b5;font-size:26px;margin-left:24px}.badge{color:#dfd68b;font-size:24px;letter-spacing:2px}.footer{position:absolute;left:100px;top:985px;width:1720px;display:flex;justify-content:space-between;color:#bfc1b5;font-size:25px}.progress{position:absolute;left:100px;top:960px;width:1720px;height:3px;background:#36382f}.fill{width:1720px;height:3px;background:#dfd68b;transform-origin:left}.footer span{width:250px}.footer span:last-child{text-align:right}
</style></head><body><div id="main" data-composition-id="main" data-width="1920" data-height="1080" data-duration="60"><div class="masthead"><div class="brand">Sparta<span>Chat vs Modo Agente</span></div><div class="badge">CONCEPTOS CLAVE · 02</div></div>${scenes.map((s,i)=>`<div id="host-${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${i*10}" data-duration="10" data-track-index="${i+1}" data-width="1920" data-height="1080"></div>`).join('')}<div class="progress"><div class="fill"></div></div><div class="footer">${scenes.map(s=>`<span id="label-${s.id}">${s.chapter}</span>`).join('')}</div></div><script>const tl=gsap.timeline({paused:true});tl.fromTo('.fill',{scaleX:0},{scaleX:1,duration:60,ease:'none'},0);${scenes.map((s,i)=>`tl.to('#label-${s.id}',{color:'#dfd68b',duration:.2},${i*10});`).join('')}window.__timelines['main']=tl;</script></body></html>`);

writeFileSync('STORYBOARD.md', `# Chat vs Modo Agente · Tutorial visual\n\n60 segundos. Paleta de Sparta. Adaptador GSAP y control de progreso por pasos.\n\n${scenes.map((s,i)=>`## Frame ${i+1}\nstatus: animated\nsrc: compositions/${s.id}.html\ntime: ${i*10}–${(i+1)*10}s\n\n${s.title.join(' ')} ${s.lead}\n\n${s.note}\n`).join('\n')}`);

writeFileSync('transcript.md', `# Chat vs Modo Agente: conceptos clave\n\nVideo explicativo de 60 segundos sobre el selector de modo y la política de permisos en Sparta.\n\n${scenes.map((s,i)=>`## ${i*10}–${(i+1)*10} segundos · ${s.chapter}\n\n${s.title.join(' ')} ${s.lead} ${s.note}\n`).join('\n')}`);

const stamp = n => `00:${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}.000`;
writeFileSync('captions.es.vtt', `WEBVTT\n\n${scenes.map((s,i)=>`${i+1}\n${stamp(i*10)} --> ${stamp((i+1)*10)}\n${s.title.join(' ')}\n${s.note}\n`).join('\n')}`);

console.log('Built six scenes, 60 seconds, transcript and WebVTT for chat-vs-agent-mode.');
