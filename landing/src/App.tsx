import { ThemeProvider } from './components/theme-provider';
import { Navbar } from './components/sections/navbar';
import { Hero } from './components/sections/hero';
import { TrustBar } from './components/sections/trust-bar';
import { ValueProps } from './components/sections/value-props';
import { AgentFlow } from './components/sections/agent-flow';
import { Architecture } from './components/sections/architecture';
import { SecurityMatrix } from './components/sections/security-matrix';
import { CustomizationShowcase } from './components/sections/customization-showcase';
import { SkillsEcosystem } from './components/sections/skills-ecosystem';
import { QuickStart } from './components/sections/quick-start';
import { DownloadBar } from './components/sections/download-bar';
import { Footer } from './components/sections/footer';
import { ParticleField } from './components/canvas/particle-field';
import { AIRain } from './components/canvas/ai-rain';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-[#663af3]/30 selection:text-white relative transition-colors duration-300">
        {/* Three.js Animated 3D Particle Matrix */}
        <ParticleField />
        {/* AI Rain Matrix Cascade Effect */}
        <AIRain />

        <Navbar />
        <main className="flex-1 relative z-10 space-y-4">
          <Hero />
          <TrustBar />
          <ValueProps />
          <AgentFlow />
          <Architecture />
          <SecurityMatrix />
          <CustomizationShowcase />
          <SkillsEcosystem />
          <QuickStart />
          <DownloadBar />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}
