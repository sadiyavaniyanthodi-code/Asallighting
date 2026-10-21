(function () {
  "use strict";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function smooth(value) {
    value = clamp(value, 0, 1);
    return value * value * (3 - 2 * value);
  }

  /* =========================================
     LUXURY CHANDELIER ANIMATION
     Wider appearance, same height,
     soft warm glow and natural movement.
  ========================================= */

  (function chandelierAnimation() {
    var canvas = document.getElementById("lights");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var image = new Image();

    var width = 0;
    var height = 0;
    var pixelRatio = 1;
    var frame = null;
    var startTime = 0;
    var imageReady = false;

    var sparkles = Array.from({ length: 18 }, function (_, index) {
      return {
        x: 0.12 + ((index * 37) % 76) / 100,
        y: 0.20 + ((index * 23) % 62) / 100,
        size: 2.5 + (index % 4) * 1.2,
        phase: index * 1.73,
        speed: 0.55 + (index % 5) * 0.12,
        rotation: (index % 4) * Math.PI / 4
      };
    });

    function resizeCanvas() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      width = canvas.clientWidth;
      height = canvas.clientHeight;

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      if (imageReady && reduceMotion) {
        draw(8);
      }
    }

    /* Soft, single-layer golden illumination */

    function drawGlow(x, y, glowWidth, glowHeight, alpha) {
      ctx.save();

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;

      var radius = Math.max(glowWidth, glowHeight) / 2;

      var gradient = ctx.createRadialGradient(
        x, y, 0,
        x, y, radius
      );

      gradient.addColorStop(0, "rgba(255, 235, 190, 0.22)");
      gradient.addColorStop(0.25, "rgba(255, 208, 126, 0.13)");
      gradient.addColorStop(0.55, "rgba(255, 174, 76, 0.035)");
      gradient.addColorStop(1, "rgba(255, 160, 50, 0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(
        x - glowWidth / 2,
        y - glowHeight / 2,
        glowWidth,
        glowHeight
      );

      ctx.restore();
    }

    /* Small four-point crystal sparkle */

    function drawSparkle(x, y, size, alpha, rotation) {
      ctx.save();

      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;

      var gradient = ctx.createLinearGradient(-size, 0, size, 0);

      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.5, "rgba(255,249,222,0.95)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(-size, -0.55, size * 2, 1.1);
      ctx.fillRect(-0.55, -size, 1.1, size * 2);

      ctx.restore();
    }

    /* Draw the chandelier */

    function draw(seconds) {
      ctx.clearRect(0, 0, width, height);

      if (!imageReady || !width || !height) return;

      var imageRatio = image.naturalWidth / image.naturalHeight;

      /*
       * Preserve the original vertical size.
       * Widen the chandelier horizontally only.
       */
      var drawHeight = height * 0.98;
      var originalDrawWidth = drawHeight * imageRatio;

      var drawWidth = Math.min(
        width * 1.42,
        originalDrawWidth * 1.42
      );

      var horizontalStretch = drawWidth / originalDrawWidth;

      var entrance = reduceMotion
        ? 1
        : easeOutCubic(clamp(seconds / 2.8, 0, 1));

      var lightIn = reduceMotion
        ? 1
        : smooth((seconds - 0.8) / 2.5);

      /* Very subtle hanging movement */

      var sway = reduceMotion
        ? 0
        : (
            Math.sin(seconds * 0.48) * 0.0032 +
            Math.sin(seconds * 0.79) * 0.0012
          ) * entrance;

      /* Gentle natural brightness breathing */

      var pulse = reduceMotion
        ? 1
        : 0.97 + 0.03 * Math.sin(seconds * 0.82 + 0.6);

      var opacity = 0.12 + 0.88 * entrance;

      var top = height * 0.012 -
        drawHeight * 0.82 * (1 - entrance);

      var centerX = width / 2;
      var centerY = top + drawHeight * 0.52;

      /* One soft glow instead of overlapping gold shadows */

      drawGlow(
        centerX,
        centerY,
        Math.min(width * 0.95, drawWidth * 1.12),
        drawHeight * 0.85,
        0.22 * lightIn * pulse
      );

      /* Main chandelier image */

      ctx.save();

      ctx.translate(centerX, top + drawHeight / 2);
      ctx.rotate(sway);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = opacity;

      /*
       * Stretch horizontally while keeping height unchanged.
       * This draws the original image only once.
       */
      ctx.drawImage(
        image,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );

      ctx.restore();

      /* Crystal glints */

      if (!reduceMotion && lightIn > 0.15) {
        sparkles.forEach(function (sparkle) {
          var wave = Math.sin(
            seconds * sparkle.speed + sparkle.phase
          );

          if (wave < 0.82) return;

          var sparkleAlpha =
            ((wave - 0.82) / 0.18) * 0.24 * lightIn;

          drawSparkle(
            centerX + (sparkle.x - 0.5) * drawWidth,
            top + sparkle.y * drawHeight,
            sparkle.size,
            sparkleAlpha,
            sparkle.rotation
          );
        });
      }
    }

    /* Animation loop */

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;

      draw((timestamp - startTime) / 1000);
      frame = window.requestAnimationFrame(animate);
    }

    function startAnimation() {
      if (!imageReady || reduceMotion || frame !== null) return;

      startTime = performance.now() - 50;
      frame = window.requestAnimationFrame(animate);
    }

    function stopAnimation() {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    }

    /* Load the supplied chandelier image */

    image.onload = function () {
      imageReady = true;
      resizeCanvas();

      if (reduceMotion) {
        draw(8);
      } else {
        startAnimation();
      }
    };

    image.onerror = function () {
      console.error(
        "Could not load chandelier.webp. " +
        "Make sure chandelier.webp is in the same folder as index.html."
      );
    };

    image.src = "chandelier.webp";

    resizeCanvas();

    window.addEventListener("resize", resizeCanvas);

    document.addEventListener("visibilitychange", function () {
      if (reduceMotion) return;

      if (document.hidden) {
        stopAnimation();
      } else {
        startAnimation();
      }
    });
  })();


  /* =========================================
     FLOATING GOLDEN DUST
  ========================================= */

  (function goldenDust() {
    var canvas = document.getElementById("dust");
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext("2d");
    var particles = [];

    var width = 0;
    var height = 0;
    var pixelRatio = 1;
    var frame = null;

    function random(min, max) {
      return min + Math.random() * (max - min);
    }

    function makeParticle(anywhere) {
      return {
        x: random(0, width),
        y: anywhere ? random(0, height) : height + 18,
        radius: random(0.8, 2.2),
        speed: random(0.07, 0.20),
        drift: random(-0.07, 0.07),
        alpha: random(0.06, 0.19),
        phase: random(0, Math.PI * 2),
        twinkleSpeed: random(0.6, 1.25)
      };
    }

    function resize() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      var count = clamp(Math.round(width / 55), 10, 26);

      particles = [];

      for (var i = 0; i < count; i++) {
        particles.push(makeParticle(true));
      }
    }

    function draw(time) {
      ctx.clearRect(0, 0, width, height);

      particles.forEach(function (particle, index) {
        var twinkle = reduceMotion
          ? 1
          : 0.68 + 0.32 * Math.sin(
              time * 0.001 * particle.twinkleSpeed + particle.phase
            );

        var alpha = particle.alpha * twinkle;

        var gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.radius * 3.2
        );

        gradient.addColorStop(
          0,
          "rgba(255,232,169," + alpha.toFixed(3) + ")"
        );

        gradient.addColorStop(
          0.5,
          "rgba(255,204,112," + (alpha * 0.35).toFixed(3) + ")"
        );

        gradient.addColorStop(1, "rgba(255,190,80,0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();

        ctx.arc(
          particle.x,
          particle.y,
          particle.radius * 3.2,
          0,
          Math.PI * 2
        );

        ctx.fill();

        if (!reduceMotion) {
          particle.y -= particle.speed;
          particle.x += particle.drift;

          if (
            particle.y < -20 ||
            particle.x < -20 ||
            particle.x > width + 20
          ) {
            particles[index] = makeParticle(false);
          }
        }
      });
    }

    function animateDust(timestamp) {
      draw(timestamp);
      frame = window.requestAnimationFrame(animateDust);
    }

    function startDust() {
      if (reduceMotion || frame !== null) return;
      frame = window.requestAnimationFrame(animateDust);
    }

    function stopDust() {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    }

    resize();
    draw(0);
    startDust();

    window.addEventListener("resize", function () {
      resize();

      if (reduceMotion) draw(0);
    });

    document.addEventListener("visibilitychange", function () {
      if (reduceMotion) return;

      if (document.hidden) {
        stopDust();
      } else {
        startDust();
      }
    });
  })();


  /* =========================================
     SCROLL REVEAL
  ========================================= */

  (function scrollReveal() {
    var elements = document.querySelectorAll(".details, .footer");

    if (!elements.length) return;

    if (
      reduceMotion ||
      !("IntersectionObserver" in window)
    ) {
      elements.forEach(function (element) {
        element.classList.add("is-visible");
      });

      return;
    }

    elements.forEach(function (element) {
      element.classList.add("scroll-reveal");
    });

    var observer = new IntersectionObserver(
      function (entries, currentObserver) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -30px 0px"
      }
    );

    elements.forEach(function (element) {
      observer.observe(element);
    });
  })();

})();