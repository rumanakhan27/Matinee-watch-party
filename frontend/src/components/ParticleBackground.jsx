import { useEffect, useRef } from "react";

export default function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const COUNT = 52;

    function spawn(fromBottom = false) {
      const isCyan = Math.random() < 0.2;
      const side = Math.random();
      let x;
      if (side < 0.3) x = Math.random() * W * 0.25;
      else if (side > 0.7) x = W - Math.random() * W * 0.25;
      else x = W * 0.15 + Math.random() * W * 0.7;

      return {
        x,
        y: fromBottom ? H + Math.random() * 60 : Math.random() * H,
        size: 0.6 + Math.random() * 1.6,
        vy: 0.15 + Math.random() * 0.4,
        vx: (Math.random() - 0.5) * 0.5,
        opacity: 0.2 + Math.random() * 0.7,
        opDir: Math.random() < 0.5 ? 1 : -1,
        opSpeed: 0.003 + Math.random() * 0.007,
        hue: isCyan ? 170 + Math.random() * 30 : 240 + Math.random() * 40,
        sat: isCyan ? 80 : 70,
      };
    }

    const particles = Array.from({ length: COUNT }, () => spawn());

    function draw() {
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        // flicker
        p.opacity += p.opSpeed * p.opDir;
        if (p.opacity > 0.9) { p.opacity = 0.9; p.opDir = -1; }
        if (p.opacity < 0.12) { p.opacity = 0.12; p.opDir = 1; }

        // move
        p.y -= p.vy;
        p.x += p.vx;

        // recycle
        if (p.y < -20) Object.assign(p, spawn(true));

        // glow
        const r = p.size * 3.5;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, 70%, ${p.opacity})`);
        g.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, 50%, 0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        // core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, 92%, ${p.opacity})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
