import { Reorder, useDragControls } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { DragDropVerticalIcon, PencilEdit02Icon } from '@hugeicons/core-free-icons';
import { Switch } from '../../../../desktop/frontend-spartan/src/components/ui/switch';
import { useDemoPreferences } from './demo-preferences';
import { DEMO_NAV_ITEMS, type DemoNavId } from './demo-navigation-items';

function MovableDemoNavRow({ id }: { id: DemoNavId }) {
  const { prefs, update } = useDemoPreferences();
  const controls = useDragControls();
  const item = DEMO_NAV_ITEMS.find(value => value.id === id)!;
  return <Reorder.Item value={id} dragListener={false} dragControls={controls} className="demo-custom-nav-row">
    <button type="button" className="demo-nav-drag" aria-label={`Reordenar ${item.label}`} title="Arrastra o usa las flechas arriba y abajo" onPointerDown={event => { event.preventDefault(); controls.start(event); }} onKeyDown={event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault(); const order = [...prefs.navOrder]; const index = order.indexOf(id); const next = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (next < 0 || next >= order.length) return;
      [order[index], order[next]] = [order[next], order[index]]; update({ navOrder: order });
    }}><HugeiconsIcon icon={DragDropVerticalIcon} /></button>
    <HugeiconsIcon icon={item.icon} strokeWidth={1.75} /><span>{item.label}</span><Switch aria-label={`Fijar ${item.label}`} checked={prefs.navPins[id]} onCheckedChange={value => update({ navPins: { ...prefs.navPins, [id]: value } })} />
  </Reorder.Item>;
}
export function DemoSidebarCustomizer() {
  const { prefs, update } = useDemoPreferences();
  return <div className="demo-custom-nav"><div className="demo-custom-nav-row demo-custom-nav-fixed"><span /><HugeiconsIcon icon={PencilEdit02Icon} /><span>Nuevo chat</span></div><Reorder.Group axis="y" values={prefs.navOrder} onReorder={navOrder => update({ navOrder })}>{prefs.navOrder.map(id => <MovableDemoNavRow key={id} id={id} />)}</Reorder.Group><div className="demo-custom-nav-row demo-custom-nav-fixed"><span /><span>···</span><span>Más</span></div></div>;
}
