import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { DESKTOP_PALETTES } from './desktop-palettes.generated';
import type { DemoNavId } from './demo-navigation-items';

export type DemoPreferences = {
  resetEpoch: number;
  channelProfile: boolean; channelProject: boolean; channelVoice: boolean;
  nickname: string; avatarImage: string | null; avatarShape: 'circle' | 'rounded';
  themeMode: 'light' | 'dark' | 'system';
  palette: 'standard' | 'classic' | 'minimal';
  colors: Record<'light' | 'dark', { accent: string; background: string; foreground: string }>;
  uiFont: string; headingFont: string; chatFont: string; codeFont: string;
  uiSize: number; codeSize: number; contrast: number; pointer: boolean; smoothing: boolean;
  motion: 'system' | 'on' | 'off';
  showProjects: boolean; showDisclaimer: boolean; showResponseModel: boolean; autoTitle: boolean;
  shareAttachments: boolean; rememberParams: boolean; pasteThreshold: number;
  plusPins: Record<'mcp' | 'savedPrompts' | 'compareChat' | 'exportChat' | 'canvas' | 'projects' | 'bypassPermissions', boolean>;
  navPins: Record<DemoNavId, boolean>; navOrder: DemoNavId[];
};
export const DEFAULT_DEMO_PREFERENCES: DemoPreferences = {
  channelProfile: true, channelProject: true, channelVoice: false,
  nickname: '', avatarImage: null, avatarShape: 'circle',
  resetEpoch: 0, themeMode: 'light', palette: 'standard', colors: { light: { accent: '', background: '', foreground: '' }, dark: { accent: '', background: '', foreground: '' } },
  uiFont: 'Inter Variable, system-ui, sans-serif', headingFont: 'SpartaHellix, sans-serif', chatFont: 'Inter Variable, system-ui, sans-serif', codeFont: 'ui-monospace, monospace',
  uiSize: 15, codeSize: 13, contrast: 50, pointer: false, smoothing: true, motion: 'system',
  showProjects: true, showDisclaimer: true, showResponseModel: false, autoTitle: false, shareAttachments: true, rememberParams: true, pasteThreshold: 4000,
  plusPins: { mcp: true, savedPrompts: false, compareChat: false, exportChat: false, canvas: false, projects: true, bypassPermissions: false },
  navPins: { projects: true, audio: false, recipes: false, export: false, api: false, memory: false, automations: false },
  navOrder: ['projects', 'audio', 'recipes', 'export', 'api', 'memory', 'automations'],
};
export function demoAppearanceStyle(prefs: DemoPreferences, theme: 'light' | 'dark'): CSSProperties {
  const palette = DESKTOP_PALETTES[prefs.palette][theme];
  const colors = prefs.colors[theme];
  return {
    ...Object.fromEntries(Object.entries(palette).map(([key, value]) => [`--demo-${key}`, value])),
    ...(prefs.contrast !== 50 ? {
      '--demo-muted': `color-mix(in srgb, ${colors.foreground || palette.text} ${25 + prefs.contrast / 2}%, ${colors.background || palette.bg})`,
      '--demo-border': `color-mix(in srgb, ${colors.foreground || palette.text} ${5 + prefs.contrast / 4}%, ${colors.background || palette.bg})`,
    } : {}),
    ...(colors.accent ? { '--demo-primary': colors.accent } : {}),
    ...(colors.background ? { '--demo-bg': colors.background } : {}),
    ...(colors.foreground ? { '--demo-text': colors.foreground } : {}),
    '--demo-ui-font': prefs.uiFont, '--demo-heading-font': prefs.headingFont, '--demo-chat-font': prefs.chatFont, '--demo-code-font': prefs.codeFont,
    '--demo-ui-size': `${prefs.uiSize}px`, '--demo-code-size': `${prefs.codeSize}px`,
    '--demo-cursor': prefs.pointer ? 'pointer' : 'default',
    WebkitFontSmoothing: prefs.smoothing ? 'antialiased' : 'auto',
  } as CSSProperties;
}
const PreferencesContext = createContext({ prefs: DEFAULT_DEMO_PREFERENCES, update: (_patch: Partial<DemoPreferences>) => {}, style: {} as CSSProperties });
export function DemoPreferencesProvider({ prefs, update, theme, children }: { prefs: DemoPreferences; update: (patch: Partial<DemoPreferences>) => void; theme: 'light' | 'dark'; children: ReactNode }) {
  return <MotionConfig reducedMotion={prefs.motion === 'on' ? 'always' : prefs.motion === 'off' ? 'never' : 'user'}><PreferencesContext.Provider value={{ prefs, update, style: demoAppearanceStyle(prefs, theme) }}>{children}</PreferencesContext.Provider></MotionConfig>;
}
export const useDemoPreferences = () => useContext(PreferencesContext);
