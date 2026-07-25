import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, className }: SectionHeaderProps) {
  return (
    <div className={cn('text-center max-w-3xl mx-auto space-y-4 mb-16 px-4', className)}>
      {/* Centered Eyebrow flanked by fading horizontal lines */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center gap-4 text-[var(--text-secondary)] font-mono text-[13px] sm:text-[14px] tracking-[0.10em] uppercase select-none"
      >
        <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.15)] to-transparent" />
        <span>{eyebrow}</span>
        <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent via-[rgba(186,215,247,0.15)] to-transparent" />
      </motion.div>

      {/* Large Title in Space Grotesk with Dynamic Gradient */}
      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-3xl sm:text-4xl md:text-5xl font-bold font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[var(--text-display)] to-[var(--text-secondary)]"
      >
        {title}
      </motion.h2>

      {/* Description in theme variables */}
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm sm:text-base md:text-lg text-[var(--text-secondary)] font-normal leading-relaxed max-w-2xl mx-auto"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
