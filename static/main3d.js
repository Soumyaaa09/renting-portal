/* ============================================================
   DRIVENOW 3D UI — main3d.js
   Particle canvas + 3D tilt + rich scroll animation engine
   ============================================================ */

// ── Particle System ─────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [];
  const N = 90;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  class Particle {
    constructor() { this.reset(true); }
    reset(born) {
      this.x  = rand(0, W);
      this.y  = born ? rand(0, H) : H + 10;
      this.vx = rand(-0.15, 0.15);
      this.vy = rand(-0.4, -0.1);
      this.r  = rand(0.5, 2);
      this.life = 0;
      this.maxLife = rand(180, 400);
      this.hue = rand(180, 210);   // cyan-ish
      this.variant = Math.random() < 0.2 ? 'purple' : 'cyan';
    }
    update() {
      this.x += this.vx; this.y += this.vy; this.life++;
      if (this.life > this.maxLife || this.y < -10) this.reset(false);
    }
    draw() {
      const alpha = Math.sin((this.life / this.maxLife) * Math.PI) * 0.55;
      const color = this.variant === 'purple'
        ? `rgba(168,85,247,${alpha})`
        : `rgba(0,210,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function init() {
    resize();
    particles = Array.from({ length: N }, () => new Particle());
  }

  function connect() {
    const dist = 120;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < dist) {
          const alpha = (1 - d / dist) * 0.08;
          ctx.strokeStyle = `rgba(0,210,255,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    connect();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  init();
  loop();
})();


// ── 3D Tilt for .card elements ──────────────────────────────
(function init3DTilt() {
  const TILT = 10; // max degrees

  function applyTilt(card) {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const cx = r.width  / 2;
      const cy = r.height / 2;
      const rotX = -((y - cy) / cy) * TILT;
      const rotY =  ((x - cx) / cx) * TILT;
      card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px) scale(1.02)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateZ(0) scale(1)';
    });
  }

  function attachAll() {
    document.querySelectorAll('.card').forEach(applyTilt);
  }

  // run on load and after DOM mutations (for dynamic content)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAll);
  } else {
    attachAll();
  }
})();


// ── Navbar scroll shadow ─────────────────────────────────────
(function navScroll() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.style.boxShadow = window.scrollY > 20
      ? '0 4px 40px rgba(0,0,0,0.7), 0 0 0 0 transparent'
      : '';
  }, { passive: true });
})();


// ── Staggered fade-up on intersection ───────────────────────
(function fadeReveal() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-up').forEach(el => io.observe(el));
})();


// ════════════════════════════════════════════════════════════
//  SCROLL ANIMATION ENGINE
// ════════════════════════════════════════════════════════════

// ── 1. Scroll Progress Bar ───────────────────────────────────
(function scrollProgress() {
  const bar = document.createElement('div');
  bar.id = 'scroll-progress';
  document.body.prepend(bar);

  window.addEventListener('scroll', () => {
    const max  = document.documentElement.scrollHeight - window.innerHeight;
    const pct  = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
})();


// ── 2. 3D Reveal IntersectionObserver ───────────────────────
// Handles: .reveal-left, .reveal-right, .reveal-flip,
//          .reveal-zoom, .reveal-drop, .reveal-spin
(function scrollReveal3D() {
  const classes = [
    '.reveal-left', '.reveal-right', '.reveal-flip',
    '.reveal-zoom', '.reveal-drop', '.reveal-spin'
  ];
  const selector = classes.join(',');

  // Auto-apply reveal class to cards and sections not already marked
  document.querySelectorAll('.card').forEach((card, i) => {
    if (classes.some(c => card.matches(c))) return; // already has one
    const types = ['reveal-flip', 'reveal-zoom', 'reveal-left', 'reveal-right'];
    card.classList.add(types[i % types.length]);
  });

  document.querySelectorAll('.page-header').forEach(el => {
    if (!el.classList.contains('reveal-drop')) el.classList.add('reveal-drop');
  });

  document.querySelectorAll('.table-wrapper').forEach(el => {
    if (!el.classList.contains('reveal-zoom')) el.classList.add('reveal-zoom');
  });

  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    document.querySelectorAll(selector).forEach(el => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // Observe all current + future elements
  function observe() {
    document.querySelectorAll(selector).forEach(el => {
      if (!el.classList.contains('in-view')) io.observe(el);
    });
  }
  observe();

  // Re-observe if new cards appear
  const mo = new MutationObserver(observe);
  mo.observe(document.body, { childList: true, subtree: true });
})();


// ── 3. Parallax Depth Layers ─────────────────────────────────
// Elements with data-parallax="0.2" move at 20% scroll speed
(function parallax() {
  const elements = [];

  function collect() {
    document.querySelectorAll('[data-parallax]').forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.1;
      elements.push({ el, speed, startY: el.getBoundingClientRect().top + window.scrollY });
    });
  }

  // Also apply to hero-visual if present
  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual) heroVisual.setAttribute('data-parallax', '0.3');

  const heroBg = document.querySelector('.hero::before');

  collect();

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      elements.forEach(({ el, speed }) => {
        const offset = sy * speed;
        el.style.transform = `translateY(${offset}px)`;
      });
      ticking = false;
    });
  }, { passive: true });
})();


// ── 4. Counter Number Animation ──────────────────────────────
// Animates numbers up when .stat-value scrolls into view
(function counterAnimation() {
  function parseNum(str) {
    // Strip non-numeric except dot, K, M, +
    const clean = str.replace(/[₹,\s]/g, '');
    let mult = 1;
    if (clean.endsWith('K')) { mult = 1000; }
    if (clean.endsWith('M')) { mult = 1000000; }
    const num = parseFloat(clean.replace(/[KM+]/g, ''));
    return { num: isNaN(num) ? 0 : num, mult, suffix: str.replace(/[\d.,]/g, '').trim() };
  }

  function formatNum(n, suffix, mult) {
    if (mult === 1000)    return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' + (suffix.includes('+') ? '+' : '');
    if (mult === 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (suffix.includes('.')) return n.toFixed(1);
    return Math.round(n).toLocaleString() + (suffix.includes('+') ? '+' : '');
  }

  function animateCounter(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = 'true';
    const original = el.textContent.trim();
    const { num, mult, suffix } = parseNum(original);
    if (!num) return;

    const duration = 1400;
    const start    = performance.now();

    function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = easeOutExpo(t);
      el.textContent = formatNum(ease * num, suffix, mult);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = original; // restore exact
    }
    requestAnimationFrame(tick);
  }

  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { animateCounter(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.5 });

  function attach() {
    document.querySelectorAll('.stat-value').forEach(el => io.observe(el));
  }
  attach();
  // Observe for new stat values added dynamically
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
})();


// ── 5. Table Row Scanline Reveal ─────────────────────────────
(function tableReveal() {
  function revealRows(table) {
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, i) => {
      setTimeout(() => row.classList.add('row-visible'), i * 80);
    });
  }

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('table').forEach(t => {
      t.querySelectorAll('tbody tr').forEach(r => r.classList.add('row-visible'));
    });
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { revealRows(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.05 });

  document.querySelectorAll('table').forEach(t => io.observe(t));
})();


// ── 6. Scroll-driven 3D Gyroscope on Hero Title ──────────────
(function heroGyro() {
  const hero = document.querySelector('.hero-title');
  if (!hero) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      const rotX = Math.min(sy * 0.03, 18);
      const tz   = Math.min(sy * 0.12, 60);
      const alpha = Math.max(1 - sy / 500, 0);
      hero.style.transform  = `perspective(1000px) rotateX(${rotX}deg) translateZ(-${tz}px)`;
      hero.style.opacity    = alpha;
      ticking = false;
    });
  }, { passive: true });
})();


// ── 7. Floating card drift on scroll ─────────────────────────
// Cards bob up/down at different rates to create depth illusion
(function cardDrift() {
  const cards = document.querySelectorAll('.card');
  const drifts = Array.from(cards).map((_, i) => ({
    speed: 0.04 + (i % 3) * 0.02,
    dir:   i % 2 === 0 ? 1 : -1,
    phase: i * 0.3
  }));

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      cards.forEach((card, i) => {
        // Only drift if card is NOT being hovered (tilt takes priority)
        if (card.matches(':hover')) return;
        const { speed, dir, phase } = drifts[i];
        const y = Math.sin((sy * speed) + phase) * 6 * dir;
        const rz = Math.sin((sy * speed * 0.5) + phase) * 1.2;
        card.style.transform = `perspective(900px) translateY(${y}px) rotateZ(${rz}deg)`;
      });
      ticking = false;
    });
  }, { passive: true });
})();


// ── 8. Navbar brand morph on scroll ──────────────────────────
(function navMorph() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  let lastY = 0;

  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    const dir = sy > lastY ? 'down' : 'up';
    lastY = sy;

    // Compress navbar slightly on scroll down
    if (sy > 80) {
      nav.style.height   = '54px';
      nav.style.padding  = '0 48px';
    } else {
      nav.style.height   = '';
      nav.style.padding  = '';
    }

    // Hide on fast scroll down, show on scroll up
    if (sy > 200 && dir === 'down') {
      nav.style.transform = 'translateY(-100%)';
    } else {
      nav.style.transform = 'translateY(0)';
    }
  }, { passive: true });
})();


// ── 9. Cursor glow trail ─────────────────────────────────────
(function cursorGlow() {
  const dot = document.createElement('div');
  dot.style.cssText = `
    position: fixed; pointer-events: none; z-index: 9998;
    width: 20px; height: 20px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,210,255,0.6), transparent 70%);
    transform: translate(-50%, -50%);
    transition: transform 0.08s ease, width 0.2s ease, height 0.2s ease, opacity 0.3s ease;
    mix-blend-mode: screen;
    opacity: 0;
  `;
  document.body.appendChild(dot);

  let mx = 0, my = 0, cx = 0, cy = 0;

  window.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.opacity = '1';
  });

  document.querySelectorAll('.btn, .card, a').forEach(el => {
    el.addEventListener('mouseenter', () => {
      dot.style.width  = '50px';
      dot.style.height = '50px';
      dot.style.background = 'radial-gradient(circle, rgba(0,210,255,0.35), transparent 70%)';
    });
    el.addEventListener('mouseleave', () => {
      dot.style.width  = '20px';
      dot.style.height = '20px';
      dot.style.background = 'radial-gradient(circle, rgba(0,210,255,0.6), transparent 70%)';
    });
  });

  // Smooth lerp follow
  (function lerpLoop() {
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    dot.style.left = cx + 'px';
    dot.style.top  = cy + 'px';
    requestAnimationFrame(lerpLoop);
  })();
})();


// ── 10. Section entrance — stagger grid children ─────────────
(function staggerGridReveal() {
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const grid = entry.target;
      const children = grid.querySelectorAll(':scope > .card, :scope > a');
      children.forEach((child, i) => {
        child.style.transitionDelay = `${i * 0.1}s`;
        setTimeout(() => child.classList.add('in-view'), i * 100);
      });
      io.unobserve(grid);
    });
  }, { threshold: 0.05 });

  document.querySelectorAll('.grid').forEach(g => io.observe(g));
})();