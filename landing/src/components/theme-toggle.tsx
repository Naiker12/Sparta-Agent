import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-[72px] h-8" />;
  }

  const isDark = theme === 'dark';

  return (
    <div
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-8 w-[72px] rounded-full p-[2px] bg-[rgba(186,214,247,0.06)] border border-[rgba(186,215,247,0.12)] flex items-center relative select-none cursor-pointer group"
      role="button"
      aria-label="Cambiar tema claro/oscuro"
    >
      {/* Animated active sliding background indicator */}
      <motion.div
        className="absolute top-[2px] bottom-[2px] w-[32px] rounded-full bg-[rgba(186,214,247,0.12)] border border-[rgba(186,215,247,0.12)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
        animate={{
          x: isDark ? 0 : 34,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />

      {/* Moon Icon (Dark Mode Option) */}
      <div className="w-[32px] h-[26px] flex items-center justify-center z-10 transition-colors duration-200">
        <Moon
          className={`w-3.5 h-3.5 transition-all ${
            isDark ? 'text-white' : 'text-[#9da7ba] group-hover:text-white'
          }`}
        />
      </div>

      {/* Sun Icon (Light Mode Option) */}
      <div className="w-[32px] h-[26px] flex items-center justify-center z-10 transition-colors duration-200 ml-auto">
        <Sun
          className={`w-3.5 h-3.5 transition-all ${
            !isDark ? 'text-amber-400' : 'text-[#9da7ba] group-hover:text-white'
          }`}
        />
      </div>
    </div>
  );
}
