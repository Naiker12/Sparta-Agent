export interface VideoEntry {
  id: string;
  title: string;
  slug: string;
  duration: string;
  version: string;
  status: 'ready' | 'draft' | 'planned';
  src: string;
  poster: string;
  captions?: string;
  transcript?: {
    time: string;
    chapter: string;
    text: string;
  }[];
  note?: string;
}

export const videoCatalog: Record<string, VideoEntry> = {
  'first-task': {
    id: 'first-task',
    title: 'Tu primera tarea: flujo ilustrado',
    slug: 'guides/first-task',
    duration: '01:00',
    version: '0.3.0',
    status: 'ready',
    src: 'videos/first-task.mp4',
    poster: 'videos/first-task-poster.webp',
    captions: 'videos/first-task.es.vtt',
    note: 'Flujo ilustrado de 60 segundos. No sustituye la grabación de la aplicación real.',
    transcript: [
      { time: '00:00–00:10', chapter: 'Contexto', text: 'Una tarea. Un cambio comprobable. Empieza con una carpeta pequeña y un objetivo que puedas revisar. La meta no es recibir una respuesta: es comprobar el resultado.' },
      { time: '00:10–00:20', chapter: 'Lectura', text: 'Primero, entiende el archivo. Pide una lectura antes de solicitar cambios. Confirma el archivo y el problema. Comprueba que la respuesta corresponde al documento elegido.' },
      { time: '00:20–00:30', chapter: 'Alcance', text: 'Define qué puede cambiar. Una instrucción concreta hace más fácil revisar la acción y detectar cambios de más. Evita una petición amplia si solo necesitas una corrección pequeña.' },
      { time: '00:30–00:40', chapter: 'Permiso', text: 'Revisa antes de autorizar. Si Sparta pide permiso, comprueba la acción, el recurso y su alcance. Si el alcance no coincide, rechaza la acción y aclara la tarea.' },
      { time: '00:40–00:50', chapter: 'Cambio', text: 'El resultado vive en el archivo. Espera la salida de la herramienta. Después vuelve a leer el documento. Una respuesta del chat no demuestra por sí sola que el cambio exista.' },
      { time: '00:50–01:00', chapter: 'Verificación', text: 'Lee otra vez. Compara. Comprueba. Termina la tarea cuando puedas explicar qué cambió y por qué está bien. Contexto → lectura → alcance → permiso → cambio → verificación.' },
    ],
  },
  'chat-vs-agent-mode': {
    id: 'chat-vs-agent-mode',
    title: 'Chat vs Modo Agente: conceptos clave',
    slug: 'core-concepts/chat-vs-agent-mode',
    duration: '01:00',
    version: '0.3.0',
    status: 'ready',
    src: 'videos/chat-vs-agent-mode.mp4',
    poster: 'videos/chat-vs-agent-mode-poster.webp',
    captions: 'videos/chat-vs-agent-mode.es.vtt',
    note: 'Explicación visual del selector de modo, consulta de solo lectura y tarjeta modal de permisos.',
    transcript: [
      { time: '00:00–00:10', chapter: 'Selector', text: 'Dos modos. Diferentes permisos. Sparta separa la consulta segura de la modificación con herramientas. El modo seleccionado define si el modelo solo analiza o puede actuar.' },
      { time: '00:10–00:20', chapter: 'Modo Chat', text: 'Lectura y búsqueda sin riesgo. Permite inspeccionar, listar y entender tus archivos sin alterar nada. En Modo Chat queda prohibido crear, modificar o eliminar archivos.' },
      { time: '00:20–00:30', chapter: 'Protección', text: '¿Intentas editar en Modo Chat? Si pides una edición o borrado, el sistema detiene la acción y te avisa: «Debes activar el Modo Agente en el selector de modo para crear, editar o borrar recursos.»' },
      { time: '00:30–00:40', chapter: 'Modo Agente', text: 'Edición y comandos bajo tu mando. Habilita herramientas de escritura y ejecución en tu espacio de trabajo. Cada modificación exige una tarjeta de confirmación previa.' },
      { time: '00:40–00:50', chapter: 'Permisos', text: 'Tú apruebas cada cambio antes de actuar. Revisa la herramienta, el archivo exacto y el contenido propuesto. Si el alcance no coincide con lo esperado, rechaza la acción.' },
      { time: '00:50–01:00', chapter: 'Resumen', text: 'Consulta. Autoriza. Verifica. Un flujo predecible garantiza que tu proyecto se mantenga seguro. Consulta en Modo Chat, ejecuta en Modo Agente y revisa siempre el resultado.' },
    ],
  },
};
