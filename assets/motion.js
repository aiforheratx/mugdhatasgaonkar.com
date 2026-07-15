/* mugdhatasgaonkar.com — motion engine.
   No libraries. Everything here is a progressive enhancement: if this file fails
   to load or JS is off, the page is fully readable and all content is visible.

   Honours prefers-reduced-motion — when set, the canvas renders one static frame
   and all reveal/tilt behaviour is skipped. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
     1. Hero: a rotating 3D node graph.
     A nod to what the work actually is — agents as nodes, wired together.
     Points sit on a sphere, rotate on Y, project to 2D by hand.
     --------------------------------------------------------------- */

  function neuralHero(canvas) {
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var NODES = window.innerWidth < 640 ? 34 : 58;
    var LINK_DIST = 0.62;      // in normalised sphere units
    var nodes = [];
    var w = 0, h = 0, dpr = 1;
    var rot = 0;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var raf = null;

    // Deterministic scatter — no Math.random, so the layout is identical every
    // load and can't produce an occasional ugly clump.
    for (var i = 0; i < NODES; i++) {
      // Fibonacci sphere: even distribution without clustering at the poles.
      var k = i + 0.5;
      var phi = Math.acos(1 - 2 * k / NODES);
      var theta = Math.PI * (1 + Math.sqrt(5)) * k;
      nodes.push({
        x: Math.cos(theta) * Math.sin(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(phi),
        // a few nodes pulse, to suggest activity
        pulse: i % 7 === 0
      });
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2); // cap: 3x costs a lot, shows little
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function theme() {
      var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark') dark = true;
      if (attr === 'light') dark = false;
      return dark
        ? { node: 'rgba(96,165,250,', link: 'rgba(140,140,160,' }
        : { node: 'rgba(37,99,235,',  link: 'rgba(90,90,110,' };
    }

    function frame(t) {
      var c = theme();
      var R = Math.min(w, h) * 0.38;
      var cx = w / 2, cy = h / 2;

      // ease pointer toward target — parallax that doesn't jitter
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      if (!reduced) rot += 0.0016;

      var cos = Math.cos(rot), sin = Math.sin(rot);
      var tiltX = pointer.y * 0.28;
      var ct = Math.cos(tiltX), st = Math.sin(tiltX);

      var pts = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        // rotate Y
        var x1 = n.x * cos - n.z * sin;
        var z1 = n.x * sin + n.z * cos;
        // tilt X
        var y1 = n.y * ct - z1 * st;
        var z2 = n.y * st + z1 * ct;
        // perspective
        var persp = 1 / (2.2 - z2);
        pts.push({
          sx: cx + x1 * R * persp * 2.2 + pointer.x * 14,
          sy: cy + y1 * R * persp * 2.2,
          depth: (z2 + 1) / 2,       // 0 back .. 1 front
          nx: x1, ny: y1, nz: z2,
          pulse: n.pulse
        });
      }

      ctx.clearRect(0, 0, w, h);

      // links first, so nodes sit on top
      ctx.lineWidth = 1;
      for (var a = 0; a < pts.length; a++) {
        for (var b = a + 1; b < pts.length; b++) {
          var dx = pts[a].nx - pts[b].nx;
          var dy = pts[a].ny - pts[b].ny;
          var dz = pts[a].nz - pts[b].nz;
          var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > LINK_DIST) continue;
          var near = (pts[a].depth + pts[b].depth) / 2;
          var alpha = (1 - d / LINK_DIST) * 0.28 * near;
          ctx.strokeStyle = c.link + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(pts[a].sx, pts[a].sy);
          ctx.lineTo(pts[b].sx, pts[b].sy);
          ctx.stroke();
        }
      }

      for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        var r = 1.1 + p.depth * 2.4;
        var a2 = 0.25 + p.depth * 0.7;
        if (p.pulse && !reduced) {
          a2 *= 0.65 + 0.35 * Math.sin(t / 620 + j);
          r *= 1.15;
        }
        ctx.fillStyle = c.node + a2.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop(t) { frame(t); raf = requestAnimationFrame(loop); }

    function start() { if (raf === null && !reduced) raf = requestAnimationFrame(loop); }
    function stop() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    frame(0);
    if (!reduced) start();

    window.addEventListener('resize', function () { resize(); frame(0); }, { passive: true });

    // Don't burn battery on a tab nobody's looking at.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    // Stop when the hero scrolls away.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0 }).observe(canvas);
    }

    if (!reduced && window.matchMedia('(hover: hover)').matches) {
      window.addEventListener('mousemove', function (e) {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }
  }

  /* ---------------------------------------------------------------
     2. Scroll reveals
     --------------------------------------------------------------- */

  function reveals() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
        setTimeout(function () { el.classList.add('in'); }, delay);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
     3. Card tilt — pointer-based 3D, hover-capable devices only
     --------------------------------------------------------------- */

  function tilt() {
    if (reduced || !window.matchMedia('(hover: hover)').matches) return;

    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var rect = null;

      card.addEventListener('pointerenter', function () { rect = card.getBoundingClientRect(); });

      card.addEventListener('pointermove', function (e) {
        if (!rect) rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateY(' + (px * 7).toFixed(2) + 'deg) rotateX(' +
          (-py * 7).toFixed(2) + 'deg) translateY(-3px)';
        card.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
      });

      card.addEventListener('pointerleave', function () {
        rect = null;
        card.style.transform = '';
      });
    });
  }

  /* --------------------------------------------------------------- */

  function init() {
    var hero = document.getElementById('hero-canvas');
    if (hero) neuralHero(hero);
    reveals();
    tilt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
