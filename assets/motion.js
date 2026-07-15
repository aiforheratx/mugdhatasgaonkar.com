/* mugdhatasgaonkar.com — motion engine v2.
   No libraries. Everything is a progressive enhancement: JS off = fully readable page.
   prefers-reduced-motion: every canvas renders one complete static frame; loops never start.

   Scenes:
     1. hero        — 3D node graph + drifting particle field + pulses travelling the links
     2. annotation  — an AI annotating a SYNTHETIC scan: sweep → detect → segment → label
     3. ecg         — live ECG trace; the irregular beat gets flagged (the patent story)
   Plus: scroll reveals, count-up stats, word rotator, card tilt, scroll progress. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Seeded PRNG — deterministic visuals, identical on every load. */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Shared canvas runner: DPR-capped, pauses off-screen and on hidden tab.
     render(ctx, w, h, t) — with t frozen at STATIC_T when reduced. */
  var STATIC_T = 99999;
  function runCanvas(canvas, render) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var w = 0, h = 0, raf = null;

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(t) { render(ctx, w, h, t); raf = requestAnimationFrame(frame); }
    function start() { if (raf === null && !reduced) raf = requestAnimationFrame(frame); }
    function stop() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }

    resize();
    render(ctx, w, h, reduced ? STATIC_T : 0);
    start();

    window.addEventListener('resize', function () { resize(); render(ctx, w, h, reduced ? STATIC_T : 0); }, { passive: true });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0 }).observe(canvas);
    }
  }

  /* ---------------------------------------------------------------
     1. HERO — node sphere + particle field + link pulses
     --------------------------------------------------------------- */

  function hero(canvas) {
    var N = window.innerWidth < 640 ? 36 : 62;
    var LINK = 0.6;
    var nodes = [], dust = [];
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var rot = 0;
    var rand = rng(7);

    for (var i = 0; i < N; i++) {
      var k = i + 0.5;
      var phi = Math.acos(1 - 2 * k / N);
      var th = Math.PI * (1 + Math.sqrt(5)) * k;
      nodes.push({ x: Math.cos(th) * Math.sin(phi), y: Math.sin(th) * Math.sin(phi), z: Math.cos(phi), pulse: i % 6 === 0 });
    }
    for (var d = 0; d < (window.innerWidth < 640 ? 26 : 60); d++) {
      dust.push({ x: rand(), y: rand(), r: 0.6 + rand() * 1.6, v: 0.008 + rand() * 0.02, p: rand() * Math.PI * 2 });
    }

    if (!reduced && window.matchMedia('(hover: hover)').matches) {
      window.addEventListener('mousemove', function (e) {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    runCanvas(canvas, function (ctx, w, h, t) {
      var R = Math.min(w, h) * 0.36;
      var cx = w * (w < 640 ? 0.5 : 0.66), cy = h * 0.48;

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      if (t !== STATIC_T) rot = t * 0.00014;

      ctx.clearRect(0, 0, w, h);

      // drifting dust field
      for (var i = 0; i < dust.length; i++) {
        var s = dust[i];
        var dy = (s.y + (t === STATIC_T ? 0 : t * 0.000006 * (1 + s.v * 30))) % 1;
        var tw = 0.35 + 0.3 * Math.sin(t / 900 + s.p);
        ctx.fillStyle = 'rgba(150,170,220,' + (tw * 0.35).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(s.x * w, dy * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      var cos = Math.cos(rot), sin = Math.sin(rot);
      var tiltX = pointer.y * 0.3, ct = Math.cos(tiltX), st = Math.sin(tiltX);
      var pts = [];
      for (var n = 0; n < nodes.length; n++) {
        var o = nodes[n];
        var x1 = o.x * cos - o.z * sin, z1 = o.x * sin + o.z * cos;
        var y1 = o.y * ct - z1 * st, z2 = o.y * st + z1 * ct;
        var pr = 1 / (2.2 - z2);
        pts.push({
          sx: cx + x1 * R * pr * 2.2 + pointer.x * 16,
          sy: cy + y1 * R * pr * 2.2,
          dep: (z2 + 1) / 2, nx: x1, ny: y1, nz: z2, pulse: o.pulse
        });
      }

      // links + travelling pulses
      var li = 0;
      for (var a = 0; a < pts.length; a++) {
        for (var b = a + 1; b < pts.length; b++) {
          var dx = pts[a].nx - pts[b].nx, dyy = pts[a].ny - pts[b].ny, dz = pts[a].nz - pts[b].nz;
          var dist = Math.sqrt(dx * dx + dyy * dyy + dz * dz);
          if (dist > LINK) continue;
          li++;
          var near = (pts[a].dep + pts[b].dep) / 2;
          var alpha = (1 - dist / LINK) * 0.3 * near;
          ctx.strokeStyle = 'rgba(140,150,190,' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pts[a].sx, pts[a].sy);
          ctx.lineTo(pts[b].sx, pts[b].sy);
          ctx.stroke();
          // every 4th link carries a signal
          if (li % 4 === 0 && t !== STATIC_T) {
            var f = (t / 1400 + li * 0.37) % 1;
            var px = pts[a].sx + (pts[b].sx - pts[a].sx) * f;
            var py = pts[a].sy + (pts[b].sy - pts[a].sy) * f;
            ctx.fillStyle = 'rgba(96,165,250,' + (0.85 * near).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(px, py, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      for (var j = 0; j < pts.length; j++) {
        var p = pts[j];
        var r = 1.2 + p.dep * 2.6;
        var al = 0.3 + p.dep * 0.7;
        if (p.pulse && t !== STATIC_T) { al *= 0.6 + 0.4 * Math.sin(t / 600 + j); r *= 1.2; }
        ctx.fillStyle = 'rgba(120,175,255,' + al.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  /* ---------------------------------------------------------------
     2. ANNOTATION — AI annotating a synthetic scan.
     Cycle per region: sweep → bounding box → segmentation mask → typed label.
     Synthetic imagery only, and the HUD says so.
     --------------------------------------------------------------- */

  function annotation(canvas) {
    var REGIONS = [
      { cx: 0.36, cy: 0.42, rx: 0.13, ry: 0.16, label: 'cardiac chamber', conf: 0.94, color: '96,165,250' },
      { cx: 0.64, cy: 0.34, rx: 0.09, ry: 0.07, label: 'lesion candidate', conf: 0.87, color: '167,139,250' },
      { cx: 0.58, cy: 0.66, rx: 0.11, ry: 0.08, label: 'vessel branch', conf: 0.91, color: '52,211,153' }
    ];
    var PER = 3400, T = REGIONS.length * PER + 1600; // full cycle, with a hold at the end
    var bg = null, bgw = 0, bgh = 0;

    function paintBase(w, h) {
      bg = document.createElement('canvas');
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      bg.width = w * dpr; bg.height = h * dpr;
      var c = bg.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgw = w; bgh = h;

      c.fillStyle = '#07070D';
      c.fillRect(0, 0, w, h);

      // synthetic tissue: layered soft blobs
      var rand = rng(42);
      for (var i = 0; i < 26; i++) {
        var x = rand() * w, y = rand() * h;
        var r = (0.06 + rand() * 0.22) * Math.min(w, h);
        var g = c.createRadialGradient(x, y, 0, x, y, r);
        var lum = 18 + Math.floor(rand() * 30);
        g.addColorStop(0, 'rgba(' + lum + ',' + (lum + 4) + ',' + (lum + 12) + ',0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
      // brighter cores where the regions are, so detections look anchored
      REGIONS.forEach(function (rg) {
        var g = c.createRadialGradient(rg.cx * w, rg.cy * h, 0, rg.cx * w, rg.cy * h, rg.rx * w * 1.6);
        g.addColorStop(0, 'rgba(88,96,120,0.5)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(rg.cx * w, rg.cy * h, rg.rx * w * 1.5, rg.ry * h * 1.5, 0, 0, Math.PI * 2);
        c.fill();
      });
      // faint grid
      c.strokeStyle = 'rgba(120,130,170,0.07)';
      c.lineWidth = 1;
      for (var gx = 0; gx < w; gx += 28) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, h); c.stroke(); }
      for (var gy = 0; gy < h; gy += 28) { c.beginPath(); c.moveTo(0, gy); c.lineTo(w, gy); c.stroke(); }
    }

    function mono(c, size) { c.font = size + 'px ui-monospace, SFMono-Regular, Menlo, monospace'; }

    runCanvas(canvas, function (ctx, w, h, t) {
      if (!bg || bgw !== w || bgh !== h) paintBase(w, h);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bg, 0, 0, w, h);

      var tt = t === STATIC_T ? T : t % T;

      for (var i = 0; i < REGIONS.length; i++) {
        var rg = REGIONS[i];
        var lt = tt - i * PER;                    // local time for this region
        if (lt <= 0) continue;
        var x = rg.cx * w, y = rg.cy * h, rx = rg.rx * w, ry = rg.ry * h;
        var bx = x - rx - 10, by = y - ry - 10, bw = rx * 2 + 20, bh = ry * 2 + 20;

        // phase 1: sweep line crosses the box
        if (lt < 700 && t !== STATIC_T) {
          var sx = bx + bw * Math.min(1, lt / 700);
          var g = ctx.createLinearGradient(sx - 26, 0, sx, 0);
          g.addColorStop(0, 'rgba(' + rg.color + ',0)');
          g.addColorStop(1, 'rgba(' + rg.color + ',0.5)');
          ctx.fillStyle = g;
          ctx.fillRect(sx - 26, by, 26, bh);
        }

        // phase 2: bounding box draws itself (corner brackets first)
        var bp = Math.max(0, Math.min(1, (lt - 500) / 700));
        if (bp > 0) {
          ctx.strokeStyle = 'rgba(' + rg.color + ',0.9)';
          ctx.lineWidth = 1.5;
          var cl = 12; // corner length
          [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach(function (cn) {
            ctx.beginPath();
            ctx.moveTo(cn[0] + cl * cn[2] * bp, cn[1]);
            ctx.lineTo(cn[0], cn[1]);
            ctx.lineTo(cn[0], cn[1] + cl * cn[3] * bp);
            ctx.stroke();
          });
          if (bp >= 1) {
            ctx.strokeStyle = 'rgba(' + rg.color + ',0.28)';
            ctx.strokeRect(bx, by, bw, bh);
          }
        }

        // phase 3: segmentation mask blooms from the centroid
        var mp = Math.max(0, Math.min(1, (lt - 1300) / 800));
        if (mp > 0) {
          var e = 1 - Math.pow(1 - mp, 3);
          ctx.fillStyle = 'rgba(' + rg.color + ',' + (0.22 * e).toFixed(3) + ')';
          ctx.strokeStyle = 'rgba(' + rg.color + ',' + (0.75 * e).toFixed(3) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          // wobbly ellipse: reads "organic structure", not "perfect oval"
          for (var a2 = 0; a2 <= Math.PI * 2 + 0.01; a2 += Math.PI / 24) {
            var wob = 1 + 0.09 * Math.sin(a2 * 3 + i * 2) + 0.05 * Math.sin(a2 * 7 + i);
            var px = x + Math.cos(a2) * rx * e * wob;
            var py = y + Math.sin(a2) * ry * e * wob;
            a2 === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }

        // phase 4: label types itself + confidence counts up
        var lp = Math.max(0, Math.min(1, (lt - 2100) / 900));
        if (lp > 0) {
          var conf = (rg.conf * Math.min(1, lp * 1.4)).toFixed(2);
          var text = rg.label + ' · ' + conf;
          var shown = text.slice(0, Math.ceil(text.length * lp));
          mono(ctx, 11);
          var tw = ctx.measureText(text).width;
          var lx = Math.min(bx, w - tw - 18), ly = Math.max(14, by - 10);
          ctx.fillStyle = 'rgba(7,7,13,0.85)';
          ctx.fillRect(lx - 5, ly - 11, tw + 10, 16);
          ctx.fillStyle = 'rgba(' + rg.color + ',0.95)';
          ctx.fillText(shown + (lp < 1 && t !== STATIC_T ? '▏' : ''), lx, ly);
        }
      }

      // HUD
      mono(ctx, 10);
      ctx.fillStyle = 'rgba(160,170,200,0.75)';
      ctx.fillText('AI ANNOTATION — SYNTHETIC SLICE 128/256', 12, 18);
      var done = Math.min(REGIONS.length, Math.floor(tt / PER) + (tt % PER > 3000 ? 1 : 0));
      if (t === STATIC_T) done = REGIONS.length;
      ctx.fillStyle = 'rgba(160,170,200,0.55)';
      ctx.fillText('masks ' + done + '/' + REGIONS.length + ' · human review: queued', 12, h - 12);
    });
  }

  /* ---------------------------------------------------------------
     3. ECG — the trace draws itself; the irregular beat gets caught.
     --------------------------------------------------------------- */

  function ecg(canvas) {
    var BEAT = 170;          // px between beats
    var IRREG = 4;           // every Nth beat is the arrhythmia

    function yAt(x, h) {
      var mid = h * 0.56, amp = h * 0.3;
      var beat = Math.floor(x / BEAT);
      var ph = (x % BEAT) / BEAT;
      var irregular = beat % IRREG === IRREG - 1;
      var y = 0;
      // P wave
      y += 0.12 * Math.exp(-Math.pow((ph - 0.18) / 0.03, 2));
      // QRS
      var q = irregular ? 0.30 : 0.25;
      y += -0.16 * Math.exp(-Math.pow((ph - (q - 0.025)) / 0.011, 2));
      y += (irregular ? 0.72 : 1.0) * Math.exp(-Math.pow((ph - q) / 0.013, 2));
      y += -0.22 * Math.exp(-Math.pow((ph - (q + 0.028)) / 0.012, 2));
      if (irregular) { // premature second spike — the thing the model catches
        y += 0.55 * Math.exp(-Math.pow((ph - 0.52) / 0.014, 2));
        y += -0.14 * Math.exp(-Math.pow((ph - 0.555) / 0.012, 2));
      }
      // T wave
      y += 0.2 * Math.exp(-Math.pow((ph - (irregular ? 0.74 : 0.55)) / 0.05, 2));
      return mid - y * amp;
    }

    runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = 'rgba(120,130,170,0.08)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx < w; gx += 22) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (var gy = 0; gy < h; gy += 22) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

      var head = t === STATIC_T ? w : (t * 0.14) % (w + 140);
      var scroll = t === STATIC_T ? 0 : Math.floor(t * 0.014) ; // slow world-drift so beats vary

      function trace(from, to, style, width) {
        ctx.strokeStyle = style; ctx.lineWidth = width;
        ctx.beginPath();
        var first = true;
        for (var x = Math.max(0, from); x <= Math.min(w, to); x += 2) {
          var y = yAt(x + scroll, h);
          first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          first = false;
        }
        ctx.stroke();
      }

      // dim history + bright head segment
      trace(0, head, 'rgba(96,165,250,0.22)', 1.5);
      trace(head - 150, head, 'rgba(96,165,250,0.95)', 2);

      // glowing head dot
      if (t !== STATIC_T && head <= w) {
        ctx.fillStyle = 'rgba(150,200,255,1)';
        ctx.beginPath(); ctx.arc(head, yAt(head + scroll, h), 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(96,165,250,0.25)';
        ctx.beginPath(); ctx.arc(head, yAt(head + scroll, h), 9, 0, Math.PI * 2); ctx.fill();
      }

      // flag every irregular beat the head has passed
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
      for (var bx = -(scroll % BEAT); bx < w; bx += BEAT) {
        var beatIdx = Math.floor((bx + scroll) / BEAT);
        if (beatIdx % IRREG !== IRREG - 1) continue;
        var fx = bx + BEAT * 0.2, fw = BEAT * 0.55;
        if (fx + fw > head) continue;
        ctx.strokeStyle = 'rgba(248,113,113,0.65)';
        ctx.lineWidth = 1;
        ctx.strokeRect(fx, h * 0.14, fw, h * 0.7);
        ctx.fillStyle = 'rgba(7,7,13,0.85)';
        var lbl = 'arrhythmia · 0.97';
        var tw = ctx.measureText(lbl).width;
        ctx.fillRect(fx - 1, h * 0.14 - 15, tw + 8, 13);
        ctx.fillStyle = 'rgba(248,113,113,0.95)';
        ctx.fillText(lbl, fx + 3, h * 0.14 - 5);
      }
    });
  }

  /* ---------------------------------------------------------------
     4. Reveals, counters, rotator, tilt, progress
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
        setTimeout(function () { el.classList.add('in'); },
          parseInt(el.getAttribute('data-reveal-delay') || '0', 10));
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  function counters() {
    var els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    function run(el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      var suffix = el.getAttribute('data-suffix') || '';
      if (reduced) { el.textContent = target + suffix; return; }
      var t0 = null;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / 1300);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if (!('IntersectionObserver' in window) || reduced) { els.forEach(run); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    els.forEach(function (el) { io.observe(el); });
  }

  function rotator() {
    var el = document.getElementById('rotator');
    if (!el) return;
    var words = (el.getAttribute('data-words') || '').split('|').filter(Boolean);
    if (!words.length) return;
    if (reduced) { el.textContent = words[0]; return; }
    var wi = 0, ci = 0, dir = 1;
    (function tick() {
      var word = words[wi];
      ci += dir;
      el.textContent = word.slice(0, ci);
      var delay = dir > 0 ? 55 : 28;
      if (dir > 0 && ci >= word.length) { dir = -1; delay = 2100; }
      else if (dir < 0 && ci <= 0) { dir = 1; wi = (wi + 1) % words.length; delay = 350; }
      setTimeout(tick, delay);
    })();
  }

  function tilt() {
    if (reduced || !window.matchMedia('(hover: hover)').matches) return;
    document.querySelectorAll('[data-tilt]').forEach(function (card) {
      var rect = null;
      card.addEventListener('pointerenter', function () { rect = card.getBoundingClientRect(); });
      card.addEventListener('pointermove', function (e) {
        if (!rect) rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = 'perspective(900px) rotateY(' + (px * 8).toFixed(2) +
          'deg) rotateX(' + (-py * 8).toFixed(2) + 'deg) translateY(-3px)';
        card.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
        card.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () { rect = null; card.style.transform = ''; });
    });
  }

  function progress() {
    var bar = document.getElementById('progress');
    if (!bar || reduced) return;
    var ticking = false;
    function update() {
      var d = document.documentElement;
      var max = d.scrollHeight - d.clientHeight;
      bar.style.width = (max > 0 ? (d.scrollTop / max) * 100 : 0) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* --------------------------------------------------------------- */

  function init() {
    var hc = document.getElementById('hero-canvas');
    if (hc) hero(hc);
    var ac = document.getElementById('annotation-canvas');
    if (ac) annotation(ac);
    var ec = document.getElementById('ecg-canvas');
    if (ec) ecg(ec);
    reveals();
    counters();
    rotator();
    tilt();
    progress();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
