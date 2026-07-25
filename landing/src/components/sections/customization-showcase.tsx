import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { SectionHeader } from '../ui/section-header';
import { 
  Shield, 
  Code2, 
  Terminal, 
  Sliders, 
  Sun, 
  Moon, 
  Sparkles,
  Command,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function CustomizationShowcase() {
  // Theme & State Options for the mockup
  const [activeColor, setActiveColor] = useState({ name: 'Void Violet', hex: '#663af3' });
  const [buttonRadius, setButtonRadius] = useState(6);
  const [cardRadius, setCardRadius] = useState(16);
  const [buttonText, setButtonText] = useState('Iniciar Sandbox');
  const [logoIcon, setLogoIcon] = useState<'spartan' | 'code' | 'shield'>('spartan');
  const [isDarkMock, setIsDarkMock] = useState(true);
  const [activeDirectory, setActiveDirectory] = useState('~/workspace/mi-proyecto-local');

  const swatches = [
    { name: 'Void Violet', hex: '#663af3' },
    { name: 'Signal Blue', hex: '#027dea' },
    { name: 'Deep Teal', hex: '#269684' },
    { name: 'Ember Glow', hex: '#e46d4c' },
  ];

  return (
    <section id="personalizar" className="py-24 md:py-32 relative bg-transparent border-t border-[rgba(186,215,247,0.12)]">
      {/* Background radial spotlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#663af3]/5 blur-[150px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Unified Section Header */}
        <SectionHeader
          eyebrow="BRANDING & STYLE // CUSTOMIZATION"
          title="Tu Entorno. Tu Estilo."
          description="Personaliza el aspecto del IDE agéntico. Adapta los colores de acento, bordes de componentes y logotipos para integrarse perfectamente a tu flujo de diseño."
        />

        {/* Layout: Interactive Design Area with Inspector Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-6xl mx-auto relative">
          
          {/* LEFT COLUMN: Floating Figma-style Inspector Controls (Col 4) */}
          <div className="lg:col-span-4 space-y-6 relative z-30">
            
            {/* Inspector Panel 1: Styling Controls */}
            <Card className="p-6 border-[rgba(186,215,247,0.12)] bg-[rgba(5,6,15,0.97)] space-y-5 shadow-xl relative">
              <div className="flex items-center gap-2 pb-3 border-b border-[rgba(186,215,247,0.08)]">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-mono text-[#d8ecf8] font-bold uppercase tracking-wider">Style Inspector</span>
              </div>

              {/* Colour Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#9da7ba]">
                  <span>COLOR DE ACENTO</span>
                  <span className="text-[#d8ecf8] font-bold">{activeColor.name}</span>
                </div>
                <div className="flex gap-2">
                  {swatches.map((swatch) => (
                    <button
                      key={swatch.hex}
                      onClick={() => setActiveColor(swatch)}
                      className={`w-7 h-7 rounded-[6px] transition-all cursor-pointer relative flex items-center justify-center border ${
                        activeColor.hex === swatch.hex
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-[rgba(186,215,247,0.2)] hover:scale-105'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                      title={swatch.name}
                    >
                      {activeColor.hex === swatch.hex && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Button Radius Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#9da7ba]">
                  <span>RADIO DE BOTÓN</span>
                  <span className="text-[#d8ecf8] font-mono">{buttonRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={buttonRadius}
                  onChange={(e) => setButtonRadius(Number(e.target.value))}
                  className="w-full h-1 bg-[rgba(186,215,247,0.12)] rounded-lg appearance-none cursor-pointer accent-[#663af3]"
                />
              </div>

              {/* Card Radius Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#9da7ba]">
                  <span>RADIO DE TARJETA</span>
                  <span className="text-[#d8ecf8] font-mono">{cardRadius}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="28"
                  value={cardRadius}
                  onChange={(e) => setCardRadius(Number(e.target.value))}
                  className="w-full h-1 bg-[rgba(186,215,247,0.12)] rounded-lg appearance-none cursor-pointer accent-[#663af3]"
                />
              </div>
            </Card>

            {/* Inspector Panel 2: Component Configuration */}
            <Card className="p-6 border-[rgba(186,215,247,0.12)] bg-[rgba(5,6,15,0.97)] space-y-5 shadow-xl relative">
              <div className="flex items-center gap-2 pb-3 border-b border-[rgba(186,215,247,0.08)]">
                <Command className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-mono text-[#d8ecf8] font-bold uppercase tracking-wider">Component Config</span>
              </div>

              {/* Button Text Field */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-[#9da7ba] uppercase block">Texto del Botón</label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="Texto del botón..."
                  className="w-full bg-[rgba(199,211,234,0.06)] text-white text-xs rounded-[6px] px-3 py-2 border border-[rgba(186,215,247,0.12)] focus:border-indigo-500/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Logo Selector */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-[#9da7ba] uppercase block">Logotipo Activo</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['spartan', 'code', 'shield'] as const).map((logo) => (
                    <button
                      key={logo}
                      onClick={() => setLogoIcon(logo)}
                      className={`p-2 rounded-[6px] border text-xs text-[#c7d3ea] capitalize transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        logoIcon === logo
                          ? 'bg-[rgba(186,214,247,0.08)] border-indigo-500/50 text-white font-semibold'
                          : 'bg-black/30 border-[rgba(186,215,247,0.08)] hover:text-white'
                      }`}
                    >
                      {logo === 'spartan' ? (
                        <Terminal className="w-4 h-4 text-[#b6d9fc]" />
                      ) : logo === 'code' ? (
                        <Code2 className="w-4 h-4 text-[#b6d9fc]" />
                      ) : (
                        <Shield className="w-4 h-4 text-[#b6d9fc]" />
                      )}
                      <span className="text-[10px]">{logo}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Theme Switcher */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-[#9da7ba] uppercase block">Previsualización de Tarjeta</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsDarkMock(true)}
                    className={`flex-1 p-2 rounded-full border text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      isDarkMock 
                        ? 'bg-[rgba(186,214,247,0.12)] text-white border-[rgba(186,215,247,0.2)] font-semibold'
                        : 'bg-black/20 border-transparent text-[#9da7ba]'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Oscuro</span>
                  </button>
                  <button
                    onClick={() => setIsDarkMock(false)}
                    className={`flex-1 p-2 rounded-full border text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      !isDarkMock 
                        ? 'bg-white text-black border-white font-semibold'
                        : 'bg-black/20 border-transparent text-[#9da7ba]'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Claro</span>
                  </button>
                </div>
              </div>
            </Card>

          </div>

          {/* RIGHT COLUMN: The Live-Updating Mock Browser Window (Col 8) */}
          <div className="lg:col-span-8 relative flex items-center justify-center p-2 sm:p-6 bg-black/40 rounded-[20px] border border-[rgba(186,215,247,0.06)] shadow-inner">
            
            {/* Mock browser container */}
            <div className="w-full max-w-[500px] rounded-[12px] overflow-hidden border border-[rgba(186,215,247,0.12)] bg-[#05060f] shadow-2xl transition-all duration-300">
              
              {/* Browser Window Header */}
              <div className="bg-[#080914] px-4 py-3 border-b border-[rgba(186,215,247,0.08)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <div className="text-[10px] font-mono text-[#9da7ba] truncate max-w-[240px]">
                  sparta-agent — task-runner
                </div>
                <div className="w-4" /> {/* spacer */}
              </div>

              {/* Browser Inner Workspace */}
              <div className={`p-8 flex items-center justify-center transition-colors duration-300 ${
                isDarkMock ? 'bg-[#0a0b16]' : 'bg-[#f4f4f7]'
              }`}>
                
                {/* Dynamically styled Card */}
                <div
                  className={`w-full max-w-[340px] p-6 border transition-all duration-300 shadow-xl relative ${
                    isDarkMock
                      ? 'bg-[rgba(5,6,15,0.97)] border-[rgba(186,215,247,0.12)] text-[#d1e4fa] shadow-[inset_0_1px_1px_rgba(216,236,248,0.2),inset_0_24px_48px_rgba(168,216,245,0.05)]'
                      : 'bg-white border-zinc-200 text-zinc-800'
                  }`}
                  style={{ borderRadius: `${cardRadius}px` }}
                >
                  {/* Glowing halo behind active card */}
                  <div 
                    className="absolute -inset-px blur-xl opacity-30 pointer-events-none rounded-inherit transition-colors duration-500"
                    style={{ 
                      backgroundImage: `radial-gradient(circle, ${activeColor.hex} 0%, transparent 70%)` 
                    }} 
                  />

                  <div className="relative space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-500/10">
                      <div className="flex items-center gap-2">
                        {logoIcon === 'spartan' ? (
                          <Terminal className="w-5 h-5" style={{ color: activeColor.hex }} />
                        ) : logoIcon === 'code' ? (
                          <Code2 className="w-5 h-5" style={{ color: activeColor.hex }} />
                        ) : (
                          <Shield className="w-5 h-5" style={{ color: activeColor.hex }} />
                        )}
                        <span className={`text-[11px] font-mono tracking-wider uppercase font-semibold ${
                          isDarkMock ? 'text-[#d8ecf8]' : 'text-zinc-700'
                        }`}>
                          Sparta Task Runner
                        </span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] font-mono border-zinc-500/20 py-0.5 px-2 ${
                        isDarkMock ? 'text-[#b6d9fc] bg-black/40' : 'text-zinc-500 bg-zinc-100'
                      }`}>
                        Active
                      </Badge>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <label className={`text-[9px] font-mono uppercase tracking-wider block ${
                          isDarkMock ? 'text-[#c7d3ea]' : 'text-zinc-700'
                        }`}>
                          Ruta del Workspace Local
                        </label>
                        <input
                          type="text"
                          value={activeDirectory}
                          onChange={(e) => setActiveDirectory(e.target.value)}
                          className={`w-full text-xs px-3 py-2 border focus:outline-none transition-colors ${
                            isDarkMock
                              ? 'bg-[rgba(199,211,234,0.06)] text-white border-[rgba(186,215,247,0.12)] focus:border-indigo-500/50'
                              : 'bg-zinc-50 text-zinc-800 border-zinc-200 focus:border-zinc-400'
                          }`}
                          style={{ borderRadius: `${buttonRadius}px` }}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className={`text-[9px] font-mono uppercase tracking-wider block ${
                          isDarkMock ? 'text-[#c7d3ea]' : 'text-zinc-700'
                        }`}>
                          Diagnósticos Compilación
                        </label>
                        <div className={`p-2.5 border font-mono text-[10px] flex items-center justify-between ${
                          isDarkMock 
                            ? 'bg-black/30 border-[rgba(186,215,247,0.06)] text-[#9da7ba]' 
                            : 'bg-zinc-50 border-zinc-100 text-zinc-500'
                        }`}
                        style={{ borderRadius: `${buttonRadius}px` }}
                        >
                          <span className="flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                            eslint / tsc
                          </span>
                          <span className="text-emerald-500 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Passed
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Action Button */}
                    <div className="pt-3">
                      <button
                        className="w-full text-white text-xs font-semibold py-2.5 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-black/20"
                        style={{ 
                          backgroundColor: activeColor.hex, 
                          borderRadius: `${buttonRadius}px` 
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{buttonText}</span>
                      </button>
                    </div>
                  </div>

                </div>

              </div>

            </div>

            {/* floating labels / specs tags */}
            <div className="absolute bottom-2 left-6 text-[10px] font-mono text-[#9da7ba] hidden md:inline">
              accent: <span style={{ color: activeColor.hex }}>{activeColor.hex}</span>
            </div>
            <div className="absolute bottom-2 right-6 text-[10px] font-mono text-[#9da7ba] hidden md:inline">
              radius: <span>{buttonRadius}px / {cardRadius}px</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
