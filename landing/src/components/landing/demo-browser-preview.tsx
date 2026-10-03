import { useState } from 'react';
import { Globe } from 'lucide-react';
import { Button } from './desktop-demo-button';
export function DemoBrowserPreview({approved}:{approved:boolean}) {
  const [email,setEmail]=useState('');
  const [status,setStatus]=useState('');
  return <div className="sheet-overview"><div className="sheet-browser-address"><Globe/>localhost · Vista de ejemplo</div><form className="sheet-browser-page" noValidate onSubmit={event=>{event.preventDefault();setStatus(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?'Formulario válido. No se envía ningún dato.':approved?'Escribe un correo válido, como nombre@equipo.com.':'Entrada inválida');}}><span>SPARTA DEMO</span><h3>Hablemos de tu proyecto.</h3><p>Prueba la validación del formulario.</p><label>Correo<input aria-label="Correo del formulario de ejemplo" type="email" value={email} placeholder="nombre@equipo.com" onChange={event=>{setEmail(event.target.value);setStatus('');}}/></label><Button type="submit">Probar formulario</Button>{status&&<p role="status">{status}</p>}<small>Ejemplo local · Sin enviar datos.</small></form></div>;
}
