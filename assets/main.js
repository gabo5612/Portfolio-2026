/* Gabriel Arias · Shopify performance
   Three behaviours, no dependencies. Everything on the page is legible
   and usable with this file blocked — JS only refines. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Strings and number formats come from assets/i18n.js, which runs first.
     If it is missing, this fallback keeps the page in the English that the
     markup already ships. */
  var i18n = window.i18n || {
    locale: 'en-US',
    t: function (key, fallback) { return fallback; },
    num: function (n, d) {
      return Number(n).toLocaleString('en-US', {
        minimumFractionDigits: d || 0, maximumFractionDigits: d || 0
      });
    },
    money: function (n) { return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }
  };

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (_, key) { return values[key]; });
  }

  /* ── Sticky header ─────────────────────────────────────
     Transparent over the hero, opaque once past 80px. */

  (function stickyHeader() {
    var header = document.querySelector('[data-header]');
    if (!header) return;

    var scrolled = null;
    function sync() {
      var next = window.scrollY > 80;
      if (next === scrolled) return;
      scrolled = next;
      header.classList.toggle('is-scrolled', next);
    }

    window.addEventListener('scroll', sync, { passive: true });
    sync();
  })();

  /* ── Cursor glow ───────────────────────────────────────
     Moves the ambient orb behind the page with the mouse. The only thing
     this ever writes is `transform` on one absolutely-positioned element
     that nothing else depends on, so a move costs a compositor transform
     and nothing more — no style recalc on the tree, no layout, no paint.

     Three gates before a single listener is bound: the element has to be
     there, the visitor has to have asked for motion, and the device has
     to have a real pointer. A phone fails the third, which is why this
     costs a mobile visit exactly nothing. */

  (function cursorGlow() {
    var orb = document.querySelector('[data-glow]');
    if (!orb) return;
    if (reduceMotion.matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var x = 0, y = 0, queued = false, live = false;

    function paint() {
      queued = false;
      orb.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      if (!live) { live = true; orb.classList.add('is-live'); }
    }

    /* One frame per frame. pointermove fires far faster than the display
       refreshes, and without this the same transform would be written
       three or four times between two paints. */
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });

    // Pointer out of the window: fade out rather than freeze at the edge.
    document.addEventListener('mouseleave', function () {
      live = false;
      orb.classList.remove('is-live');
    });
  })();

  /* ── Load filmstrip ────────────────────────────────────
     Scrubber value is tenths of a second, 0–4.5s. A frame's block
     appears once the clock passes its milestone. */

  (function filmstrip() {
    var scrub = document.querySelector('[data-scrub]');
    var play = document.querySelector('[data-play]');
    if (!scrub) return;

    var times = document.querySelectorAll('[data-time]');
    var frames = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-frame]'), function (el) {
      frames[el.getAttribute('data-frame')] = el;
    });

    // Milestones in seconds: header, hero, product grid.
    var BEFORE = [2.4, 3.4, 4.4];
    var AFTER = [0.3, 0.8, 1.4];
    var timer = null;

    function render() {
      var t = Number(scrub.value) / 10;

      Array.prototype.forEach.call(times, function (el) {
        el.textContent = i18n.num(t, 1) + 's';
      });

      set('bHeader', t >= BEFORE[0]); set('bHero', t >= BEFORE[1]); set('bGrid', t >= BEFORE[2]);
      set('aHeader', t >= AFTER[0]);  set('aHero', t >= AFTER[1]);  set('aGrid', t >= AFTER[2]);
    }

    function set(key, visible) {
      if (frames[key]) frames[key].style.opacity = visible ? '1' : '0';
    }

    scrub.addEventListener('input', render);
    document.addEventListener('i18n:change', render);   // the clock is decimal-comma in Spanish

    if (play) {
      play.addEventListener('click', function () {
        if (timer) clearInterval(timer);

        // Reduced motion still gets the answer, just not the animation.
        if (reduceMotion.matches) {
          scrub.value = scrub.max;
          render();
          return;
        }

        scrub.value = 0;
        render();
        timer = setInterval(function () {
          var next = Number(scrub.value) + 1;
          if (next >= Number(scrub.max)) {
            clearInterval(timer);
            timer = null;
            next = Number(scrub.max);
          }
          scrub.value = next;
          render();
        }, 90);
      });
    }

    render();
  })();

  /* ── Revenue leak calculator ───────────────────────────
     Every second above the 2.5s LCP target costs 8% of conversion
     (0.8% per 100ms). The formula is printed on the page on purpose:
     the visitor's own developer should be able to check it. */

  (function calculator() {
    var revenueInput = document.querySelector('[data-revenue]');
    var lcpInput = document.querySelector('[data-lcp]');
    var leakOut = document.querySelector('[data-leak]');
    var formulaOut = document.querySelector('[data-formula]');
    var cta = document.querySelector('[data-leak-cta]');
    if (!revenueInput || !lcpInput || !leakOut) return;

    var TARGET_LCP = 2.5;   // seconds — Core Web Vitals "good" threshold
    var LOSS_PER_S = 8;     // percent of conversion per extra second
    var MAX_LOSS = 45;      // cap, past which the estimate is not credible

    function render() {
      var revenue = Number(revenueInput.value) || 0;
      var lcp = Number(lcpInput.value) || 0;
      var over = Math.max(0, lcp - TARGET_LCP);
      var lossPct = Math.min(MAX_LOSS, over * LOSS_PER_S);
      var leak = over > 0 ? revenue * lossPct / 100 : 0;
      var amount = i18n.money(leak);

      leakOut.textContent = amount;

      if (formulaOut) {
        /* Once the cap bites — anything past an 8.1s LCP — it has to appear
           in the equation. Without it the formula printed under the figure
           does not evaluate to the figure, on exactly the slow stores this
           page is addressed to. Mirrored in audit-engine/src/money.js. */
        var key = over * LOSS_PER_S > MAX_LOSS ? 'calc.formulaCapped' : 'calc.formula';
        var fallback = over * LOSS_PER_S > MAX_LOSS
          ? '{revenue} × min({max}%, ({lcp}s − {target}s) × {loss}%/s) = {leak}/mo'
          : '{revenue} × ({lcp}s − {target}s) × {loss}%/s = {leak}/mo';

        formulaOut.textContent = fill(i18n.t(key, fallback), {
          revenue: i18n.money(revenue),
          lcp: i18n.num(lcp, 1),
          target: i18n.num(TARGET_LCP, 1),
          loss: LOSS_PER_S,
          max: MAX_LOSS,
          leak: amount
        });
      }
      if (cta) {
        cta.textContent = fill(i18n.t('calc.cta', 'Find {leak} in 48 hours →'), { leak: amount });
      }
    }

    revenueInput.addEventListener('input', render);
    lcpInput.addEventListener('input', render);
    document.addEventListener('i18n:change', render);
    render();
  })();
})();
