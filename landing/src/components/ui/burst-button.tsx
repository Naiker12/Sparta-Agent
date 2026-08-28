import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  angle: number;
  distance: number;
  delay: number;
}

const LUXURY_SPARK_COLORS = [
  '#ffffff', // Pure Diamond Spark
  '#ff6363', // Coral Pulse Neon
  '#63a1ff', // Electric Sky
  '#fbbf24', // Warm Gold Stardust
  '#e6e6e6', // Titanium Mist
];

export function BurstParticles({ active }: { active: boolean }) {
  if (!active) return null;

  // 18 cinematic micro-particles in layered concentric radii
  const particles: Particle[] = Array.from({ length: 18 }).map((_, i) => {
    const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const distance = 24 + Math.random() * 32;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size: Math.random() * 2.2 + 1.2,
      color: LUXURY_SPARK_COLORS[i % LUXURY_SPARK_COLORS.length],
      angle,
      distance,
      delay: Math.random() * 0.04,
    };
  });

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-20">
      {/* 1. Perimeter Neon Shockwave Flare */}
      <motion.div
        initial={{ opacity: 0.8, scale: 0.9 }}
        animate={{ opacity: 0, scale: 1.25 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -inset-1 rounded-xl border border-[#ff6363]/60 bg-radial from-[#ff6363]/15 to-transparent blur-[3px]"
      />

      {/* 2. Micro-Diamond Stardust Sparks */}
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: [0, 1.3, 0],
            opacity: [1, 0.95, 0],
          }}
          transition={{
            duration: 0.48,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 6px ${p.color}, 0 0 12px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}

interface BurstButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  showShimmer?: boolean;
}

export function BurstButton({
  children,
  className = '',
  showShimmer = true,
  ...props
}: BurstButtonProps) {
  const [burstKey, setBurstKey] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const triggerBurst = () => {
    setBurstKey(Date.now());
  };

  return (
    <div
      className="relative inline-flex overflow-visible group"
      onMouseEnter={() => {
        setIsHovered(true);
        triggerBurst();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {burstKey && <BurstParticles key={burstKey} active={true} />}
      </AnimatePresence>

      <button
        onClick={(e) => {
          triggerBurst();
          props.onClick?.(e);
        }}
        className={`relative overflow-hidden ${className}`}
        {...props}
      >
        {/* Shimmer light sweep across button surface */}
        {showShimmer && isHovered && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 0.65, ease: 'easeInOut' }}
            className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 z-10"
          />
        )}
        <span className="relative z-10 flex items-center justify-center gap-1.5 w-full">
          {children}
        </span>
      </button>
    </div>
  );
}

interface BurstLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
  className?: string;
  showShimmer?: boolean;
}

export function BurstLink({
  children,
  className = '',
  showShimmer = true,
  ...props
}: BurstLinkProps) {
  const [burstKey, setBurstKey] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const triggerBurst = () => {
    setBurstKey(Date.now());
  };

  return (
    <div
      className="relative inline-flex overflow-visible group"
      onMouseEnter={() => {
        setIsHovered(true);
        triggerBurst();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {burstKey && <BurstParticles key={burstKey} active={true} />}
      </AnimatePresence>

      <a
        onClick={(e) => {
          triggerBurst();
          props.onClick?.(e);
        }}
        className={`relative overflow-hidden ${className}`}
        {...props}
      >
        {/* Shimmer light sweep across link surface */}
        {showShimmer && isHovered && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 0.65, ease: 'easeInOut' }}
            className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12 z-10"
          />
        )}
        <span className="relative z-10 flex items-center justify-center gap-1.5 w-full">
          {children}
        </span>
      </a>
    </div>
  );
}
