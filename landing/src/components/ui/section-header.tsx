import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({ title, description, className }: SectionHeaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 } };

  return (
    <header className={cn('mx-auto mb-12 flex max-w-3xl flex-col items-center gap-4 px-4 text-center md:mb-16', className)}>
      <motion.h2
        {...reveal}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="text-3xl font-bold tracking-tight text-[var(--text-display)] sm:text-4xl md:text-5xl"
      >
        {title}
      </motion.h2>

      {description && (
        <motion.p
          {...reveal}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: shouldReduceMotion ? 0 : 0.16 }}
          className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] md:text-lg"
        >
          {description}
        </motion.p>
      )}
    </header>
  );
}
