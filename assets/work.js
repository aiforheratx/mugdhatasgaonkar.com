/* mugdhatasgaonkar.com — work-page scene engine.
   No libraries, same rules as motion.js: JS off = readable page,
   prefers-reduced-motion = one complete static frame, loops never start.

   Pieces:
     scenes   — per-project hero canvas (canvas.scene[data-scene=…])
     arch     — HUD architecture diagram from a JSON spec (canvas.arch[data-spec=…])
     chart    — horizontal bar chart from a JSON spec (canvas.chart[data-spec=…])
*/

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STATIC_T = 99999;
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  function accentOf(el) {
    var s = getComputedStyle(el);
    return (s.getPropertyValue('--accent') || '#60A5FA').trim();
  }
  /* '#RRGGBB' -> 'r,g,b' so scenes can write rgba(...) alphas */
  function rgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function runCanvas(canvas, render) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var w = 0, h = 0, raf = null, t0 = null;

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(t) {
      if (t0 === null) t0 = t;
      render(ctx, w, h, t - t0);
      raf = requestAnimationFrame(frame);
    }
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
    return { redraw: function () { resize(); render(ctx, w, h, reduced ? STATIC_T : 0); } };
  }

  function mono(ctx, size) { ctx.font = size + 'px ' + MONO; }

  /* =================================================================
     HERO SCENES
     ================================================================= */

  /* AFHA — five named agents orbiting a hub; packets fly hub -> LinkedIn. */
  function sceneConstellation(canvas) {
    var AGENTS = ['NOVA', 'SAGE', 'IRIS', 'ARIA', 'ATHENA'];
    var ac = rgb(accentOf(canvas));
    runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      var cx = w * (w < 640 ? 0.5 : 0.68), cy = h * 0.5;
      var R = Math.min(w, h) * 0.3;
      var tt = t === STATIC_T ? 2600 : t;

      // hub
      var breathe = 1 + 0.06 * Math.sin(tt / 700);
      ctx.fillStyle = 'rgba(' + ac + ',0.16)';
      ctx.beginPath(); ctx.arc(cx, cy, 26 * breathe, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(' + ac + ',0.9)';
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
      mono(ctx, 10);
      ctx.fillStyle = 'rgba(' + ac + ',0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('DASHBOARD', cx, cy + 42);

      // LinkedIn sink, off to the side
      var lx = w < 640 ? cx : w * 0.93, ly = w < 640 ? h * 0.1 : h * 0.22;
      ctx.strokeStyle = 'rgba(' + ac + ',0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx - 26, ly - 12, 52, 24);
      ctx.fillStyle = 'rgba(244,244,246,0.75)';
      ctx.fillText('LINKEDIN', lx, ly + 4);

      // approval gate between hub and LinkedIn
      var gx = cx + (lx - cx) * 0.55, gy = cy + (ly - cy) * 0.55;

      for (var i = 0; i < AGENTS.length; i++) {
        var ang = tt / 9000 * Math.PI * 2 + (i / AGENTS.length) * Math.PI * 2;
        var ex = 1 + 0.12 * Math.sin(tt / 1300 + i * 2);
        var x = cx + Math.cos(ang) * R * ex;
        var y = cy + Math.sin(ang) * R * 0.62 * ex;

        // spoke
        ctx.strokeStyle = 'rgba(' + ac + ',0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();

        // signal travelling the spoke toward the hub
        if (t !== STATIC_T || i % 2 === 0) {
          var f = t === STATIC_T ? 0.6 : (tt / 1600 + i * 0.31) % 1;
          ctx.fillStyle = 'rgba(' + ac + ',0.9)';
          ctx.beginPath();
          ctx.arc(x + (cx - x) * f, y + (cy - y) * f, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        var pulse = 1 + 0.25 * Math.sin(tt / 500 + i * 1.7);
        ctx.fillStyle = 'rgba(' + ac + ',0.9)';
        ctx.beginPath(); ctx.arc(x, y, 4.5 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(244,244,246,0.85)';
        ctx.fillText(AGENTS[i], x, y - 12);
      }

      // hub -> approval -> LinkedIn flow
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(' + ac + ',0.4)';
      ctx.lineWidth = 1.2;
      ctx.lineDashOffset = t === STATIC_T ? 0 : -tt / 40;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(gx, gy); ctx.lineTo(lx, ly + 14); ctx.stroke();
      ctx.setLineDash([]);
      // the human approval gate
      ctx.fillStyle = '#060609';
      ctx.strokeStyle = 'rgba(52,211,153,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(gx, gy, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(52,211,153,0.95)';
      ctx.beginPath(); ctx.moveTo(gx - 3.5, gy); ctx.lineTo(gx - 1, gy + 3); ctx.lineTo(gx + 4, gy - 3); ctx.stroke();
      ctx.fillStyle = 'rgba(52,211,153,0.85)';
      ctx.fillText('HUMAN APPROVAL', gx, gy + 24);
      ctx.textAlign = 'left';
    });
  }

  /* Mbrain — radar sweep over the fleet; blips light up as the beam passes. */
  function sceneRadar(canvas) {
    var ac = rgb(accentOf(canvas));
    var rand = rng(11);
    var blips = [];
    for (var i = 0; i < 8; i++) {
      blips.push({ a: rand() * Math.PI * 2, r: 0.3 + rand() * 0.62, ok: i % 4 !== 3 });
    }
    runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      var cx = w * (w < 640 ? 0.5 : 0.68), cy = h * 0.52;
      var R = Math.min(w, h) * 0.4;
      var tt = t === STATIC_T ? 4200 : t;
      var sweep = (tt / 3400) * Math.PI * 2;

      ctx.strokeStyle = 'rgba(' + ac + ',0.16)';
      ctx.lineWidth = 1;
      for (var r = 1; r <= 3; r++) {
        ctx.beginPath(); ctx.arc(cx, cy, R * r / 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

      // sweep wedge
      var g = ctx.createConicGradient ? ctx.createConicGradient(sweep, cx, cy) : null;
      if (g) {
        g.addColorStop(0, 'rgba(' + ac + ',0.3)');
        g.addColorStop(0.12, 'rgba(' + ac + ',0)');
        g.addColorStop(1, 'rgba(' + ac + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(' + ac + ',0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();

      mono(ctx, 9);
      for (var b = 0; b < blips.length; b++) {
        var bl = blips[b];
        var bx = cx + Math.cos(bl.a) * R * bl.r;
        var by = cy + Math.sin(bl.a) * R * bl.r;
        // brightness decays with angular distance behind the beam
        var d = (sweep - bl.a) % (Math.PI * 2); if (d < 0) d += Math.PI * 2;
        var lum = t === STATIC_T ? 0.75 : Math.max(0.18, 1 - d / 2.6);
        var col = bl.ok ? '52,211,153' : '248,113,113';
        ctx.fillStyle = 'rgba(' + col + ',' + lum.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(bx, by, 3.4, 0, Math.PI * 2); ctx.fill();
        if (lum > 0.55) {
          ctx.strokeStyle = 'rgba(' + col + ',' + (lum * 0.4).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(' + ac + ',0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('FLEET SCAN', cx, cy + R + 16);
      ctx.textAlign = 'left';
    });
  }

  /* MindPulse — cycle ring + mood wave, everything inside the device outline. */
  function scenePulse(canvas) {
    var ac = rgb(accentOf(canvas));
    runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      var cx = w * (w < 640 ? 0.5 : 0.7), cy = h * 0.5;
      var R = Math.min(w, h) * 0.27;
      var tt = t === STATIC_T ? 5000 : t;

      // cycle ring: 28 ticks, the "learned window" arc glows
      for (var i = 0; i < 28; i++) {
        var a = (i / 28) * Math.PI * 2 - Math.PI / 2;
        var on = i < ((tt / 260) % 30);
        var inWin = i >= 22 || i <= 2;   // the phase the engine flags
        var col = inWin ? '248,113,113' : ac;
        ctx.strokeStyle = 'rgba(' + col + ',' + (on ? 0.9 : 0.2) + ')';
        ctx.lineWidth = on ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10));
        ctx.stroke();
      }
      mono(ctx, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(' + ac + ',0.85)';
      ctx.fillText('CYCLE · LEARNED, NOT ASSUMED', cx, cy - R - 22);

      // mood wave through the ring
      ctx.strokeStyle = 'rgba(' + ac + ',0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      var span = R * 1.7;
      for (var x = -span; x <= span; x += 3) {
        var ph = x / span * Math.PI * 2.2 + tt / 800;
        var y = Math.sin(ph) * R * 0.22 * (1 - Math.abs(x) / (span * 1.25));
        x === -span ? ctx.moveTo(cx + x, cy + y) : ctx.lineTo(cx + x, cy + y);
      }
      ctx.stroke();

      // on-device shield: nothing crosses the boundary ring
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(52,211,153,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, R + 34, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(52,211,153,0.85)';
      ctx.fillText('ON-DEVICE BOUNDARY · 0 CALLS OUT', cx, cy + R + 52);
      ctx.textAlign = 'left';
    });
  }

  /* WAI — papers stream in, link into a graph, and condense into MONDAY REPORT. */
  function sceneKnowledge(canvas) {
    var ac = rgb(accentOf(canvas));
    var rand = rng(23);
    var docs = [];
    for (var i = 0; i < 14; i++) {
      docs.push({ x: rand(), y: rand(), p: rand() * Math.PI * 2 });
    }
    runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      var cx = w * (w < 640 ? 0.5 : 0.68), cy = h * 0.46;
      var R = Math.min(w, h) * 0.34;
      var tt = t === STATIC_T ? 6000 : t;

      var pts = [];
      for (var d = 0; d < docs.length; d++) {
        var o = docs[d];
        var a = o.p + tt / 12000;
        var x = cx + Math.cos(a + d) * R * (0.35 + o.x * 0.65);
        var y = cy + Math.sin(a * 1.3 + d) * R * 0.55 * (0.35 + o.y * 0.65);
        pts.push({ x: x, y: y });
      }
      // citation links between nearby papers
      ctx.lineWidth = 1;
      for (var a2 = 0; a2 < pts.length; a2++) {
        for (var b = a2 + 1; b < pts.length; b++) {
          var dx = pts[a2].x - pts[b].x, dy = pts[a2].y - pts[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > R * 0.55) continue;
          ctx.strokeStyle = 'rgba(' + ac + ',' + (0.3 * (1 - dist / (R * 0.55))).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(pts[a2].x, pts[a2].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
        }
      }
      // papers as little docs
      for (var p = 0; p < pts.length; p++) {
        ctx.fillStyle = 'rgba(' + ac + ',0.8)';
        ctx.fillRect(pts[p].x - 3, pts[p].y - 4, 6, 8);
        ctx.fillStyle = 'rgba(6,6,9,0.9)';
        ctx.fillRect(pts[p].x - 1.5, pts[p].y - 2.5, 3, 1);
        ctx.fillRect(pts[p].x - 1.5, pts[p].y, 3, 1);
      }
      // weekly condensation: pulse that gathers into the report slab
      var f = t === STATIC_T ? 1 : Math.min(1, (tt % 5200) / 4200);
      var ry = cy + R * 0.85;
      ctx.strokeStyle = 'rgba(' + ac + ',0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 58, ry - 13, 116, 26);
      mono(ctx, 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244,244,246,' + (0.35 + 0.6 * f) + ')';
      ctx.fillText('MONDAY REPORT', cx, ry + 3.5);
      ctx.fillStyle = 'rgba(' + ac + ',0.8)';
      ctx.fillText('CITED · SCHEDULED · WEEKLY', cx, ry + 30);
      if (t !== STATIC_T) {
        for (var s = 0; s < 4; s++) {
          var src = pts[(s * 3) % pts.length];
          var ff = Math.max(0, Math.min(1, f * 1.3 - s * 0.08));
          ctx.fillStyle = 'rgba(' + ac + ',' + (0.9 * (1 - ff)) + ')';
          ctx.beginPath();
          ctx.arc(src.x + (cx - src.x) * ff, src.y + (ry - src.y) * ff, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.textAlign = 'left';
    });
  }

  /* CommCoach — live waveform, transcript typing itself, coaching verdicts. */
  function sceneWaveform(canvas) {
    var ac = rgb(accentOf(canvas));
    var LINE = 'PACE 142 WPM · FILLER −60% · CLARITY RISING';
    runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      var tt = t === STATIC_T ? 9000 : t;
      var cx = w * (w < 640 ? 0.5 : 0.66), cy = h * 0.46;
      var span = Math.min(w * 0.42, 300);

      // waveform bars
      var N = 46;
      for (var i = 0; i < N; i++) {
        var x = cx - span + (i / (N - 1)) * span * 2;
        var env = Math.sin((i / (N - 1)) * Math.PI);
        var amp = env * (14 + 34 * Math.abs(Math.sin(tt / 300 + i * 0.55)) * (0.4 + 0.6 * Math.abs(Math.sin(tt / 1400 + i))));
        var head = t !== STATIC_T && Math.abs(i - ((tt / 90) % N)) < 2;
        ctx.fillStyle = head ? 'rgba(244,244,246,0.95)' : 'rgba(' + ac + ',' + (0.35 + env * 0.5) + ')';
        ctx.fillRect(x - 1.6, cy - amp, 3.2, amp * 2);
      }

      // transcript line typing under the wave
      mono(ctx, 11);
      var n = t === STATIC_T ? LINE.length : Math.floor((tt / 70) % (LINE.length + 24));
      var shown = LINE.slice(0, Math.min(LINE.length, n));
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(244,244,246,0.8)';
      ctx.fillText(shown + (n < LINE.length && t !== STATIC_T ? '▏' : ''), cx, cy + 72);
      ctx.fillStyle = 'rgba(' + ac + ',0.8)';
      ctx.fillText('LOCAL TRANSCRIPTION · NOTHING LEAVES THE MACHINE', cx, cy - 68);
      ctx.textAlign = 'left';
    });
  }

  /* Native tooling — menu bar with live dots + a usage gauge sweeping to its cap. */
  function sceneMenubar(canvas) {
    var ac = rgb(accentOf(canvas));
    runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      var tt = t === STATIC_T ? 5200 : t;
      var cx = w * (w < 640 ? 0.5 : 0.68), cy = h * 0.52;

      // the menu bar itself
      var bw = Math.min(w * 0.5, 340), bh = 30;
      var bx = cx - bw / 2, by = cy - 110;
      ctx.fillStyle = 'rgba(16,16,25,0.9)';
      ctx.strokeStyle = 'rgba(' + ac + ',0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 8) : ctx.rect(bx, by, bw, bh);
      ctx.fill(); ctx.stroke();
      // status dots living in it
      var cols = ['52,211,153', '52,211,153', '248,113,113', '52,211,153'];
      mono(ctx, 10);
      for (var i = 0; i < cols.length; i++) {
        var dx = bx + bw - 20 - i * 22;
        var pulse = 0.6 + 0.4 * Math.sin(tt / 600 + i * 1.4);
        ctx.fillStyle = 'rgba(' + cols[i] + ',' + pulse.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(dx, by + bh / 2, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(244,244,246,0.55)';
      ctx.fillText('9:41', bx + 14, by + bh / 2 + 3.5);
      ctx.fillStyle = 'rgba(' + ac + ',0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('FLEET STATUS, ALWAYS IN VIEW', cx, by - 12);

      // usage gauge: fills toward the rolling limit, amber near the cap
      var R = 62, gcy = cy + 42;
      var f = t === STATIC_T ? 0.72 : 0.72 * Math.min(1, tt / 2600) + 0.03 * Math.sin(tt / 900);
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(' + ac + ',0.18)';
      ctx.beginPath(); ctx.arc(cx, gcy, R, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
      var warn = f > 0.65;
      ctx.strokeStyle = warn ? 'rgba(251,191,36,0.9)' : 'rgba(' + ac + ',0.9)';
      ctx.beginPath(); ctx.arc(cx, gcy, R, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * f)); ctx.stroke();
      ctx.lineCap = 'butt';
      mono(ctx, 18);
      ctx.fillStyle = 'rgba(244,244,246,0.95)';
      ctx.fillText(Math.round(f * 100) + '%', cx, gcy + 6);
      mono(ctx, 10);
      ctx.fillStyle = 'rgba(' + ac + ',0.8)';
      ctx.fillText('ROLLING 5-HOUR WINDOW', cx, gcy + R + 26);
      ctx.textAlign = 'left';
    });
  }

  /* =================================================================
     ARCHITECTURE DIAGRAM
     Spec: { vw, vh, groups: [{label,x,y,w,h}], nodes: [{id,label,sub,x,y,w,h,dim}],
            edges: [{from,to,dashed,label}] }  — coords in spec units.
     ================================================================= */

  function archDiagram(canvas) {
    var spec = JSON.parse(document.getElementById(canvas.getAttribute('data-spec')).textContent);
    var ac = rgb(accentOf(canvas));
    var byId = {};
    spec.nodes.forEach(function (n) { byId[n.id] = n; });

    function sxy(w, h) {
      return { x: w / spec.vw, y: h / spec.vh };
    }
    function centre(n, s) {
      return { x: (n.x + n.w / 2) * s.x, y: (n.y + n.h / 2) * s.y };
    }
    /* clip the line from a's centre to b's centre against a's box edge */
    function port(n, s, toward) {
      var c = centre(n, s);
      var dx = toward.x - c.x, dy = toward.y - c.y;
      var hw = n.w * s.x / 2, hh = n.h * s.y / 2;
      var k = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh, 0.0001);
      return { x: c.x + dx * k, y: c.y + dy * k };
    }

    runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      var s = sxy(w, h);
      var small = w < 560;
      var fs = small ? 8.5 : 11, fsSub = small ? 7.5 : 9.5;

      // group boundaries
      (spec.groups || []).forEach(function (g) {
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = 'rgba(' + ac + ',0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(g.x * s.x, g.y * s.y, g.w * s.x, g.h * s.y);
        ctx.setLineDash([]);
        mono(ctx, fsSub);
        ctx.fillStyle = 'rgba(' + ac + ',0.7)';
        ctx.fillText(g.label.toUpperCase(), g.x * s.x + 8, g.y * s.y - 6);
      });

      // edges under nodes
      spec.edges.forEach(function (e, i) {
        var a = byId[e.from], b = byId[e.to];
        var ca = centre(a, s), cb = centre(b, s);
        var p1 = port(a, s, cb), p2 = port(b, s, ca);
        ctx.strokeStyle = 'rgba(' + ac + ',0.45)';
        ctx.lineWidth = 1.2;
        if (e.dashed) ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        ctx.setLineDash([]);
        // arrowhead
        var ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        ctx.fillStyle = 'rgba(' + ac + ',0.8)';
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - 7 * Math.cos(ang - 0.42), p2.y - 7 * Math.sin(ang - 0.42));
        ctx.lineTo(p2.x - 7 * Math.cos(ang + 0.42), p2.y - 7 * Math.sin(ang + 0.42));
        ctx.closePath(); ctx.fill();
        // travelling packet
        if (t !== STATIC_T && !e.dashed) {
          var f = (t / 1800 + i * 0.29) % 1;
          ctx.fillStyle = 'rgba(' + ac + ',0.95)';
          ctx.beginPath();
          ctx.arc(p1.x + (p2.x - p1.x) * f, p1.y + (p2.y - p1.y) * f, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (e.label && !small) {
          mono(ctx, fsSub);
          var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
          var tw = ctx.measureText(e.label).width;
          ctx.fillStyle = 'rgba(6,6,9,0.85)';
          ctx.fillRect(mx - tw / 2 - 4, my - 8, tw + 8, 14);
          ctx.fillStyle = 'rgba(166,166,179,0.95)';
          ctx.textAlign = 'center';
          ctx.fillText(e.label, mx, my + 3);
          ctx.textAlign = 'left';
        }
      });

      // nodes
      spec.nodes.forEach(function (n, i) {
        var x = n.x * s.x, y = n.y * s.y, bw = n.w * s.x, bh = n.h * s.y;
        var glow = t === STATIC_T ? 0.5 : 0.35 + 0.25 * Math.sin(t / 900 + i * 1.3);
        ctx.fillStyle = n.dim ? 'rgba(16,16,25,0.55)' : 'rgba(16,16,25,0.92)';
        ctx.strokeStyle = 'rgba(' + ac + ',' + (n.dim ? 0.3 : glow + 0.25).toFixed(2) + ')';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, bw, bh, 6) : ctx.rect(x, y, bw, bh);
        ctx.fill(); ctx.stroke();
        // corner ticks
        ctx.strokeStyle = 'rgba(' + ac + ',0.9)';
        ctx.lineWidth = 1.5;
        [[x, y, 1, 1], [x + bw, y, -1, 1], [x, y + bh, 1, -1], [x + bw, y + bh, -1, -1]].forEach(function (c) {
          ctx.beginPath();
          ctx.moveTo(c[0] + 6 * c[2], c[1]);
          ctx.lineTo(c[0], c[1]);
          ctx.lineTo(c[0], c[1] + 6 * c[3]);
          ctx.stroke();
        });
        ctx.textAlign = 'center';
        mono(ctx, fs);
        ctx.fillStyle = n.dim ? 'rgba(166,166,179,0.8)' : 'rgba(244,244,246,0.95)';
        ctx.fillText(n.label, x + bw / 2, y + bh / 2 + (n.sub ? -3 : 3.5));
        if (n.sub) {
          mono(ctx, fsSub);
          ctx.fillStyle = 'rgba(' + ac + ',0.75)';
          ctx.fillText(n.sub, x + bw / 2, y + bh / 2 + fsSub + 2);
        }
        ctx.textAlign = 'left';
      });
    });
  }

  /* =================================================================
     BAR CHART — horizontal, animated grow, direct value labels,
     in-canvas hover tooltip. Spec: { unit, items: [{label,value,display,color}] }
     ================================================================= */

  function barChart(canvas) {
    var spec = JSON.parse(document.getElementById(canvas.getAttribute('data-spec')).textContent);
    var ac = accentOf(canvas);
    var max = 0;
    spec.items.forEach(function (it) { max = Math.max(max, it.value); });
    var hover = -1, grown = reduced, g0 = null;

    var handle = runCanvas(canvas, function (ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      var padL = Math.min(w * 0.3, 130), padR = 74, padT = 16, padB = 10;
      var iw = w - padL - padR, ih = h - padT - padB;
      var rowH = ih / spec.items.length;
      var barH = Math.min(18, rowH * 0.44);

      // grow-in eases once, then holds
      var gf = 1;
      if (t !== STATIC_T && !grown) {
        if (g0 === null) g0 = t;
        var p = Math.min(1, (t - g0) / 1100);
        gf = 1 - Math.pow(1 - p, 3);
        if (p >= 1) grown = true;
      }

      // recessive scale gridlines
      ctx.strokeStyle = 'rgba(120,130,170,0.12)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx <= 4; gx++) {
        var x = padL + iw * gx / 4;
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ih); ctx.stroke();
      }

      spec.items.forEach(function (it, i) {
        var y = padT + rowH * i + rowH / 2;
        var bw = iw * (it.value / max) * gf;
        var col = it.color || ac;
        var hovered = hover === i;

        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = hovered ? 'rgba(244,244,246,1)' : 'rgba(166,166,179,0.95)';
        ctx.textAlign = 'right';
        ctx.fillText(it.label, padL - 10, y + 4);

        ctx.fillStyle = col;
        ctx.globalAlpha = hovered ? 1 : 0.85;
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(padL, y - barH / 2, Math.max(bw, 2), barH, [0, 4, 4, 0])
          : ctx.rect(padL, y - barH / 2, Math.max(bw, 2), barH);
        ctx.fill();
        ctx.globalAlpha = 1;

        mono(ctx, 11);
        ctx.textAlign = 'left';
        ctx.fillStyle = hovered ? 'rgba(244,244,246,1)' : 'rgba(166,166,179,0.9)';
        var disp = it.display || (Math.round(it.value * gf) + (spec.unit ? ' ' + spec.unit : ''));
        if (grown || t === STATIC_T) disp = it.display || (it.value + (spec.unit ? ' ' + spec.unit : ''));
        ctx.fillText(disp, padL + Math.max(bw, 2) + 8, y + 4);
      });
    });

    if (!reduced) {
      canvas.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        var padT = 16, padB = 10;
        var rowH = (r.height - padT - padB) / spec.items.length;
        var i = Math.floor((e.clientY - r.top - padT) / rowH);
        var next = (i >= 0 && i < spec.items.length) ? i : -1;
        if (next !== hover) { hover = next; if (handle) handle.redraw(); }
        canvas.style.cursor = next >= 0 ? 'crosshair' : 'default';
      });
      canvas.addEventListener('pointerleave', function () {
        if (hover !== -1) { hover = -1; if (handle) handle.redraw(); }
      });
    }
  }

  /* ================================================================= */

  var SCENES = {
    constellation: sceneConstellation,
    radar: sceneRadar,
    pulse: scenePulse,
    knowledge: sceneKnowledge,
    waveform: sceneWaveform,
    menubar: sceneMenubar
  };

  function init() {
    document.querySelectorAll('canvas.scene[data-scene]').forEach(function (c) {
      var fn = SCENES[c.getAttribute('data-scene')];
      if (fn) fn(c);
    });
    document.querySelectorAll('canvas.arch[data-spec]').forEach(archDiagram);
    document.querySelectorAll('canvas.chart[data-spec]').forEach(barChart);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
