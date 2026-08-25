import { motion } from 'framer-motion';
import { useState } from 'react';
import { getPublicUrl } from '@/lib/utils';
import { DocsHeader } from './layout/docs-header';
import { DocsMobileNav } from './layout/docs-mobile-nav';
import { DocsSidebar } from './layout/docs-sidebar';
import { OnThisPage } from './on-this-page';

// Sections
import { InicioSection } from './content/inicio-section';
import { PrimerosPasosSection } from './content/primeros-pasos-section';
import { ArquitecturaSection } from './content/arquitectura-section';
import { AgentesSection } from './content/agentes-section';
import { TerminalSection } from './content/terminal-section';
import { McpSection } from './content/mcp-section';
import { ProvidersSection } from './content/providers-section';
import { SkillsSection } from './content/skills-section';
import { PermisosSection } from './content/permisos-section';
import { VaultSection } from './content/vault-section';

const sectionMap: Record<string, React.ComponentType> = {
  inicio: InicioSection,
  instalacion: PrimerosPasosSection,
  'desarrollo-local': PrimerosPasosSection,
  arquitectura: ArquitecturaSection,
  agentes: AgentesSection,
  terminal: TerminalSection,
  mcp: McpSection,
  proveedores: ProvidersSection,
  skills: SkillsSection,
  permisos: PermisosSection,
  vault: VaultSection,
};

export function DocsPage({ onBackToLanding }: { onBackToLanding?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const docsQuery = new URLSearchParams(window.location.search).get('docs');
  const currentPage =
    docsQuery ||
    window.location.pathname.split('/docs')[1]?.replace(/^\//, '').replace(/\/$/, '') ||
    'inicio';

  const docsHref = (slug = '') => `${getPublicUrl('')}?docs${slug ? `=${slug}` : ''}`;

  const handleHomeClick = (e: React.MouseEvent) => {
    if (onBackToLanding) {
      e.preventDefault();
      onBackToLanding();
    }
  };

  const CurrentSection = sectionMap[currentPage] || InicioSection;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-amber-400/20 selection:text-amber-200">
      <DocsHeader
        onHomeClick={handleHomeClick}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen(!menuOpen)}
        docsHref={docsHref}
      />
      <DocsMobileNav open={menuOpen} onHomeClick={handleHomeClick} docsHref={docsHref} />

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[238px_minmax(0,1fr)] xl:grid-cols-[238px_minmax(0,1fr)_200px]">
        <DocsSidebar currentPage={currentPage} docsHref={docsHref} />

        <main id="contenido" className="min-w-0 px-5 py-12 sm:px-10 lg:px-16 lg:py-16">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <CurrentSection />
          </motion.div>
        </main>

        <OnThisPage page={currentPage} />
      </div>
    </div>
  );
}
