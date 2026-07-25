import { ThemeProvider } from './components/theme-provider';
import { Navbar } from './components/sections/navbar';
import { Hero } from './components/sections/hero';
import { TrustBar } from './components/sections/trust-bar';
import { ValueProps } from './components/sections/value-props';
import { AgentFlow } from './components/sections/agent-flow';
import { Architecture } from './components/sections/architecture';
import { SkillsEcosystem } from './components/sections/skills-ecosystem';
import { QuickStart } from './components/sections/quick-start';
import { DownloadBar } from './components/sections/download-bar';
import { Roadmap } from './components/sections/roadmap';
import { Footer } from './components/sections/footer';
import { ParticleField } from './components/canvas/particle-field';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-[#05060f] text-[#d1e4fa] flex flex-col font-sans selection:bg-[#663af3]/30 selection:text-white relative">
        {/* Three.js Animated 3D Particle Matrix */}
        <ParticleField />

        <Navbar />
        <main className="flex-1 relative z-10 space-y-4">
          <Hero />
          <TrustBar />
          <ValueProps />
          <AgentFlow />
          <Architecture />
          <SkillsEcosystem />
          <QuickStart />
          <DownloadBar />
          <Roadmap />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}


