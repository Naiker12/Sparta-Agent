import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Download, Monitor, Apple, Terminal, CheckCircle2, ShieldCheck, ArrowRight, HardDrive } from 'lucide-react';
import { motion } from 'framer-motion';

export function DownloadBar() {
  const [downloadingOS, setDownloadingOS] = useState<string | null>(null);

  const releases = [
    {
      os: 'Windows (x64)',
      filename: 'Sparta-Agent-Windows-0.1.1-Setup.exe',
      size: '94.2 MB',
      icon: Monitor,
      recommended: true,
      badge: 'Installer NSIS .exe',
      url: 'https://github.com/Naiker12/Sparta-Agent/releases/download/v0.1.1/Sparta-Agent-Windows-0.1.1-Setup.exe',
    },
    {
      os: 'macOS (Apple Silicon & Intel)',
      filename: 'Sparta-Agent-Mac-0.1.1-Installer.dmg',
      size: '88.6 MB',
      icon: Apple,
      recommended: false,
      badge: 'Universal .dmg',
      url: 'https://github.com/Naiker12/Sparta-Agent/releases/download/v0.1.1/Sparta-Agent-Mac-0.1.1-Installer.dmg',
    },
    {
      os: 'Linux (AppImage & deb)',
      filename: 'Sparta-Agent-Linux-0.1.1.AppImage',
      size: '91.4 MB',
      icon: Terminal,
      recommended: false,
      badge: 'Binary AppImage',
      url: 'https://github.com/Naiker12/Sparta-Agent/releases/download/v0.1.1/Sparta-Agent-Linux-0.1.1.AppImage',
    },
  ];

  const handleDownload = (osName: string, url: string) => {
    setDownloadingOS(osName);
    window.open(url, '_blank');
    setTimeout(() => setDownloadingOS(null), 3000);
  };

  return (
    <section id="descargas" className="py-24 md:py-32 relative bg-[#05060f] border-t border-[rgba(186,215,247,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="flex items-center justify-center gap-4 text-[#c7d3ea] font-mono text-[13px] tracking-[0.10em] uppercase">
            <div className="h-[1px] w-16 sm:w-24 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.2)] to-transparent" />
            <span>DESCARGAS & INSTALADORES OFICIALES</span>
            <div className="h-[1px] w-16 sm:w-24 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.2)] to-transparent" />
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef]">
            Descarga Sparta Agent para tu Sistema Operativo
          </h2>
          <p className="text-base sm:text-lg text-[#c7d3ea]">
            Binarios compilados listos para ejecutar. Incluye el broker en Rust nativo y el runtime de Electron.
          </p>
        </div>

        {/* Downloads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {releases.map((rel) => {
            const Icon = rel.icon;
            const isDownloading = downloadingOS === rel.os;
            return (
              <motion.div
                key={rel.os}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={`p-7 space-y-6 relative overflow-hidden flex flex-col justify-between h-full border ${
                  rel.recommended
                    ? 'border-[#663af3] bg-[rgba(102,58,243,0.06)] shadow-xl shadow-[#663af3]/20'
                    : 'border-[rgba(186,215,247,0.12)] bg-[rgba(186,214,247,0.03)]'
                }`}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-full ${
                        rel.recommended
                          ? 'bg-[#663af3] text-white shadow-md shadow-[#663af3]/40'
                          : 'bg-[rgba(186,214,247,0.06)] text-[#d1e4fa]'
                      }`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      {rel.recommended && (
                        <Badge variant="accent">Recomendado</Badge>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xl font-bold font-display text-[#d8ecf8]">
                        {rel.os}
                      </h3>
                      <span className="text-xs font-mono text-[#9da7ba] block mt-1">
                        {rel.badge} · {rel.size}
                      </span>
                    </div>

                    <div className="p-3 rounded-[8px] bg-[#05060f] border border-[rgba(186,215,247,0.1)] font-mono text-[11px] text-[#b6d9fc] flex items-center justify-between">
                      <span className="truncate">{rel.filename}</span>
                      <HardDrive className="w-3.5 h-3.5 text-[#34d399] shrink-0 ml-2" />
                    </div>
                  </div>

                  <div className="pt-4 space-y-3">
                    <Button
                      onClick={() => handleDownload(rel.os, rel.url)}
                      size="lg"
                      className={`w-full gap-2 font-medium ${
                        rel.recommended
                          ? 'bg-[#663af3] hover:bg-[#5b31e0] text-white shadow-lg shadow-[#663af3]/30'
                          : 'bg-[rgba(186,214,247,0.06)] hover:bg-[rgba(186,214,247,0.12)] text-white border border-[rgba(186,215,247,0.12)]'
                      }`}
                    >
                      {isDownloading ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#34d399] animate-bounce" />
                          <span>Iniciando descarga...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Descargar v0.1.1</span>
                        </>
                      )}
                    </Button>

                    <div className="text-[11px] text-center font-mono text-[#9da7ba] flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>Firma SHA-256 verificada</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Source Clone Strip */}
        <div className="mt-12 max-w-5xl mx-auto p-6 rounded-[16px] bg-[rgba(5,6,15,0.97)] border border-[rgba(186,215,247,0.12)] flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-[#c7d3ea]">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-[#663af3]" />
            <div>
              <div className="text-[#d8ecf8] font-bold">¿Prefieres compilar desde el código fuente?</div>
              <div className="text-[#9da7ba] text-[11px]">Requisitos: Node.js 18+, Python 3.11+, Rust Toolchain</div>
            </div>
          </div>
          <a
            href="https://github.com/Naiker12/Sparta-Agent"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto"
          >
            <Button variant="outline" size="sm" className="w-full md:w-auto gap-2 font-mono">
              <span>git clone github.com/Naiker12/Sparta-Agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
