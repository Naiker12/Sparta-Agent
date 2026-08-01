import { useState, useEffect } from 'react';
import { ThemeToggle } from '../theme-toggle';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { getPublicUrl } from '../../lib/utils';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const faviconSrc = getPublicUrl('favicon.svg');

  const navLinks = [
    { name: 'Conectores MCP', href: '#mcp' },
    { name: 'Flujo Agéntico', href: '#flujo-agentico' },
    { name: 'Arquitectura', href: '#arquitectura' },
    { name: 'Seguridad', href: '#seguridad' },
    { name: 'Skills', href: '#skills' },
    { name: 'Descargas', href: '#descargas' },
  ];

  return (
    <header
      className={`sticky top-0 z-50 h-16 w-full border-b transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 dark:bg-[#07050d]/90 backdrop-blur-xl border-slate-200 dark:border-white/10 shadow-lg shadow-slate-900/5 dark:shadow-black/40'
          : 'bg-white/60 dark:bg-transparent border-slate-200 dark:border-white/10'
      }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8">
        {/* Crisp Icon + Full Name Text */}
        <a href="#" className="flex items-center gap-2.5 group select-none">
          <img
            src={faviconSrc}
            alt="Sparta Agent Icon Logo"
            className="h-8 w-8 object-contain dark:invert-0 invert drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] group-hover:scale-105 transition-transform"
          />
          <span className="font-display font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
            Sparta Agent
          </span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-white/[0.03] p-1.5 rounded-full border border-slate-200 dark:border-white/10 backdrop-blur-md">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10 rounded-full transition-all duration-200"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Actions CTA */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />

          <a
            href="https://github.com/Naiker12/Sparta-Agent"
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="px-4 py-2 rounded-xl bg-[#663af3] hover:bg-[#7c4dff] text-white font-mono font-bold text-xs shadow-md shadow-[#663af3]/30 transition-all cursor-pointer flex items-center gap-2 border border-[#663af3]">
              <GithubIcon className="w-4 h-4 text-white" />
              <span>GitHub</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </a>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-[#07050d] border-b border-slate-200 dark:border-white/10 px-4 py-6 space-y-4">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white"
            >
              {link.name}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
