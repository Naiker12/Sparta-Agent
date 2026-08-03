import { useState, useEffect } from 'react';
import { SectionHeader } from '../ui/section-header';
import {
  Download,
  Monitor,
  Apple,
  Terminal,
  CheckCircle2,
  ArrowRight,
  HardDrive,
  Loader2,
  X,
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
  const [dynamicInfo, setDynamicInfo] = useState<Record<string, { size?: string; filename?: string; url?: string }>>({});

  useEffect(() => {
    fetch('https://api.github.com/repos/Naiker12/Sparta-Agent/releases/latest')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.assets)) {
          const info: Record<string, { size?: string; filename?: string; url?: string }> = {};
          for (const asset of data.assets) {
            if (typeof asset.size === 'number' && asset.name) {
              const formattedSize = `${(asset.size / (1024 * 1024)).toFixed(1)} MB`;
              const downloadUrl = asset.browser_download_url || `https://github.com/Naiker12/Sparta-Agent/releases/latest/download/${asset.name}`;

              if (asset.name.endsWith('.exe') && asset.name.includes('Setup')) {
                info['Windows (x64)'] = { size: formattedSize, filename: asset.name, url: downloadUrl };
              } else if (asset.name.endsWith('.dmg')) {
                info['macOS (Apple Silicon & Intel)'] = { size: formattedSize, filename: asset.name, url: downloadUrl };
              } else if (asset.name.endsWith('.AppImage')) {
                info['Linux (AppImage & deb)'] = { size: formattedSize, filename: asset.name, url: downloadUrl };
              }
            }
          }
          if (Object.keys(info).length > 0) {
            setDynamicInfo(info);
          }
        }
      })
      .catch(() => {});
  }, []);

  const releases = [
    {
      os: 'Windows (x64)',
      filename: 'Sparta-Agent-Windows-0.1.2-Setup.exe',
      size: '368.9 MB',
      icon: Monitor,
      recommended: true,
      badge: 'Instalador NSIS .exe',
      url: 'https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Windows-0.1.2-Setup.exe',
      fallbackUrl: 'https://github.com/Naiker12/Sparta-Agent/releases/latest',
    },
    {
      os: 'macOS (Apple Silicon & Intel)',
      filename: 'Sparta-Agent-Mac-0.1.2-Installer.dmg',
      size: '88.6 MB',
      icon: Apple,
      recommended: false,
      badge: 'Universal .dmg',
      url: 'https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Mac-0.1.2-Installer.dmg',
      fallbackUrl: 'https://github.com/Naiker12/Sparta-Agent/releases/latest',
    },
    {
      os: 'Linux (AppImage & deb)',
      filename: 'Sparta-Agent-Linux-0.1.2.AppImage',
      size: '91.4 MB',
      icon: Terminal,
      recommended: false,
      badge: 'Binario AppImage',
      url: 'https://github.com/Naiker12/Sparta-Agent/releases/latest/download/Sparta-Agent-Linux-0.1.2.AppImage',
      fallbackUrl: 'https://github.com/Naiker12/Sparta-Agent/releases/latest',
    },
  ];

  const handleDownloadClick = async (rel: typeof releases[0]) => {
    const currentInfo = dynamicInfo[rel.os];
    const actualFilename = currentInfo?.filename || rel.filename;
    const actualSize = currentInfo?.size || rel.size;
    const targetUrl = currentInfo?.url || rel.url;

    setShowWidget(true);
    setDownloadState({
      filename: actualFilename,
      progress: 0,
      speed: 'Conectando...',
      loaded: '0 MB',
      total: actualSize,
      status: 'checking',
      os: rel.os,
    });

    window.open(targetUrl, '_blank');

    setDownloadState((prev) => ({
      ...prev,
      status: 'downloading',
      loaded: '0 MB',
      total: actualSize,
    }));

    const duration = 2500;
    const intervalTime = 40;
    const steps = duration / intervalTime;
    let currentStep = 0;
    const totalSizeVal = parseFloat(actualSize);

    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round((currentStep / steps) * 100), 100);
      const loadedVal = ((progress / 100) * totalSizeVal).toFixed(1);
      const simulatedSpeed = (35 + Math.random() * 25).toFixed(1);

      setDownloadState((prev) => ({
        ...prev,
        progress,
        speed: `${simulatedSpeed} MB/s`,
        loaded: `${loadedVal} MB`,
      }));

      if (progress >= 100) {
        clearInterval(timer);
        setDownloadState((prev) => ({
          ...prev,
          status: 'completed',
          speed: 'Terminado',
        }));
      }
    }, intervalTime);
  };

  return (
    <section id="descargas" className="py-12 relative overflow-hidden max-w-full bg-slate-50/85 dark:bg-[#07050d]/85 backdrop-blur-md text-slate-900 dark:text-white border-y border-slate-200 dark:border-white/10 font-sans transition-colors duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] max-w-[100vw] h-[300px] bg-[#663af3]/10 blur-[140px] pointer-events-none" />

      {/* UNIFIED CONTINUOUS GRID CONTAINER MAX-W-7XL BORDER-X */}
      <div className="mx-auto max-w-7xl border-x border-slate-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <SectionHeader
          eyebrow="DESCARGAS & INSTALADORES OFICIALES"
          title="Descarga Sparta Agent para tu Sistema Operativo"
          description="Binarios compilados listos para ejecutar en Windows, macOS y Linux. Incluye el motor agéntico nativo y el runtime de Electron."
        />

        {/* 3 HIGH-DENSITY COMPACT DOWNLOAD CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-5xl mx-auto">
          {releases.map((rel) => {
            const Icon = rel.icon;
            const currentInfo = dynamicInfo[rel.os];
            const displayFilename = currentInfo?.filename || rel.filename;
            const displaySize = currentInfo?.size || rel.size;
            const isThisOSDownloading = showWidget && downloadState.filename === displayFilename;

            return (
              <motion.div
                key={rel.os}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className={`p-5 rounded-xl border flex flex-col justify-between h-full relative overflow-hidden backdrop-blur-xl transition-all duration-300 ${
                  rel.recommended
                    ? 'bg-[#663af3]/15 border-[#663af3] shadow-lg shadow-[#663af3]/20'
                    : 'bg-white dark:bg-[#0e0b16]/80 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      rel.recommended ? 'bg-[#663af3] text-white' : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {rel.recommended ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#663af3] text-white shadow-md shadow-[#663af3]/40">
                        🔥 Recomendado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400">
                        {rel.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">{rel.os}</h3>
                  <p className="text-[11px] font-mono text-purple-700 dark:text-purple-300 truncate mb-3">{displayFilename}</p>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600 dark:text-gray-400 mb-4">
                    <HardDrive className="w-3 h-3 text-[#a855f7]" />
                    <span>Tamaño: <strong className="text-slate-900 dark:text-white">{displaySize}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => handleDownloadClick(rel)}
                  className={`w-full py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                    rel.recommended
                      ? 'bg-[#663af3] hover:bg-[#7c4dff] text-white shadow-[#663af3]/40 border border-[#663af3]'
                      : 'bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-slate-300 dark:border-white/10'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isThisOSDownloading ? 'Descargando...' : 'Descargar Binario'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* GitHub Releases Direct Link Sub-Bar */}
        <div className="mt-6 text-center">
          <a
            href="https://github.com/Naiker12/Sparta-Agent/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all shadow-sm"
          >
            <span>Ver Release Oficial y notas de la versión en GitHub Releases</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* DOWNLOAD PROGRESS FLOATING MODAL WIDGET */}
        <AnimatePresence>
          {showWidget && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="mt-6 max-w-lg mx-auto bg-white dark:bg-[#080512] border border-[#663af3]/50 rounded-xl p-4 shadow-lg dark:shadow-2xl backdrop-blur-2xl relative"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-white/10 font-mono text-xs">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold truncate">
                  {downloadState.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-[#a855f7] animate-spin shrink-0" />
                  )}
                  <span className="truncate">{downloadState.filename}</span>
                </div>
                <button
                  onClick={() => setShowWidget(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress Line */}
              <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#f66e60] via-[#663af3] to-emerald-400 rounded-full"
                  style={{ width: `${downloadState.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 dark:text-gray-300">
                <span>Progreso: <strong className="text-slate-900 dark:text-white">{downloadState.progress}%</strong></span>
                <span>Velocidad: <strong className="text-emerald-600 dark:text-emerald-400">{downloadState.speed}</strong></span>
                <span>Cargado: <strong className="text-slate-900 dark:text-white">{downloadState.loaded} / {downloadState.total}</strong></span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
