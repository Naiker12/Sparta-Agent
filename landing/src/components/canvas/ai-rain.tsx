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

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const render = () => {
      // Clear canvas with theme-specific background color to make trails match the active theme
      const isLight = resolvedTheme === 'light';
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(5, 6, 15, 0.08)';
      ctx.fillRect(0, 0, width, height);

      // Set font settings
      ctx.font = '9px monospace';
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
              // Light theme colors: slightly darker, legible blue/purple shades
              if (index === 0) {
                color = `rgba(2, 125, 234, ${drop.opacity * 1.2})`; // Head: deep blue
              } else if (index < 3) {
                color = `rgba(102, 58, 243, ${drop.opacity * 0.85})`; // Upper body: void violet
              } else {
                color = `rgba(102, 58, 243, ${drop.opacity * (1 - index / drop.chars.length) * 0.35})`; // Fading tail
              }
            } else {
              // Dark theme colors: neon colors
              if (index === 0) {
                color = `rgba(182, 217, 252, ${drop.opacity * 1.3})`; // Head: bright skywash blue
              } else if (index < 3) {
                color = `rgba(102, 90, 243, ${drop.opacity * 0.85})`; // Upper body: bright purple
              } else {
                color = `rgba(102, 58, 243, ${drop.opacity * (1 - index / drop.chars.length) * 0.4})`; // Fading tail
              }
            }

            ctx.fillStyle = color;
            ctx.fillText(char, drop.x, charY);

            // Add a subtle glowing effect to the head character (only in dark mode for screen contrast)
            if (!isLight && index === 0 && Math.random() > 0.8) {
              ctx.shadowColor = '#b6d9fc';
              ctx.shadowBlur = 6;
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.fillText(char, drop.x, charY);
              ctx.shadowBlur = 0; // reset
            }
          }
        });

        // Move the drop down
        drop.y += drop.speed;

        // Reset drop to the top when the tail fully passes the screen height
        if (drop.y - drop.chars.length * fontSize > height) {
          const word = aiTokens[Math.floor(Math.random() * aiTokens.length)];
          drop.y = Math.random() * -200 - 50;
          drop.text = word;
          drop.chars = word.split('');
          drop.speed = 0.8 + Math.random() * 1.5;
          drop.opacity = isLight ? 0.12 + Math.random() * 0.2 : 0.15 + Math.random() * 0.35;
          drop.delay = Math.random() * 100;
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 mix-blend-normal transition-opacity duration-500 ${
        resolvedTheme === 'light' ? 'opacity-25' : 'opacity-40'
      }`}
      style={{ filter: 'blur(0.3px)' }}
    />
  );
}
