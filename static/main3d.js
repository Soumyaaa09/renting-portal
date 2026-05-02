/* ============================================================
   DRIVENOW — main3d.js  |  Glassmorphism Edition
   ============================================================ */

// ── 3D Tilt ──────────────────────────────────────────────────
(function init3DTilt() {
  const TILT = 7;
  function applyTilt(card) {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const rx = -((e.clientY - r.top  - r.height/2) / (r.height/2)) * TILT;
      const ry =  ((e.clientX - r.left - r.width/2)  / (r.width/2))  * TILT;
      card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(12px) scale(1.02)`;
      card.style.boxShadow = `0 24px 60px rgba(0,0,0,0.5), 0 0 40px rgba(108,99,255,0.2)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = ''; });
  }
  function attachAll() { document.querySelectorAll('.card').forEach(applyTilt); }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', attachAll) : attachAll();
})();

// ── Navbar scroll ─────────────────────────────────────────────
(function navScroll() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const sy = window.scrollY;
    nav.style.background = sy > 20
      ? 'rgba(8,11,20,0.92)'
      : 'rgba(8,11,20,0.75)';
    nav.style.boxShadow = sy > 20 ? '0 4px 32px rgba(0,0,0,0.4)' : '';
    if (sy > 80) nav.style.height = '54px'; else nav.style.height = '';
    nav.style.transform = sy > 200 && sy > lastY ? 'translateY(-100%)' : 'translateY(0)';
    nav.style.transition = 'transform .35s cubic-bezier(.23,1,.32,1), height .3s, background .3s, box-shadow .3s';
    lastY = sy;
  }, { passive: true });
})();

// ── Scroll progress ───────────────────────────────────────────
(function scrollProgress() {
  const bar = document.createElement('div');
  bar.id = 'scroll-progress';
  document.body.prepend(bar);
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? window.scrollY / max * 100 : 0) + '%';
  }, { passive: true });
})();

// ── 3D Reveal ─────────────────────────────────────────────────
(function scrollReveal3D() {
  const classes = ['.reveal-left','.reveal-right','.reveal-flip','.reveal-zoom','.reveal-drop','.reveal-spin'];
  const types   = ['reveal-flip','reveal-zoom','reveal-left','reveal-right'];

  document.querySelectorAll('.card').forEach((card, i) => {
    if (classes.some(c => card.matches(c))) return;
    card.classList.add(types[i % types.length]);
  });
  document.querySelectorAll('.page-header').forEach(el => { if (!el.classList.contains('reveal-drop')) el.classList.add('reveal-drop'); });
  document.querySelectorAll('.table-wrapper').forEach(el => { if (!el.classList.contains('reveal-zoom')) el.classList.add('reveal-zoom'); });

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll(classes.join(',')).forEach(el => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  function observe() { document.querySelectorAll(classes.join(',')).forEach(el => { if (!el.classList.contains('in-view')) io.observe(el); }); }
  observe();
  new MutationObserver(observe).observe(document.body, { childList: true, subtree: true });
})();

// ── Parallax ──────────────────────────────────────────────────
(function parallax() {
  const elements = [];
  const heroImg = document.querySelector('[data-parallax]');
  if (heroImg) elements.push({ el: heroImg, speed: parseFloat(heroImg.dataset.parallax) || 0.15 });
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      elements.forEach(({ el, speed }) => { el.style.transform = `translateY(${window.scrollY * speed}px)`; });
      ticking = false;
    });
  }, { passive: true });
})();

// ── Counter animation ─────────────────────────────────────────
(function counterAnimation() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.dataset.counted) return;
      el.dataset.counted = '1';
      const original = el.textContent.trim();
      const num = parseFloat(original.replace(/[^\d.]/g, ''));
      if (!num) return;
      const suffix = original.replace(/[\d.]/g, '');
      const start = performance.now();
      const dur = 1200;
      const ease = t => 1 - Math.pow(2, -10 * t);
      const tick = now => {
        const t = Math.min((now - start) / dur, 1);
        el.textContent = (Math.round(ease(t) * num * 10) / 10) + suffix;
        if (t < 1) requestAnimationFrame(tick); else el.textContent = original;
      };
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold: 0.5 });
  function attach() { document.querySelectorAll('.stat-value').forEach(el => io.observe(el)); }
  attach();
  new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
})();

// ── Table row reveal ──────────────────────────────────────────
(function tableReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('tbody tr').forEach(r => r.classList.add('row-visible'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('tbody tr').forEach((row, i) => {
        setTimeout(() => row.classList.add('row-visible'), i * 65);
      });
      io.unobserve(e.target);
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('table').forEach(t => io.observe(t));
})();

// ── Hero depth scroll ─────────────────────────────────────────
(function heroDepth() {
  const hero = document.querySelector('.hero-title');
  if (!hero) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      hero.style.transform = `perspective(1000px) rotateX(${Math.min(sy * 0.022, 12)}deg) translateZ(-${Math.min(sy * 0.08, 40)}px)`;
      hero.style.opacity   = Math.max(1 - sy / 500, 0);
      ticking = false;
    });
  }, { passive: true });
})();

// ── Card drift on scroll ──────────────────────────────────────
(function cardDrift() {
  const cards  = document.querySelectorAll('.card');
  const drifts = Array.from(cards).map((_, i) => ({ speed: 0.03 + (i%3)*0.015, dir: i%2?1:-1, phase: i*0.3 }));
  let ticking  = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      cards.forEach((card, i) => {
        if (card.matches(':hover')) return;
        const { speed, dir, phase } = drifts[i];
        const y  = Math.sin((sy * speed) + phase) * 4 * dir;
        const rz = Math.sin((sy * speed * 0.5) + phase) * 0.6;
        card.style.transform = `perspective(900px) translateY(${y}px) rotateZ(${rz}deg)`;
      });
      ticking = false;
    });
  }, { passive: true });
})();

// ── Purple cursor glow ────────────────────────────────────────
(function cursorGlow() {
  if (window.matchMedia('(hover: none)').matches) return;
  const dot = document.createElement('div');
  dot.style.cssText = `
    position:fixed; pointer-events:none; z-index:9998;
    width:20px; height:20px; border-radius:50%;
    background:radial-gradient(circle, rgba(108,99,255,0.6), transparent 70%);
    transform:translate(-50%,-50%);
    transition:width .2s ease, height .2s ease, opacity .3s ease;
    mix-blend-mode:screen; opacity:0;
  `;
  document.body.appendChild(dot);
  let mx=0, my=0, cx=0, cy=0;
  window.addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; dot.style.opacity='1'; });
  document.querySelectorAll('.btn,.card,a').forEach(el => {
    el.addEventListener('mouseenter', () => { dot.style.width='48px'; dot.style.height='48px'; dot.style.background='radial-gradient(circle,rgba(108,99,255,0.3),transparent 70%)'; });
    el.addEventListener('mouseleave', () => { dot.style.width='20px'; dot.style.height='20px'; dot.style.background='radial-gradient(circle,rgba(108,99,255,0.6),transparent 70%)'; });
  });
  (function lerpLoop() {
    cx += (mx-cx)*0.14; cy += (my-cy)*0.14;
    dot.style.left=cx+'px'; dot.style.top=cy+'px';
    requestAnimationFrame(lerpLoop);
  })();
})();

// ── Stagger grid on reveal ────────────────────────────────────
(function staggerGridReveal() {
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.querySelectorAll(':scope>.card,:scope>a').forEach((child, i) => {
        child.style.transitionDelay = `${i * 0.09}s`;
        setTimeout(() => child.classList.add('in-view'), i * 90);
      });
      io.unobserve(entry.target);
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.grid').forEach(g => io.observe(g));
})();

// ── Glassmorphism shimmer on hover ────────────────────────────
(function cardShimmer() {
  document.querySelectorAll('.card').forEach(card => {
    const shimmer = document.createElement('div');
    shimmer.style.cssText = `
      position:absolute; inset:0; border-radius:inherit; pointer-events:none;
      background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08), transparent 60%);
      opacity:0; transition:opacity .3s ease; z-index:1;
    `;
    card.style.position = 'relative';
    card.appendChild(shimmer);
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width)  * 100;
      const y = ((e.clientY - r.top)  / r.height) * 100;
      shimmer.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.1), transparent 55%)`;
      shimmer.style.opacity = '1';
    });
    card.addEventListener('mouseleave', () => { shimmer.style.opacity = '0'; });
  });
})();