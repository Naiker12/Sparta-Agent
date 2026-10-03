import { useDemoPreferences } from './demo-preferences';
import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Command } from 'cmdk';
import { Check, ChevronDown, Search } from 'lucide-react';
import { getPublicUrl } from '@/lib/utils';
import openrouterLogo from '../../../../desktop/frontend-spartan/public/provider-logos/openrouter.svg?url';

type Model = { provider: string; name: string };
const logo = (model: Model) => model.provider === 'openrouter' ? openrouterLogo : getPublicUrl(`brand/${model.provider}.svg`);

export function DemoModelSelector({ models, selected, onSelect, onOpen, theme }: {
  models: readonly Model[]; selected: number; onSelect: (index: number) => void; onOpen: () => void;
  theme: string;
}) {
  const { style } = useDemoPreferences();
  const [open, setOpen] = useState(false);
  return <div className="demo-model-picker"><Popover.Root open={open} onOpenChange={value => { setOpen(value); if (value) onOpen(); }}>
    <Popover.Trigger aria-label="Elegir modelo de ejemplo"><img src={logo(models[selected])} alt="" /><span>{models[selected].name}</span><ChevronDown /></Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="top" align="end" sideOffset={8}>
      <Popover.Popup className="sparta-preview demo-composer-popover demo-model-popover" data-demo-theme={theme} style={style}>
        <Popover.Title>Elegir modelo</Popover.Title>
        <Command label="Modelos de ejemplo">
          <div className="demo-model-search"><Search /><Command.Input aria-label="Buscar modelo de ejemplo" placeholder="Buscar modelo o proveedor…" /></div>
          <Command.List><Command.Empty>No hay modelos que coincidan.</Command.Empty>
            <Command.Group heading="Modelos de ejemplo · Por API">
              {models.map((model, index) => <Command.Item key={model.name} value={model.name} keywords={[model.provider]} onSelect={() => { onSelect(index); setOpen(false); }}>
                <img src={logo(model)} alt="" /><span>{model.name}</span>{selected === index && <Check />}
              </Command.Item>)}
            </Command.Group>
          </Command.List>
        </Command>
        <Popover.Description>Catálogo local para explorar la interfaz.</Popover.Description>
      </Popover.Popup>
    </Popover.Positioner></Popover.Portal>
  </Popover.Root></div>;
}
