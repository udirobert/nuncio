"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Seeded PRNG (mulberry32) so the composition is deterministic across loads.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Point {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
}

export function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const mouse = { x: -1000, y: -1000 };
    let points: Point[] = [];

    const rand = mulberry32(0x6e756e63696f); // "nuncio" as a numeric seed

    function resize() {
      if (!container || !canvas || !ctx) return;
      const rect = container.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const area = width * height;
      const count = Math.max(30, Math.min(80, Math.floor(area / 22000)));
      points = Array.from({ length: count }, () => {
        const x = rand() * width;
        const y = rand() * height;
        return {
          x,
          y,
          baseX: x,
          baseY: y,
          vx: 0,
          vy: 0,
        };
      });
    }

    function colorWithAlpha(hex: string, alpha: number) {
      const clean = hex.trim().replace("#", "");
      if (clean.length === 3) {
        const r = parseInt(clean[0] + clean[0], 16);
        const g = parseInt(clean[1] + clean[1], 16);
        const b = parseInt(clean[2] + clean[2], 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      if (clean.length === 6) {
        const r = parseInt(clean.slice(0, 2), 16);
        const g = parseInt(clean.slice(2, 4), 16);
        const b = parseInt(clean.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      return `rgba(163, 163, 163, ${alpha})`;
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const lineColor = getComputedStyle(document.documentElement).getPropertyValue(
        "--color-ink-faint"
      ).trim() || "#A3A3A3";

      // Draw connections between nearby points.
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const alpha = 0.06 * (1 - dist / 140);
            ctx.strokeStyle = colorWithAlpha(lineColor, alpha);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Tiny nodes.
      for (const p of points) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const alpha = dist < 120 ? 0.25 : 0.12;
        ctx.fillStyle = colorWithAlpha(lineColor, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function update() {
      for (const p of points) {
        // Gentle spring back to base position.
        const k = 0.02;
        const ax = (p.baseX - p.x) * k;
        const ay = (p.baseY - p.y) * k;

        // Pointer repulsion.
        let rx = 0;
        let ry = 0;
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          const force = (120 - dist) / 120;
          rx = (dx / dist) * force * 1.5;
          ry = (dy / dist) * force * 1.5;
        }

        p.vx += ax + rx;
        p.vy += ay + ry;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx;
        p.y += p.vy;
      }
    }

    function frame() {
      if (!reduced) update();
      draw();
      rafId = requestAnimationFrame(frame);
    }

    function onPointerMove(e: PointerEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }

    function onPointerLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }

    resize();
    window.addEventListener("resize", resize);
    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("pointerleave", onPointerLeave);

    if (reduced) {
      update(); // settle once so static connections are based on base positions
      draw();
    } else {
      rafId = requestAnimationFrame(frame);
    }

    return () => {
      window.removeEventListener("resize", resize);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(rafId);
    };
  }, [reduced]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden">
      <canvas ref={canvasRef} aria-hidden className="block" />
    </div>
  );
}
