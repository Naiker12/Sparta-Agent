import { useState, useEffect } from 'react';
import { ThemeToggle } from '../theme-toggle';
import { Button } from '../ui/button';
import { Menu, X } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';
import { useTheme } from 'next-themes';

import { getPublicUrl } from '../../lib/utils';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const logoSrc = mounted && resolvedTheme === 'light'
    ? getPublicUrl('negro/Sparta Agent.png')
    : getPublicUrl('blanco/Sparta Agent.png');

  const navLinks = [
    { name: 'Pilares', href: '#pilares' },
    { name: 'Flujo', href: '#flujo-agentico' },
    { name: 'Arquitectura', href: '#arquitectura' },
    { name: 'Personalizar', href: '#personalizar' },
    { name: 'Skills', href: '#skills' },
    { name: 'Descargas', href: '#descargas' },
    { name: 'Setup', href: '#quick-start' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[var(--bg-base)]/85 backdrop-blur-md border-b border-[var(--border-normal)] py-3 shadow-lg shadow-black/20'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <a href="#" className="flex items-center gap-3 group select-none">
            <img
              src={logoSrc}
              alt="Sparta Agent Logo"
              className="h-8 w-auto object-contain transition-transform group-hover:scale-105 animate-pulse-slow"
              onError={(e) => {
                // Fallback to title text if image asset isn't ready
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="font-display font-bold text-lg tracking-tight text-[var(--text-display)]">
              Sparta Agent
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-0.5 bg-[var(--bg-surface)]/60 p-1.5 rounded-full border border-[var(--border-subtle)] backdrop-blur-sm">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-display)] rounded-full hover:bg-[var(--bg-hover)] transition-colors"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="hidden sm:flex items-center gap-3">
            <ThemeToggle />
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* Outlined Pill button for secondary Github link */}
              <Button variant="outline" size="sm" className="gap-2 text-xs font-medium">
                <GithubIcon className="w-4 h-4" />
                <span>Ver en GitHub</span>
              </Button>
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="flex xl:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-display)] bg-[var(--bg-surface)] border border-[var(--border-normal)]"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="xl:hidden mt-4 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg"
              >
                {link.name}
              </a>
            ))}
            <div className="pt-2 border-t border-[var(--border-normal)] flex flex-col gap-2">
              <a
                href="https://github.com/Naiker12/Sparta-Agent"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full gap-2 text-xs">
                  <GithubIcon className="w-4 h-4 text-white" />
                  <span>Ver en GitHub</span>
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
