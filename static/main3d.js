/* ============================================================
   DRIVENOW — main3d.js
   Light theme · 3D scroll animations · Warm cursor trail
   ============================================================ */

// ── 3D Tilt for .card elements ──────────────────────────────
(function init3DTilt() {
  const TILT = 8;

  function applyTilt(card) {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const x  = e.clientX - r.left;
      const y  = e.clientY - r.top;
      const cx = r.width  / 2;
      const cy = r.height / 2;
      const rotX = -((y - cy) / cy) * TILT;
      const rotY =  ((x - cx) / cx) * TILT;
      card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(10px) scale(1.02)`;
      card.style.boxShadow = `0 16px 56px rgba(30,20,10,0.16), 0 2px 8px rgba(30,20,10,0.08)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform  = '';
      card.style.boxShadow  = '';
    });
  }

  function attachAll() {
    document.querySelectorAll('.card').forEach(applyTilt);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAll);
  } else {
    attachAll();
  }
})();


// ── Navbar scroll behaviour ──────────────────────────────────
(function navScroll() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  let lastY = 0;

  window.addEventListener('scroll', () => {
    const sy  = window.scrollY;
    const dir = sy > lastY ? 'down' : 'up';
    lastY = sy;

    nav.style.boxShadow = sy > 20
      ? '0 2px 24px rgba(30,20,10,0.1), 0 1px 0 rgba(30,20,10,0.06)'
      : '';

    if (sy > 80) {
      nav.style.height  = '54px';
    } else {
      nav.style.height  = '';
    }

    if (sy > 200 && dir === 'down') {
      nav.style.transform = 'translateY(-100%)';
    } else {
      nav.style.transform = 'translateY(0)';
    }
    nav.style.transition = 'transform 0.35s cubic-bezier(0.23,1,0.32,1), height 0.3s ease, box-shadow 0.3s ease';
  }, { passive: true });
})();


// ── Scroll Progress Bar ──────────────────────────────────────
(function scrollProgress() {
  const bar = document.createElement('div');
  bar.id = 'scroll-progress';
  document.body.prepend(bar);

  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
})();


// ── 3D Reveal IntersectionObserver ──────────────────────────
(function scrollReveal3D() {
  const classes = [
    '.reveal-left', '.reveal-right', '.reveal-flip',
    '.reveal-zoom', '.reveal-drop', '.reveal-spin'
  ];
  const selector = classes.join(',');

  // Auto-assign reveal classes to cards not already tagged
  document.querySelectorAll('.card').forEach((card, i) => {
    if (classes.some(c => card.matches(c))) return;
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
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  function observe() {
    document.querySelectorAll(selector).forEach(el => {
      if (!el.classList.contains('in-view')) io.observe(el);
    });
  }
  observe();
  new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
})();


// ── Parallax Depth Layers ────────────────────────────────────
(function parallax() {
  const elements = [];

  function collect() {
    document.querySelectorAll('[data-parallax]').forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.1;
      elements.push({ el, speed });
    });
  }

  const heroVisual = document.querySelector('.hero-visual');
  if (heroVisual) heroVisual.setAttribute('data-parallax', '0.25');

  collect();

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      elements.forEach(({ el, speed }) => {
        el.style.transform = `translateY(${sy * speed}px)`;
      });
      ticking = false;
    });
  }, { passive: true });
})();


// ── Counter Number Animation ─────────────────────────────────
(function counterAnimation() {
  function parseNum(str) {
    const clean = str.replace(/[₹,\s]/g, '');
    let mult = 1;
    if (clean.endsWith('K')) mult = 1000;
    if (clean.endsWith('M')) mult = 1000000;
    const num = parseFloat(clean.replace(/[KM+]/g, ''));
    return { num: isNaN(num) ? 0 : num, mult, suffix: str.replace(/[\d.,]/g, '').trim() };
  }

  function formatNum(n, suffix, mult) {
    if (mult === 1000)    return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K' + (suffix.includes('+') ? '+' : '');
    if (mult === 1000000) return (n / 1000000).toFixed(1) + 'M';
    return Math.round(n).toLocaleString() + (suffix.includes('+') ? '+' : '');
  }

  function animateCounter(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = 'true';
    const original = el.textContent.trim();
    const { num, mult, suffix } = parseNum(original);
    if (!num) return;

    const duration = 1300;
    const start = performance.now();
    function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      el.textContent = formatNum(easeOutExpo(t) * num, suffix, mult);
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = original;
    }
    requestAnimationFrame(tick);
  }

  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { animateCounter(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.5 });

  function attach() { document.querySelectorAll('.stat-value').forEach(el => io.observe(el)); }
  attach();
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
})();


// ── Table Row Scanline Reveal ────────────────────────────────
(function tableReveal() {
  function revealRows(table) {
    table.querySelectorAll('tbody tr').forEach((row, i) => {
      setTimeout(() => row.classList.add('row-visible'), i * 70);
    });
  }

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('table').forEach(t =>
      t.querySelectorAll('tbody tr').forEach(r => r.classList.add('row-visible'))
    );
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { revealRows(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.05 });
  document.querySelectorAll('table').forEach(t => io.observe(t));
})();


// ── Hero title depth scroll ──────────────────────────────────
(function heroGyro() {
  const hero = document.querySelector('.hero-title');
  if (!hero) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy   = window.scrollY;
      const rotX = Math.min(sy * 0.025, 14);
      const tz   = Math.min(sy * 0.1, 50);
      const alpha = Math.max(1 - sy / 480, 0);
      hero.style.transform = `perspective(1000px) rotateX(${rotX}deg) translateZ(-${tz}px)`;
      hero.style.opacity   = alpha;
      ticking = false;
    });
  }, { passive: true });
})();


// ── Card drift on scroll ─────────────────────────────────────
(function cardDrift() {
  const cards  = document.querySelectorAll('.card');
  const drifts = Array.from(cards).map((_, i) => ({
    speed: 0.035 + (i % 3) * 0.018,
    dir:   i % 2 === 0 ? 1 : -1,
    phase: i * 0.35
  }));

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      cards.forEach((card, i) => {
        if (card.matches(':hover')) return;
        const { speed, dir, phase } = drifts[i];
        const y  = Math.sin((sy * speed) + phase) * 5 * dir;
        const rz = Math.sin((sy * speed * 0.5) + phase) * 0.8;
        card.style.transform = `perspective(900px) translateY(${y}px) rotateZ(${rz}deg)`;
      });
      ticking = false;
    });
  }, { passive: true });
})();


// ── Warm cursor glow trail ───────────────────────────────────
(function cursorGlow() {
  // Skip on touch devices
  if (window.matchMedia('(hover: none)').matches) return;

  const dot = document.createElement('div');
  dot.style.cssText = `
    position: fixed; pointer-events: none; z-index: 9998;
    width: 18px; height: 18px; border-radius: 50%;
    background: radial-gradient(circle, rgba(200,82,42,0.55), transparent 70%);
    transform: translate(-50%, -50%);
    transition: width 0.2s ease, height 0.2s ease, opacity 0.3s ease;
    mix-blend-mode: multiply;
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
      dot.style.width  = '44px';
      dot.style.height = '44px';
      dot.style.background = 'radial-gradient(circle, rgba(200,82,42,0.25), transparent 70%)';
    });
    el.addEventListener('mouseleave', () => {
      dot.style.width  = '18px';
      dot.style.height = '18px';
      dot.style.background = 'radial-gradient(circle, rgba(200,82,42,0.55), transparent 70%)';
    });
  });

  (function lerpLoop() {
    cx += (mx - cx) * 0.16;
    cy += (my - cy) * 0.16;
    dot.style.left = cx + 'px';
    dot.style.top  = cy + 'px';
    requestAnimationFrame(lerpLoop);
  })();
})();


// ── Stagger grid children on reveal ─────────────────────────
(function staggerGridReveal() {
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const grid = entry.target;
      const children = grid.querySelectorAll(':scope > .card, :scope > a');
      children.forEach((child, i) => {
        child.style.transitionDelay = `${i * 0.09}s`;
        setTimeout(() => child.classList.add('in-view'), i * 90);
      });
      io.unobserve(grid);
    });
  }, { threshold: 0.05 });

  document.querySelectorAll('.grid').forEach(g => io.observe(g));
})();