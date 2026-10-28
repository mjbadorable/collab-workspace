"use client";

import { useEffect, useRef } from "react";

const EVENT = "collab-workspace:confetti";
const DURATION_MS = 2500;
const FADE_FROM = 0.65; // share of the animation after which the particles fade out
const COUNT = 160;
const COLORS = ["#dc2626", "#ffffff", "#facc15", "#374151"];

// Sprays Pokéball-coloured confetti across the screen. Needs <ConfettiCanvas /> to be mounted (the app shell does).
export function fireConfetti(): void {
  window.dispatchEvent(new Event(EVENT));
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  ball: boolean; // drawn as a tiny Pokéball instead of a flake
};

function spawn(width: number, height: number): Particle[] {
  return Array.from({ length: COUNT }, (_, i) => {
    // Two cannons, one on each bottom corner, fire up and toward the middle.
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -65 : -115) * (Math.PI / 180) + (Math.random() - 0.5) * 0.7;
    const speed = 9 + Math.random() * 9;
    return {
      x: fromLeft ? width * 0.05 : width * 0.95,
      y: height * 0.95,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 7,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      ball: Math.random() < 0.3,
    };
  });
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  if (p.ball) {
    const r = p.size * 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#171717";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
  } else {
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    if (p.color === "#ffffff") {
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = "#9ca3af";
      ctx.strokeRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
  }
  ctx.restore();
}

// A full-screen canvas that ignores the mouse and is empty except for the 2.5 seconds after fireConfetti().
export function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;

    const stop = () => {
      cancelAnimationFrame(frame);
      canvas.width = 0; // clears it and releases the memory
      canvas.height = 0;
    };

    const run = () => {
      // Anyone who asked their system for less motion gets none.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      cancelAnimationFrame(frame);

      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const particles = spawn(width, height);
      const start = performance.now();

      const tick = (now: number) => {
        const t = (now - start) / DURATION_MS;
        if (t >= 1) return stop();
        ctx.clearRect(0, 0, width, height);
        ctx.globalAlpha = t < FADE_FROM ? 1 : Math.max(0, 1 - (t - FADE_FROM) / (1 - FADE_FROM));
        for (const p of particles) {
          p.vy += 0.35; // gravity
          p.vx *= 0.99;
          p.x += p.vx;
          p.y += p.vy;
          p.rotation += p.spin;
          drawParticle(ctx, p);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener(EVENT, run);
    return () => {
      window.removeEventListener(EVENT, run);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="no-print pointer-events-none fixed inset-0 z-[60] h-screen w-screen" />;
}
