/* ============================================================
   SoulTrip Travel and Tours Ltd — main.js
   Nav scroll state · mobile menu · scroll reveal ·
   enquiry-type preselect · Formspree submit
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Scroll helper (nav-offset aware, avoids scrollIntoView) ---------- */
  function scrollToEl(el, extraOffset) {
    if (!el) return;
    var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h"), 10) || 80;
    var top = window.pageYOffset + el.getBoundingClientRect().top - navH - (extraOffset || 16);
    window.scrollTo({ top: top, behavior: prefersReduced ? "auto" : "smooth" });
  }

  /* ---------- Sticky nav: transparent -> solid ---------- */
  var nav = document.getElementById("nav");
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    nav.classList.toggle("is-scrolled", y > 40);
  }
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  document.addEventListener("scroll", onScroll, { passive: true, capture: true });
  onScroll();

  /* ---------- Mobile hamburger ---------- */
  var toggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");

  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  toggle.addEventListener("click", function () {
    setMenu(!nav.classList.contains("is-open"));
  });
  // Close menu after tapping a link
  navLinks.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      setMenu(false);
      toggle.focus();
    }
  });

  /* ---------- Scroll reveal ----------
     Robust by design: content is visible by default. We only opt into the
     animated hidden state (html.js-anim) when we KNOW we can reveal it again.
     We avoid IntersectionObserver (which can silently never fire in some
     embedded/iframe scrollers) in favour of a getBoundingClientRect check
     wired to every plausible scroll source, plus a hard timeout fallback. */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  function revealAll() {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  if (prefersReduced || !revealEls.length) {
    // No animation: leave everything visible (no js-anim class added).
    revealAll();
  } else {
    document.documentElement.classList.add("js-anim");

    function revealInView() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var pending = 0;
      revealEls.forEach(function (el) {
        if (el.classList.contains("is-in")) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > -40) {
          el.classList.add("is-in");
        } else {
          pending++;
        }
      });
      return pending;
    }

    var ticking = false;
    function onScrollReveal() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        revealInView();
        ticking = false;
      });
    }

    // Listen on every scroll source we can, with capture so we catch
    // events from inner scroll containers too.
    window.addEventListener("scroll", onScrollReveal, { passive: true, capture: true });
    document.addEventListener("scroll", onScrollReveal, { passive: true, capture: true });
    window.addEventListener("resize", onScrollReveal, { passive: true });

    // Initial passes (cover late layout / font load).
    revealInView();
    window.addEventListener("load", revealInView);
    setTimeout(revealInView, 200);
    setTimeout(revealInView, 600);

    // Hard fallback: if for any reason scrolling never reports intersections,
    // never leave content hidden. Reveal everything after a short grace period.
    setTimeout(revealAll, 2500);
  }

  /* ---------- Enquiry-type preselect from hash ---------- */
  var select = document.getElementById("type");
  function presetFromHash() {
    var hash = window.location.hash || "";
    // matches "#enquiry?type=umrah" or "#type=umrah" etc.
    var m = hash.match(/type=([a-z0-9 &%-]+)/i);
    if (!m || !select) return;
    var want = decodeURIComponent(m[1]).replace(/\+/g, " ").trim().toLowerCase();
    Array.prototype.forEach.call(select.options, function (opt) {
      if (opt.value.toLowerCase() === want || opt.text.toLowerCase() === want) {
        select.value = opt.value;
      }
    });
  }
  presetFromHash();
  window.addEventListener("hashchange", presetFromHash);

  // The Hajj/Umrah CTA uses href "#enquiry?type=umrah" which isn't a real
  // element id — intercept it to scroll to #enquiry and preset the select.
  document.querySelectorAll('a[href^="#enquiry?"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var type = (link.getAttribute("data-type") || "").toLowerCase();
      if (select && type) {
        Array.prototype.forEach.call(select.options, function (opt) {
          if (opt.value.toLowerCase() === type) select.value = opt.value;
        });
      }
      scrollToEl(document.getElementById("enquiry"));
    });
  });

  /* ---------- Formspree submit ---------- */
  var form = document.getElementById("enquiry-form");
  var successPanel = document.getElementById("form-success");
  var errorBox = document.getElementById("form-error");
  var submitBtn = document.getElementById("submit-btn");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Honeypot — silently succeed for bots
      var hp = form.querySelector('input[name="_gotcha"]');
      if (hp && hp.value) {
        return;
      }

      // Native validity check
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      errorBox.classList.remove("is-visible");
      submitBtn.disabled = true;
      var originalText = submitBtn.textContent;
      submitBtn.textContent = "Sending…";

      var data = new FormData(form);

      fetch(form.action, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" }
      })
        .then(function (response) {
          if (response.ok) {
            form.style.display = "none";
            successPanel.classList.add("is-visible");
            scrollToEl(document.getElementById("enquiry"), 24);
          } else {
            throw new Error("Bad response");
          }
        })
        .catch(function () {
          errorBox.classList.add("is-visible");
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
    });
  }

  /* ---------- Year (footer is static 2026 per brief; left as-is) ---------- */
})();
