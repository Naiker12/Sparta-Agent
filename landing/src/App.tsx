import { ThemeProvider } from './components/theme-provider';
import { Navbar } from './components/sections/navbar';
import { Hero } from './components/sections/hero';
import { TrustBar } from './components/sections/trust-bar';
import { ValueProps } from './components/sections/value-props';
import { AgentFlow } from './components/sections/agent-flow';
import { Architecture } from './components/sections/architecture';
import { FeaturesGrid } from './components/sections/features-grid';
import { SecurityMatrix } from './components/sections/security-matrix';
import { SkillsEcosystem } from './components/sections/skills-ecosystem';
import { Showcase } from './components/sections/showcase';
import { Roadmap } from './components/sections/roadmap';
import { QuickStart } from './components/sections/quick-start';
import { CTA } from './components/sections/cta';
import { Footer } from './components/sections/footer';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-display)] flex flex-col font-sans selection:bg-indigo-500/20 selection:text-indigo-400">
        <Navbar />
        <main className="flex-1">
          <Hero />
          <TrustBar />
          <ValueProps />
          <AgentFlow />
          <Architecture />
          <FeaturesGrid />
          <SecurityMatrix />
          <SkillsEcosystem />
          <Showcase />
          <Roadmap />
          <QuickStart />
          <CTA />
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}
