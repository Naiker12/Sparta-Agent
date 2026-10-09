import type { MascotCharacter } from './mascot-catalog';

// Vite tracks these resources in both the desktop shell and standalone renderer.
const sheets = import.meta.glob<string>('../../assets/mascots/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function mascotSheet(character: MascotCharacter, kind: 'directions' | 'reactions'): string {
  return sheets[`../../assets/mascots/${character}-${kind}.webp`];
}
