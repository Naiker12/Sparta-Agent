import { createRoot } from 'react-dom/client';
import { AssistantRuntimeProvider, MessagePrimitive, ThreadPrimitive, useLocalRuntime } from '@assistant-ui/react';
import { PythonToolUI } from '../../src/components/assistant-ui/tool-ui-python';
import '../../src/index.css';
function Fixture() {
  const runtime = useLocalRuntime({ async *run() {} }, {initialMessages:[{
    role:'assistant',content:[{type:'tool-call',toolCallId:'probe',toolName:'python',args:{code:'import importlib\nprint("LIBRARY_PROBE_DETAILS")'},argsText:'{}',result:{text:'Available',images:[],sessionId:'fixture',files:[]}}],
  }]});
  return <AssistantRuntimeProvider runtime={runtime}><ThreadPrimitive.Root><ThreadPrimitive.Messages components={{AssistantMessage: () => <MessagePrimitive.Root><MessagePrimitive.Parts components={{tools:{by_name:{python:PythonToolUI}}}} /></MessagePrimitive.Root>}} /></ThreadPrimitive.Root></AssistantRuntimeProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
