import { GeneratedAvatar } from '../../../../desktop/frontend-spartan/src/components/ui/blobatar-avatar';

/** Presentation adapter: desktop avatar rendering without its authenticated store. */
export function DemoProfileAvatar({ seed, image, shape, size }: { seed: string; image: string | null; shape: 'circle' | 'rounded'; size: number }) {
  return <span className="demo-profile-avatar" style={{ width: size, height: size, borderRadius: shape === 'circle' ? '50%' : '22%' }}>
    {image ? <img src={image} alt="" /> : <GeneratedAvatar name={seed} size={size} />}
  </span>;
}
