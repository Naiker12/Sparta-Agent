import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  baseAlpha: number;
}

export function InteractiveSpiderWeb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates (default off-screen)
    const mouse = {
      x: -1000,
      y: -1000,
      radius: 180, // Interaction radius with cursor across the entire page
    };

    // Calculate number of particles based on viewport size
    const particleDensity = Math.min(Math.floor((width * height) / 12000), 110);
    const connectionDistance = 130;
    const connectionDistSq = connectionDistance * connectionDistance;
    const mouseDistSq = mouse.radius * mouse.radius;

    const colors = [
      'rgba(255, 255, 255, ',     // Soft White
      'rgba(99, 161, 255, ',      // Electric Sky
      'rgba(255, 99, 99, ',       // Coral Pulse
      'rgba(89, 212, 153, ',      // Success Green
    ];

    const particles: Particle[] = [];

    for (let i = 0; i < particleDensity; i++) {
      const colorScheme =
        Math.random() > 0.85
          ? colors[2] // Coral accent node
          : Math.random() > 0.65
          ? colors[1] // Electric Sky node
          : colors[0]; // Pure white node

      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.65,
        vy: (Math.random() - 0.5) * 0.65,
        radius: Math.random() * 1.5 + 1.2,
        color: colorScheme,
        baseAlpha: Math.random() * 0.35 + 0.3,
      });
    }

    // Handle global mouse move
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Handle window resize with viewport scaling
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off screen boundaries
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Draw node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.baseAlpha})`;
        ctx.fill();

        // 2. Cursor connection (interactive spider-web strands everywhere)
        const dxMouse = mouse.x - p.x;
        const dyMouse = mouse.y - p.y;
        const distMouseSq = dxMouse * dxMouse + dyMouse * dyMouse;

        if (distMouseSq < mouseDistSq) {
          const mouseDist = Math.sqrt(distMouseSq);
          const alpha = (1 - mouseDist / mouse.radius) * 0.5;

          // Draw strand to mouse
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();

          // Subtle magnetic attraction towards cursor
          const force = (1 - mouseDist / mouse.radius) * 0.012;
          p.x += dxMouse * force;
          p.y += dyMouse * force;
        }

        // 3. Connect neighboring particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < connectionDistSq) {
            const dist = Math.sqrt(distSq);
            const lineAlpha = (1 - dist / connectionDistance) * 0.18;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 size-full opacity-55 transition-opacity duration-1000"
      style={{ filter: 'drop-shadow(0 0 6px rgba(99, 161, 255, 0.1))' }}
    />
  );
}
