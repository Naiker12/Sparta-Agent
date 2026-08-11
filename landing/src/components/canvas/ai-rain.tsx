import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useTheme } from 'next-themes';

export function AIRain() {
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // AI Words and characters to drop
    const aiTokens = [
      'AGENT', 'LLM', 'PROMPT', 'TOKEN', 'RUST', 'SANDBOX', 'OLLAMA', 
      'GRAPH', 'NODE', 'FLOW', 'LINTER', 'COMPILE', 'IPC', 'ELECTRON', 
      'REACT', 'STATE', 'PLAN', 'SECURITY', 'PATHGUARD', 'CHROMADB',
      'λ', 'θ', 'Σ', 'f(x)', '∇', '1', '0', 'AI', 'INPUT'
    ];

    const fontSize = 11;
    const columnsCount = Math.floor(width / 28); // Spacing between columns

    interface Drop {
      x: number;
      y: number;
      speed: number;
      text: string;
      chars: string[];
      activeCharIndex: number;
      opacity: number;
      delay: number;
    }

    const drops: Drop[] = [];

    // Initialize drops
    for (let i = 0; i < columnsCount; i++) {
      const word = aiTokens[Math.floor(Math.random() * aiTokens.length)];
      drops.push({
        x: i * 28 + Math.random() * 10,
        y: Math.random() * -height - 100, // Spawn above screen
        speed: 0.8 + Math.random() * 1.5,
        text: word,
        chars: word.split(''),
        activeCharIndex: 0,
        opacity: resolvedTheme === 'light' ? 0.12 + Math.random() * 0.2 : 0.15 + Math.random() * 0.35,
        delay: Math.random() * 200,
      });
    }

    let scrollBoost = 0;
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = Math.abs(currentScrollY - lastScrollY);
      scrollBoost = Math.min(scrollBoost + delta * 0.1, 4);
      lastScrollY = currentScrollY;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });

    const render = () => {
      // Gradually decay scroll boost back to 0
      if (scrollBoost > 0) {
        scrollBoost *= 0.92;
      }

      // Fade previous frames without painting an opaque layer over the page.
      // This preserves contrast in both themes while retaining a subtle trail.
      const isLight = resolvedTheme === 'light';
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Set font settings
      ctx.font = 'bold 10px monospace';
      ctx.textBaseline = 'top';

      drops.forEach((drop) => {
        if (drop.delay > 0) {
          drop.delay--;
          return;
        }

        // Draw vertical word/letters cascade
        drop.chars.forEach((char, index) => {
          const charY = drop.y - index * fontSize;
          
          // Only draw if inside viewport
          if (charY > 0 && charY < height) {
            let color = '';
            if (isLight) {
              // Light theme: neutral graphite tones.
              if (index === 0) {
                color = `rgba(24, 24, 27, ${Math.min(drop.opacity * 2.2, 0.95)})`;
              } else if (index < 3) {
                color = `rgba(82, 82, 91, ${Math.min(drop.opacity * 1.8, 0.8)})`;
              } else {
                color = `rgba(113, 113, 122, ${drop.opacity * (1 - index / drop.chars.length) * 0.65})`;
              }
            } else {
              // Dark theme: restrained silver tones.
              if (index === 0) {
                color = `rgba(244, 244, 245, ${drop.opacity * 1.25})`;
              } else if (index < 3) {
                color = `rgba(161, 161, 170, ${drop.opacity})`;
              } else {
                color = `rgba(82, 82, 91, ${drop.opacity * (1 - index / drop.chars.length) * 0.6})`;
              }
            }

            ctx.fillStyle = color;
            ctx.fillText(char, drop.x, charY);
          }
        });

        // Move drop downwards with scroll speed boost
        drop.y += drop.speed + scrollBoost;

        // Reset drop when past bottom of screen
        if (drop.y - drop.chars.length * fontSize > height) {
          drop.y = Math.random() * -100 - 50;
          const word = aiTokens[Math.floor(Math.random() * aiTokens.length)];
          drop.text = word;
          drop.chars = word.split('');
          drop.speed = 0.8 + Math.random() * 1.5;
          drop.opacity = isLight ? 0.25 + Math.random() * 0.25 : 0.2 + Math.random() * 0.35;
          drop.delay = Math.random() * 80;
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, [resolvedTheme, shouldReduceMotion]);

  if (shouldReduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-500 ${
        resolvedTheme === 'light' ? 'opacity-20' : 'opacity-30'
      }`}
      style={{ filter: 'blur(0.2px)' }}
    />
  );
}
