import { Mascot } from 'page-mascot';
import { mascotCharacter } from '../../../../desktop/frontend-spartan/src/features/profile/mascot-catalog';
import { mascotSheet } from '../../../../desktop/frontend-spartan/src/features/profile/mascot-assets';

/** Presentation adapter: desktop avatar rendering without its authenticated store. */
export function DemoProfileAvatar({ seed, image, shape, size, interactive = false }: { seed: string; image: string | null; shape: 'circle' | 'rounded'; size: number; interactive?: boolean }) {
  const character = mascotCharacter(seed);
  return <span className="demo-profile-avatar" data-mascot={image ? undefined : character} style={{ width: size, height: size, borderRadius: shape === 'circle' ? '50%' : '22%' }}>
    {image ? <img src={image} alt="" /> : interactive ? <Mascot key={character} directions={mascotSheet(character, 'directions')} reactions={mascotSheet(character, 'reactions')} size={size} label={`Mascota ${character}`} /> : <span className="demo-mascot-crop"><img src={mascotSheet(character, 'directions')} alt="" loading="lazy" /></span>}
  </span>;
}
