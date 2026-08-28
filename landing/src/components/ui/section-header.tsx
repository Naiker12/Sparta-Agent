import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, className }: SectionHeaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const reveal = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 } };

  return (
    <header className={cn('mx-auto mb-12 flex max-w-3xl flex-col items-center gap-3 px-4 text-center md:mb-16', className)}>
      {eyebrow && (
        <span className="text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-[#9c9c9d]">
          {eyebrow}
        </span>
      )}
      
      <motion.h2
        {...reveal}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="text-3xl font-medium tracking-tight text-white sm:text-4xl md:text-5xl"
      >
        {title}
      </motion.h2>

      {description && (
        <motion.p
          {...reveal}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: shouldReduceMotion ? 0 : 0.12 }}
          className="max-w-2xl text-base leading-relaxed text-[#9c9c9d]"
        >
          {description}
        </motion.p>
      )}
    </header>
  );
}
