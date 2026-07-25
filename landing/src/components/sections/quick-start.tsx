import { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Terminal, Copy, Check, ArrowRight } from 'lucide-react';
import { GithubIcon } from '../icons/github-icon';

export function QuickStart() {
  const [copied, setCopied] = useState(false);

  const commandText = `# 1. Clonar e instalar dependencias y el entorno Python sidecar
git clone https://github.com/Naiker12/Sparta-Agent.git
cd Sparta-Agent
pnpm install && pnpm sidecar:setup

# 2. Compilar el broker de seguridad nativo en Rust
pnpm rust:napi

# 3. Iniciar el IDE en modo desarrollo
pnpm dev`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(commandText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="quick-start" className="py-24 md:py-32 relative bg-[#05060f] border-t border-[rgba(186,215,247,0.12)]">
      {/* Background Spotlight */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#663af3]/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* Section Header with AuthKit Flanked Eyebrow Divider */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-center gap-4 text-[#c7d3ea] font-mono text-[13px] tracking-[0.10em] uppercase">
            <div className="h-[1px] w-16 sm:w-24 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.2)] to-transparent" />
            <span>QUICK START // DESARROLLADORES</span>
            <div className="h-[1px] w-16 sm:w-24 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.2)] to-transparent" />
          </div>
          
          <h2 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#d8ecf8] to-[#98c0ef]">
            Mira al agente planificar y ejecutar su primera tarea en tu propia máquina.
          </h2>
          <p className="text-base sm:text-lg text-[#c7d3ea]">
            Sparta Agent es de código abierto. Sin suscripciones forzadas, sin filtración de datos y con control total sobre tus modelos de lenguaje.
          </p>
        </div>

        {/* Terminal Box Container (AuthKit Glass Modal Card Style) */}
        <Card className="max-w-4xl mx-auto border border-[rgba(186,215,247,0.12)] bg-[rgba(5,6,15,0.97)] p-6 md:p-8 shadow-2xl relative">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[rgba(186,215,247,0.1)]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#b6d9fc]" />
              <span className="text-xs font-mono text-[#c7d3ea] font-medium">bash — local setup guide</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="gap-2 text-xs font-mono font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#34d399]" /> : <Copy className="w-3.5 h-3.5 text-[#d1e4fa]" />}
              <span>{copied ? 'Copiado!' : 'Copiar comandos'}</span>
            </Button>
          </div>

          <pre className="font-mono text-xs md:text-sm text-[#b6d9fc] overflow-x-auto p-5 rounded-[12px] bg-[#05060f] leading-relaxed border border-[rgba(186,215,247,0.1)] shadow-inner">
            <code>{commandText}</code>
          </pre>

          <div className="mt-6 pt-4 border-t border-[rgba(186,215,247,0.1)] flex flex-wrap items-center justify-between text-xs text-[#9da7ba] font-mono gap-3">
            <span>Requisitos: Node.js 18+ · pnpm 10+ · Python 3.11+ · Rust toolchain</span>
            <a
              href="https://github.com/Naiker12/Sparta-Agent#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#b6d9fc] hover:text-white font-medium underline-offset-4 hover:underline flex items-center gap-1"
            >
              Ver guía de instalación <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/Naiker12/Sparta-Agent"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button size="lg" className="w-full sm:w-auto gap-3 px-8 font-medium bg-[#663af3] hover:bg-[#5b31e0] text-white rounded-full shadow-lg shadow-[#663af3]/30">
                <GithubIcon className="w-5 h-5" />
                <span>Ver y Clonar en GitHub</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </Card>
      </div>
    </section>
  );
}
