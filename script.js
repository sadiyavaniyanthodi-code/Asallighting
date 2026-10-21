(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function smooth(x) { return x * x * (3 - 2 * x); }

  // small seeded random generator so every visit draws the same chandeliers
  function mulberry(seed) {
    var a = seed;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ==================================================================
     1. A wall of crystal chandeliers.
        Each design is painted once onto an offscreen sprite (gold metalwork,
        crystal garlands and drops). Every frame then only moves the sprite and
        adds light on top: candle glows, room glow and crystal sparkles.
     ================================================================== */
  (function chandelierWall() {
    var canvas = document.getElementById("lights");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");

    /* ---------- soft light sprites ---------- */

    function makeGlow(rgb) {
      var c = document.createElement("canvas");
      c.width = c.height = 128;
      var x = c.getContext("2d");
      var col = rgb.join(",");
      var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.1, "rgba(" + col + ",0.85)");
      g.addColorStop(0.32, "rgba(" + col + ",0.26)");
      g.addColorStop(0.65, "rgba(" + col + ",0.06)");
      g.addColorStop(1, "rgba(" + col + ",0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      return c;
    }

    function makeStar() {
      var m = 48;
      var c = document.createElement("canvas");
      c.width = c.height = m * 2;
      var x = c.getContext("2d");
      var g = x.createRadialGradient(m, m, 0, m, m, 15);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, m * 2, m * 2);
      [0, Math.PI / 2].forEach(function (a) {
        x.save();
        x.translate(m, m);
        x.rotate(a);
        var lg = x.createLinearGradient(-m, 0, m, 0);
        lg.addColorStop(0, "rgba(255,255,255,0)");
        lg.addColorStop(0.5, "rgba(255,255,255,0.95)");
        lg.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = lg;
        x.fillRect(-m, -0.9, m * 2, 1.8);
        x.restore();
      });
      return c;
    }

    var glows = [makeGlow([255, 214, 140]), makeGlow([255, 196, 150])];
    var star = makeStar();

    /* ---------- one chandelier, painted in "design units" ---------- */

    var SPRITE_SCALE = 2.4, WU = 440, HU = 430, OX = 220, OY = 12;

    function buildChandelier(cfg) {
      var cv = document.createElement("canvas");
      cv.width = Math.round(WU * SPRITE_SCALE);
      cv.height = Math.round(HU * SPRITE_SCALE);
      var g = cv.getContext("2d");
      g.scale(SPRITE_SCALE, SPRITE_SCALE);
      g.translate(OX, OY);

      var rnd = mulberry(cfg.seed);
      var flames = [];
      var sparks = [];

      function goldH(cx, r) {
        var gr = g.createLinearGradient(cx - r, 0, cx + r, 0);
        gr.addColorStop(0, "#3e2706");
        gr.addColorStop(0.2, "#b98a2a");
        gr.addColorStop(0.42, "#fff0b8");
        gr.addColorStop(0.62, "#d9ad45");
        gr.addColorStop(1, "#35210a");
        return gr;
      }

      // a gold rod: dark edge, gold body, light core
      function tube(w, build) {
        g.lineCap = "round";
        g.lineJoin = "round";
        g.strokeStyle = "#2a1a04";
        g.lineWidth = w + 1.8;
        g.beginPath(); build(); g.stroke();
        g.strokeStyle = "#cfa036";
        g.lineWidth = w;
        g.beginPath(); build(); g.stroke();
        g.strokeStyle = "rgba(255,240,180,0.75)";
        g.lineWidth = w * 0.32;
        g.beginPath(); build(); g.stroke();
      }

      // a turned metal piece from a list of [y, radius] points
      function lathe(pts, maxR) {
        var n = pts.length, i;
        g.beginPath();
        g.moveTo(pts[0][1], pts[0][0]);
        for (i = 1; i < n - 1; i++) {
          g.quadraticCurveTo(pts[i][1], pts[i][0], (pts[i][1] + pts[i + 1][1]) / 2, (pts[i][0] + pts[i + 1][0]) / 2);
        }
        g.lineTo(pts[n - 1][1], pts[n - 1][0]);
        g.lineTo(-pts[n - 1][1], pts[n - 1][0]);
        for (i = n - 2; i >= 1; i--) {
          g.quadraticCurveTo(-pts[i][1], pts[i][0], -(pts[i][1] + pts[i - 1][1]) / 2, (pts[i][0] + pts[i - 1][0]) / 2);
        }
        g.lineTo(-pts[0][1], pts[0][0]);
        g.closePath();
        g.fillStyle = goldH(0, maxR);
        g.fill();
        g.strokeStyle = "rgba(40,25,5,0.85)";
        g.lineWidth = 0.7;
        g.stroke();
      }

      function bead(x, y, r) {
        var gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
        gr.addColorStop(0, "rgba(255,255,255,1)");
        gr.addColorStop(0.55, "rgba(228,238,255,0.8)");
        gr.addColorStop(1, "rgba(255,224,160,0.7)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, r, 0, 6.2832);
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.65)";
        g.lineWidth = 0.35;
        g.stroke();
      }

      // a faceted pendant crystal hanging from (x, y)
      function drop(x, y, w, l) {
        g.strokeStyle = "#c9992f";
        g.lineWidth = 0.7;
        g.beginPath();
        g.arc(x, y + 1.3, 1.3, 0, 6.2832);
        g.stroke();
        var t = y + 2.6;
        var gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        gr.addColorStop(0, "rgba(255,255,255,0.95)");
        gr.addColorStop(0.45, "rgba(196,222,255,0.42)");
        gr.addColorStop(1, "rgba(255,238,200,0.88)");
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x, t);
        g.lineTo(x + w * 0.5, t + l * 0.3);
        g.lineTo(x + w * 0.38, t + l * 0.7);
        g.lineTo(x, t + l);
        g.lineTo(x - w * 0.38, t + l * 0.7);
        g.lineTo(x - w * 0.5, t + l * 0.3);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.85)";
        g.lineWidth = 0.45;
        g.stroke();
        g.strokeStyle = "rgba(255,255,255,0.5)";
        g.lineWidth = 0.35;
        g.beginPath();
        g.moveTo(x, t); g.lineTo(x, t + l);
        g.moveTo(x - w * 0.5, t + l * 0.3); g.lineTo(x, t + l * 0.7); g.lineTo(x + w * 0.5, t + l * 0.3);
        g.stroke();
        if (w >= 6) sparks.push({ x: x, y: t + l * 0.45, r: w * 0.6, phase: rnd() * 6.28, speed: 0.8 + rnd() * 1.6 });
      }

      // a swag of crystal beads between two points, with drops hanging from it
      function garland(x1, y1, x2, y2, sag, spacing, dropEvery, dropMin, dropMax) {
        var cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 + sag * 2;
        g.strokeStyle = "rgba(214,170,70,0.9)";
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(x1, y1);
        g.quadraticCurveTo(cx, cy, x2, y2);
        g.stroke();
        var n = Math.max(3, Math.round((Math.hypot(x2 - x1, y2 - y1) + sag * 1.5) / spacing));
        for (var i = 1; i < n; i++) {
          var u = i / n, q = 1 - u;
          var bx = q * q * x1 + 2 * q * u * cx + u * u * x2;
          var by = q * q * y1 + 2 * q * u * cy + u * u * y2;
          bead(bx, by, 2.1);
          if (dropEvery && i % dropEvery === 0) {
            drop(bx, by + 1.5, 6.5 + rnd() * 2.5, dropMin + rnd() * (dropMax - dropMin));
          }
        }
      }

      // a vertical string of beads ending in a crystal drop
      function strand(x, y, count, dropW, dropL) {
        var yy = y;
        for (var i = 0; i < count; i++) { bead(x, yy, 2.1); yy += 6.5; }
        drop(x, yy - 2, dropW, dropL);
      }

      var tiers = cfg.tiers;
      var tips = [];

      // 1. arms
      tiers.forEach(function (tr, ti) {
        tips[ti] = { left: [], right: [] };
        [-1, 1].forEach(function (sgn) {
          tr.xs.forEach(function (xj, j) {
            var dx = xj - 10;
            var dep = 34 + j * 9;
            var tipY = tr.y + dep - 22;
            tube(j === tr.xs.length - 1 ? 3.6 : 4.2, function () {
              g.moveTo(sgn * 10, tr.y);
              g.bezierCurveTo(sgn * (10 + dx * 0.6), tr.y + dep * 1.05, sgn * xj, tr.y + dep + 4, sgn * xj, tipY);
            });
            (sgn < 0 ? tips[ti].left : tips[ti].right).push({ x: sgn * xj, y: tipY });
          });
        });
      });

      // 2. central stem
      var lastY = tiers[tiers.length - 1].y;
      var yEnd = lastY + 70;
      lathe([[0, 7], [2, 20], [7, 28], [12, 22], [15, 12], [18, 6]], 28);
      var pts = [[18, 6], [34, 9], [46, 7]];
      tiers.forEach(function (tr, ti) {
        pts.push([tr.y - 10, 7], [tr.y - 5, 15], [tr.y, 17], [tr.y + 5, 15], [tr.y + 10, 7]);
        if (ti < tiers.length - 1) {
          var mid = (tr.y + tiers[ti + 1].y) / 2;
          pts.push([mid - 12, 6], [mid, 11], [mid + 12, 6]);
        }
      });
      pts.push([yEnd - 14, 7], [yEnd - 6, 16], [yEnd + 4, 12], [yEnd + 14, 5], [yEnd + 22, 2]);
      pts.sort(function (a, b) { return a[0] - b[0]; });
      lathe(pts, 18);

      // 3. crystal garlands and strands
      tiers.forEach(function (tr, ti) {
        var row = tips[ti].left.slice().reverse().concat(tips[ti].right);
        for (var i = 0; i < row.length - 1; i++) {
          var a = row[i], b = row[i + 1];
          var centre = Math.abs(a.x + b.x) < 1;
          garland(a.x, a.y, b.x, b.y, centre ? 18 : 9 + Math.abs(b.x - a.x) * 0.1, 6.5, 2, 12, 20);
        }
        if (ti < tiers.length - 1) {
          var lo = tips[ti].left[tips[ti].left.length - 1], ln = tips[ti + 1].left[tips[ti + 1].left.length - 1];
          var ro = tips[ti].right[tips[ti].right.length - 1], rn = tips[ti + 1].right[tips[ti + 1].right.length - 1];
          garland(lo.x, lo.y, ln.x, ln.y, 6, 6.5, 2, 10, 16);
          garland(ro.x, ro.y, rn.x, rn.y, 6, 6.5, 2, 10, 16);
        }
      });
      var bottomTips = tips[tips.length - 1];
      bottomTips.left.concat(bottomTips.right).forEach(function (tp, i) {
        if (Math.abs(tp.x) > 70) strand(tp.x, tp.y + 6, 3 + (i % 2), 8, 24);
      });

      // 4. candle cups, candles and glass flames
      tiers.forEach(function (tr, ti) {
        tips[ti].left.concat(tips[ti].right).forEach(function (tp) {
          var x = tp.x, y = tp.y;
          // drip tray and socket
          g.fillStyle = goldH(x, 10);
          g.beginPath();
          g.moveTo(x - 3.2, y + 5); g.lineTo(x - 9, y - 3); g.lineTo(x + 9, y - 3); g.lineTo(x + 3.2, y + 5);
          g.closePath();
          g.fill();
          g.strokeStyle = "rgba(40,25,5,0.85)";
          g.lineWidth = 0.6;
          g.stroke();
          g.fillStyle = goldH(x, 5);
          g.fillRect(x - 4, y - 14, 8, 11);
          // candle
          var cg = g.createLinearGradient(x - 3, 0, x + 3, 0);
          cg.addColorStop(0, "#cfc2a2"); cg.addColorStop(0.5, "#fffaf0"); cg.addColorStop(1, "#c9bc9a");
          g.fillStyle = cg;
          g.fillRect(x - 3, y - 26, 6, 13);
          // glass flame
          g.fillStyle = "rgba(255,236,190,0.35)";
          g.strokeStyle = "rgba(255,255,255,0.6)";
          g.lineWidth = 0.5;
          g.beginPath();
          g.moveTo(x, y - 46);
          g.bezierCurveTo(x + 7, y - 36, x + 6, y - 27, x, y - 26);
          g.bezierCurveTo(x - 6, y - 27, x - 7, y - 36, x, y - 46);
          g.closePath();
          g.fill();
          g.stroke();
          flames.push({ x: x, y: y - 35, ph: rnd() * 6.28 });
        });
      });

      // 5. bottom pendant
      var py = yEnd + 22;
      bead(0, py + 3, 3);
      [-26, -13, 13, 26].forEach(function (dx, i) {
        garland(0, py + 4, dx, py + 12, 3, 6, 0, 0, 0);
        drop(dx, py + 11, 7, 20 + (i % 2) * 6);
      });
      var big = g.createLinearGradient(-26, 0, 26, 0);
      big.addColorStop(0, "rgba(255,255,255,0.95)");
      big.addColorStop(0.45, "rgba(190,218,255,0.45)");
      big.addColorStop(1, "rgba(255,238,200,0.9)");
      var by = py + 8;
      g.fillStyle = big;
      g.beginPath();
      g.moveTo(0, by); g.lineTo(22, by + 22); g.lineTo(26, by + 42); g.lineTo(12, by + 72); g.lineTo(0, by + 92);
      g.lineTo(-12, by + 72); g.lineTo(-26, by + 42); g.lineTo(-22, by + 22);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 0.7;
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 0.45;
      g.beginPath();
      g.moveTo(0, by); g.lineTo(0, by + 92);
      g.moveTo(-22, by + 22); g.lineTo(0, by + 42); g.lineTo(22, by + 22);
      g.moveTo(-26, by + 42); g.lineTo(0, by + 42); g.lineTo(26, by + 42);
      g.moveTo(-12, by + 72); g.lineTo(0, by + 42); g.lineTo(12, by + 72);
      g.stroke();
      sparks.push({ x: -6, y: by + 34, r: 12, phase: 1.2, speed: 1.1 }, { x: 8, y: by + 56, r: 9, phase: 3.4, speed: 1.6 });

      return { canvas: cv, w: WU, h: HU, ox: OX, oy: OY, flames: flames, sparks: sparks.slice(0, 46), bodyH: by + 96 };
    }

    var designA = buildChandelier({
      seed: 21,
      tiers: [
        { y: 78, xs: [58, 100] },
        { y: 140, xs: [54, 100, 146] },
        { y: 204, xs: [58, 110, 168] }
      ]
    });
    var designB = buildChandelier({
      seed: 57,
      tiers: [
        { y: 78, xs: [56, 98] },
        { y: 140, xs: [52, 96, 140] }
      ]
    });

    /* ---------- the wall: three depth rows ---------- */

    var W = 0, H = 0, insts = [], frame = null, t0 = 0;

    function layout() {
      var rnd = mulberry(11);
      var small = W < 600;
      var base = Math.min((H * 0.8) / designA.bodyH, W / (small ? 400 : 560));
      insts = [];

      function add(design, u, scale, cord, alpha, delay) {
        insts.push({
          design: design,
          x: u * W,
          scale: scale,
          cord: cord,
          alpha: alpha,
          delay: delay,
          phase: rnd() * 6.28,
          tint: rnd() < 0.5 ? 0 : 1
        });
      }

      // back row: many small, dim, hanging lower
      var nb = small ? 5 : clamp(Math.round(W / 140), 6, 11);
      for (var i = 0; i < nb; i++) {
        var ub = (i + 0.5) / nb + (rnd() - 0.5) * (0.4 / nb);
        add(designB, ub, base * (0.34 + rnd() * 0.1), H * (0.16 + rnd() * 0.14), 0.5, 0.7 + Math.abs(ub - 0.5) * 1.1 + rnd() * 0.2);
      }

      // middle row
      var mids = small ? [0.09, 0.91] : [];
      if (!small) {
        var nm = clamp(Math.round(W / 320), 3, 5);
        for (var m = 0; m < nm; m++) mids.push((m + 0.5) / nm);
      }
      mids.forEach(function (um, k) {
        add(k % 2 ? designB : designA, um, base * 0.62, H * (0.06 + rnd() * 0.05), 0.78, 0.45 + Math.abs(um - 0.5) * 1.1);
      });

      // front row
      if (small) {
        add(designA, 0.5, base, 0, 1, 0.2);
      } else {
        add(designA, 0.17, base * 0.8, H * 0.04, 1, 0.45);
        add(designA, 0.83, base * 0.8, H * 0.04, 1, 0.45);
        add(designA, 0.5, base, 0, 1, 0.2);
      }
    }

    function resize() {
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * ratio);
      canvas.height = Math.round(H * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      layout();
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      for (var k = 0; k < insts.length; k++) {
        var q = insts[k], d = q.design, s = q.scale;
        var p = easeOutCubic(clamp((t - q.delay) / 2.3, 0, 1));
        if (p <= 0) continue;

        var bodyPx = d.h * s;
        var anchorY = -bodyPx + (q.cord + bodyPx) * p;
        var L = clamp((t - q.delay - 1.9) / 1.5, 0, 1);
        var le = smooth(L);
        var flick = L < 1 ? 1 + 0.35 * (1 - L) * Math.sin(L * 38 + q.phase) : 1;
        var sway = Math.sin(t * 0.5 + q.phase) * 0.009 * p;

        ctx.save();
        ctx.translate(q.x, 0);
        ctx.rotate(sway);

        // the chain
        if (anchorY > 0) {
          ctx.globalAlpha = q.alpha * (0.45 + 0.55 * le);
          ctx.strokeStyle = "#caa24a";
          ctx.lineWidth = Math.max(1, 2.4 * s);
          ctx.setLineDash([5 * s + 1, 2.5 * s + 1]);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, anchorY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.translate(0, anchorY);
        ctx.scale(s, s);

        // the chandelier body, dim until lit
        ctx.globalAlpha = q.alpha * (0.3 + 0.7 * le);
        ctx.drawImage(d.canvas, -d.ox, -d.oy, d.w, d.h);

        // the light
        ctx.globalCompositeOperation = "lighter";
        var glow = glows[q.tint];

        ctx.globalAlpha = Math.min(1, 0.2 * le * q.alpha * flick);
        ctx.drawImage(glow, -300, 190 - 300, 600, 600);

        var i, f, a;
        for (i = 0; i < d.flames.length; i++) {
          f = d.flames[i];
          a = le * q.alpha * flick * (1 + 0.12 * Math.sin(t * 9 + f.ph * 7) + 0.06 * Math.sin(t * 23 + f.ph));
          ctx.globalAlpha = clamp(a * 0.9, 0, 1);
          ctx.drawImage(glow, f.x - 24, f.y - 24, 48, 48);
          ctx.globalAlpha = clamp(a, 0, 1);
          ctx.drawImage(glow, f.x - 6, f.y - 8, 12, 16);
        }

        for (i = 0; i < d.sparks.length; i++) {
          f = d.sparks[i];
          var tw = Math.sin(t * f.speed + f.phase);
          if (tw > 0.55) {
            a = Math.pow((tw - 0.55) / 0.45, 2) * le * q.alpha;
            var r = f.r * 3.2;
            ctx.globalAlpha = clamp(a, 0, 1);
            ctx.drawImage(star, f.x - r, f.y - r, r * 2, r * 2);
          }
        }

        ctx.restore();
      }
    }

    function loop(now) {
      draw((now - t0) / 1000);
      frame = window.requestAnimationFrame(loop);
    }

    function start() {
      if (frame !== null || reduceMotion) return;
      frame = window.requestAnimationFrame(loop);
    }

    function stop() {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    }

    resize();
    t0 = performance.now() - 200;
    if (reduceMotion) draw(100);
    else start();

    window.addEventListener("resize", function () {
      resize();
      if (reduceMotion) draw(100);
    });

    document.addEventListener("visibilitychange", function () {
      if (reduceMotion) return;
      if (document.hidden) {
        stop();
      } else {
        // resume with everything already lit, so nothing replays
        if ((performance.now() - t0) / 1000 < 10) t0 = performance.now() - 10000;
        start();
      }
    });
  })();

  /* ==================================================================
     2. Faint golden dust drifting behind the whole page.
     ================================================================== */
  (function dust() {
    var canvas = document.getElementById("dust");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var particles = [];
    var width = 0, height = 0, frame = null;

    function rand(min, max) { return min + Math.random() * (max - min); }

    function make(anywhere) {
      return {
        x: rand(0, width),
        y: anywhere ? rand(0, height) : height + 20,
        r: rand(1.2, 5),
        speed: rand(0.1, 0.34),
        drift: rand(-0.1, 0.1),
        alpha: rand(0.1, 0.4),
        phase: rand(0, 6.28),
        twinkle: rand(0.6, 1.6)
      };
    }

    function resize() {
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      var count = clamp(Math.round(width / 34), 16, 38);
      particles = [];
      for (var i = 0; i < count; i++) particles.push(make(true));
    }

    function draw(time) {
      ctx.clearRect(0, 0, width, height);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var a = p.alpha * (0.65 + 0.35 * Math.sin(time * 0.001 * p.twinkle + p.phase));
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        g.addColorStop(0, "rgba(255,230,150," + a.toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,210,90,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, 6.2832);
        ctx.fill();

        if (!reduceMotion) {
          p.y -= p.speed;
          p.x += p.drift;
          if (p.y < -20 || p.x < -20 || p.x > width + 20) particles[i] = make(false);
        }
      }
    }

    function loop(time) {
      draw(time);
      frame = window.requestAnimationFrame(loop);
    }

    resize();
    draw(0);
    if (!reduceMotion) frame = window.requestAnimationFrame(loop);

    window.addEventListener("resize", function () {
      resize();
      if (reduceMotion) draw(0);
    });

    document.addEventListener("visibilitychange", function () {
      if (reduceMotion) return;
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = null;
      } else if (frame === null) {
        frame = window.requestAnimationFrame(loop);
      }
    });
  })();
})();