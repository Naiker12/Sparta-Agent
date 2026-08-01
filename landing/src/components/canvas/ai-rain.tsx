import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

export function AIRain() {
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
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

      // Clear canvas with theme-specific background color to make trails match the active theme
      const isLight = resolvedTheme === 'light';
      ctx.fillStyle = isLight ? 'rgba(248, 250, 252, 0.12)' : 'rgba(7, 5, 13, 0.12)';
      ctx.fillRect(0, 0, width, height);

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
              // Light theme colors: rich deep indigo/purple shades
              if (index === 0) {
                color = `rgba(88, 28, 235, ${Math.min(drop.opacity * 2.2, 0.95)})`; // Head: rich deep violet
              } else if (index < 3) {
                color = `rgba(67, 56, 202, ${Math.min(drop.opacity * 1.8, 0.8)})`; // Upper body: indigo
              } else {
                color = `rgba(88, 28, 235, ${drop.opacity * (1 - index / drop.chars.length) * 0.65})`; // Fading tail
              }
            } else {
              // Dark theme colors: neon colors
              if (index === 0) {
                color = `rgba(182, 217, 252, ${drop.opacity * 1.5})`; // Head: bright skywash blue
              } else if (index < 3) {
                color = `rgba(168, 85, 247, ${drop.opacity * 1.1})`; // Upper body: bright purple
              } else {
                color = `rgba(102, 58, 243, ${drop.opacity * (1 - index / drop.chars.length) * 0.6})`; // Fading tail
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
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-500 ${
        resolvedTheme === 'light' ? 'opacity-35' : 'opacity-45'
      }`}
      style={{ filter: 'blur(0.2px)' }}
    />
  );
}
