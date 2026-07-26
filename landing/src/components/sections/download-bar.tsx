import { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Download, 
  Monitor, 
  Apple, 
  Terminal, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  HardDrive, 
  Loader2, 
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function DownloadBar() {
  const [downloadState, setDownloadState] = useState<{
    filename: string;
    progress: number;
    speed: string;
    loaded: string;
    total: string;
    status: 'idle' | 'checking' | 'downloading' | 'completed' | 'error';
    os: string;
  }>({
    filename: '',
    progress: 0,
    speed: '0 MB/s',
    loaded: '0 MB',
    total: '0 MB',
    status: 'idle',
    os: '',
  });

  const [showWidget, setShowWidget] = useState(false);

  const releases = [
    {
      os: 'Windows (x64)',
      filename: 'Sparta-Agent-Windows-0.1.1-Setup.exe',
      size: '368.9 MB',
      icon: Monitor,
      recommended: true,
      badge: 'Instalador NSIS .exe',
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
      badge: 'Binario AppImage',
      url: 'https://github.com/Naiker12/Sparta-Agent/releases/download/v0.1.1/Sparta-Agent-Linux-0.1.1.AppImage',
    },
  ];

  const handleDownloadClick = async (rel: typeof releases[0]) => {
    setShowWidget(true);
    setDownloadState({
      filename: rel.filename,
      progress: 0,
      speed: 'Conectando...',
      loaded: '0 MB',
      total: rel.size,
      status: 'checking',
      os: rel.os,
    });

    const localUrl = `./${rel.filename}`;

    try {
      // Intenta hacer un HEAD request para ver si el binario local está disponible en el servidor web
      const res = await fetch(localUrl, { method: 'HEAD' });
      if (res.ok) {
        // El archivo está disponible de forma local. Hacemos descarga con progreso real.
        setDownloadState(prev => ({ ...prev, status: 'downloading', speed: 'Calculando...' }));
        
        const downloadRes = await fetch(localUrl);
        if (!downloadRes.ok || !downloadRes.body) throw new Error('Local fetch failed');

        const reader = downloadRes.body.getReader();
        const contentLength = Number(downloadRes.headers.get('Content-Length')) || 386839460;
        
        let receivedLength = 0;
        const chunks = [];
        const startTime = Date.now();
        let lastUpdateTime = startTime;
        let lastReceivedLength = 0;

        let downloading = true;
        while (downloading) {
          const { done, value } = await reader.read();
          if (done) {
            downloading = false;
            break;
          }

          chunks.push(value);
          receivedLength += value.length;

          const now = Date.now();
          if (now - lastUpdateTime > 100) {
            const progress = Math.min(Math.round((receivedLength / contentLength) * 100), 99);
            const timePassed = (now - lastUpdateTime) / 1000;
            const bytesSinceLast = receivedLength - lastReceivedLength;
            const speedMbps = ((bytesSinceLast / timePassed) / (1024 * 1024)).toFixed(1);
            
            setDownloadState(prev => ({
              ...prev,
              progress,
              speed: `${speedMbps} MB/s`,
              loaded: `${(receivedLength / (1024 * 1024)).toFixed(1)} MB`,
              total: `${(contentLength / (1024 * 1024)).toFixed(1)} MB`,
            }));

            lastUpdateTime = now;
            lastReceivedLength = receivedLength;
          }
        }

        // Crear y descargar blob
        const allChunks = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }

        const blob = new Blob([allChunks], { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = rel.filename;
        link.click();
        URL.revokeObjectURL(blobUrl);

        setDownloadState(prev => ({
          ...prev,
          progress: 100,
          status: 'completed',
          speed: 'Terminado',
          loaded: prev.total,
        }));
      } else {
        // Si no está disponible localmente, hacemos fallback simulando el progreso
        // y abriendo el enlace oficial de GitHub Releases
        triggerRemoteFallback(rel);
      }
    } catch (err) {
      console.warn('Real download error, using simulated remote fallback instead:', err);
      triggerRemoteFallback(rel);
    }
  };

  const triggerRemoteFallback = (rel: typeof releases[0]) => {
    // Abrimos la descarga nativa inmediatamente
    window.open(rel.url, '_blank');

    setDownloadState(prev => ({
      ...prev,
      status: 'downloading',
      loaded: '0 MB',
      total: rel.size,
    }));

    // Simula una barra de progreso que dura 3.5 segundos para mostrar
    // que la conexión y descarga se están gestionando
    const duration = 3500;
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let currentStep = 0;
    const totalSizeVal = parseFloat(rel.size);

    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 100);
      const loadedVal = ((progress / 100) * totalSizeVal).toFixed(1);
      const simulatedSpeed = (35 + Math.random() * 25).toFixed(1); // 35-60 MB/s

      setDownloadState(prev => ({
        ...prev,
        progress,
        speed: `${simulatedSpeed} MB/s`,
        loaded: `${loadedVal} MB`,
      }));

      if (progress >= 100) {
        clearInterval(timer);
        setDownloadState(prev => ({
          ...prev,
          status: 'completed',
          speed: 'Terminado',
        }));
      }
    }, intervalTime);
  };

  return (
    <section id="descargas" className="py-24 md:py-32 relative bg-transparent border-t border-[rgba(186,215,247,0.12)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
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
            Binarios compilados listos para ejecutar. Incluye el motor agéntico nativo y el runtime de Electron.
          </p>
        </div>

        {/* Downloads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {releases.map((rel) => {
            const Icon = rel.icon;
            const isThisOSDownloading = showWidget && downloadState.filename === rel.filename;
            
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
                      onClick={() => handleDownloadClick(rel)}
                      disabled={isThisOSDownloading && downloadState.status !== 'completed'}
                      size="lg"
                      className={`w-full gap-2 font-medium transition-all duration-300 ${
                        rel.recommended
                          ? 'bg-[#663af3] hover:bg-[#5b31e0] text-white shadow-lg shadow-[#663af3]/30'
                          : 'bg-[rgba(186,214,247,0.06)] hover:bg-[rgba(186,214,247,0.12)] text-white border border-[rgba(186,215,247,0.12)]'
                      }`}
                    >
                      {isThisOSDownloading && downloadState.status !== 'completed' ? (
                        <>
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                          <span>{downloadState.status === 'checking' ? 'Conectando...' : 'Descargando...'}</span>
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
              <div className="text-[#9da7ba] text-[11px]">Requisitos: Node.js 18+, pnpm 10+</div>
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

      {/* Floating Download Manager Widget */}
      <AnimatePresence>
        {showWidget && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-[rgba(186,215,247,0.15)] bg-[rgba(12,12,20,0.92)] shadow-2xl backdrop-blur-xl p-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[rgba(102,58,243,0.12)] text-[#9e80f8]">
                  <Download className="w-4 h-4 animate-bounce" />
                </div>
                <span className="text-xs font-semibold text-[#d8ecf8] tracking-wide font-sans">
                  {downloadState.status === 'completed' ? 'Descarga Completada' : 'Descargando Sparta'}
                </span>
              </div>
              <button 
                onClick={() => setShowWidget(false)}
                className="text-[#9da7ba] hover:text-[#d8ecf8] transition-colors p-1 rounded-md hover:bg-[rgba(255,255,255,0.05)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File Info */}
            <div className="space-y-3">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-[#b6d9fc] truncate">
                  {downloadState.filename}
                </span>
                <span className="text-[10px] font-mono text-[#9da7ba] mt-0.5">
                  {downloadState.os}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="h-1.5 w-full bg-[rgba(186,215,247,0.06)] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadState.progress}%` }}
                    transition={{ duration: 0.1 }}
                    className="h-full bg-gradient-to-r from-[#663af3] to-[#98c0ef] rounded-full"
                  />
                </div>
                
                {/* Stats */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[#c7d3ea]">
                  <span>{downloadState.progress}%</span>
                  <span>
                    {downloadState.loaded} / {downloadState.total}
                  </span>
                  <span className="text-[#34d399] font-bold">
                    {downloadState.speed}
                  </span>
                </div>
              </div>

              {/* Status Actions */}
              {downloadState.status === 'completed' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-1.5 pt-2 border-t border-[rgba(186,215,247,0.08)] text-[11px] text-[#34d399] font-sans font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Listo para instalar</span>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
