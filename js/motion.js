/* Zaion portfolio: motion primitives, progressive enhancement and bounded work. */
(function (global) {
  "use strict";
  if (global.ZaionMotion && typeof global.ZaionMotion.destroy === "function") global.ZaionMotion.destroy();

  var doc = global.document;
  var records = new Map();
  var activeCounters = new Set();
  var activeTilts = new Set();
  var pendingPointers = new Set();
  var cleanups = [];
  var observer = null;
  var initialized = false;
  var requestedReduced = false;
  var previousReduced = false;
  var systemMotion = null;
  var finePointer = null;
  var counterFrame = 0, tiltFrame = 0, pointerFrame = 0, visibilityFrame = 0;
  var lastTiltTime = 0;
  var SELECTOR = "[data-reveal], .reveal, [data-counter], [data-motion-loop], [data-tilt], [data-spotlight]";

  function hasRAF() { return typeof global.requestAnimationFrame === "function"; }
  function raf(fn) { return global.requestAnimationFrame(fn); }
  function cancel(id) { if (id && typeof global.cancelAnimationFrame === "function") global.cancelAnimationFrame(id); }
  function reduced() { return requestedReduced || !!(systemMotion && systemMotion.matches); }
  function pointerAllowed() { return !finePointer || finePointer.matches; }
  function clamp(value, low, high) { return Math.min(high, Math.max(low, value)); }
  function listen(target, type, fn, options, list) {
    target.addEventListener(type, fn, options);
    (list || cleanups).push(function () { target.removeEventListener(type, fn, options); });
  }
  function listenMedia(media, fn) {
    if (!media) return;
    if (typeof media.addEventListener === "function") listen(media, "change", fn);
    else if (typeof media.addListener === "function") {
      media.addListener(fn);
      cleanups.push(function () { media.removeListener(fn); });
    }
  }
  function media(query) {
    try { return typeof global.matchMedia === "function" ? global.matchMedia(query) : null; }
    catch (_) { return null; }
  }
  function visibleNow(el) {
    if (!el.isConnected) return false;
    var box = el.getBoundingClientRect();
    var width = global.innerWidth || doc.documentElement.clientWidth;
    var height = global.innerHeight || doc.documentElement.clientHeight;
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < height && box.left < width;
  }
  function setStyle(el, property, value) {
    if (el.style.getPropertyValue(property) !== value) el.style.setProperty(property, value);
  }
  function restoreStyle(el, property, value) {
    if (value) setStyle(el, property, value);
    else el.style.removeProperty(property);
  }
  function reveal(record) {
    if (!record.reveal || record.revealed) return;
    record.revealed = true;
    record.el.classList.add("is-revealed");
  }

  function readCounter(el) {
    var attr = (el.getAttribute("data-counter") || "").trim();
    var current = el.textContent.trim();
    var raw = attr || current;
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return null;
    var target = Number(raw);
    if (!Number.isFinite(target) || Math.abs(target) > 1e12) return null;
    var decimals = Math.min(3, (raw.split(".")[1] || "").length);
    var pad = Number(el.getAttribute("data-counter-pad")) || 0;
    if (!pad && /^0\d+$/.test(current) && Number(current) === target) pad = current.length;
    pad = clamp(Math.floor(pad), 1, 8);
    var formatter;
    try {
      formatter = new Intl.NumberFormat(doc.documentElement.lang || "pt-BR", {
        minimumIntegerDigits: pad, minimumFractionDigits: decimals,
        maximumFractionDigits: decimals, useGrouping: pad === 1
      });
    } catch (_) { formatter = { format: function (number) { return number.toFixed(decimals); } }; }
    var sameOriginal = /^[+-]?\d+(?:\.\d+)?$/.test(current) && Number(current) === target;
    return { key: raw, target: target, format: formatter, finalText: sameOriginal ? current : formatter.format(target), startedAt: null };
  }
  function finishCounter(record) {
    if (!record.counter) return;
    record.el.textContent = record.counter.finalText;
    record.counterDone = true;
    activeCounters.delete(record);
    if (!activeCounters.size) { cancel(counterFrame); counterFrame = 0; }
  }
  function counterTick(now) {
    counterFrame = 0;
    activeCounters.forEach(function (record) {
      if (!record.el.isConnected || reduced() || doc.hidden || !record.visible) { finishCounter(record); return; }
      if (record.counter.startedAt === null) record.counter.startedAt = now;
      var progress = clamp((now - record.counter.startedAt) / 700, 0, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      record.el.textContent = record.counter.format.format(record.counter.target * eased);
      if (progress === 1) finishCounter(record);
    });
    if (activeCounters.size) counterFrame = raf(counterTick);
  }
  function startCounter(record) {
    if (!record.counter || record.counterDone || activeCounters.has(record)) return;
    if (reduced() || doc.hidden || !hasRAF()) { finishCounter(record); return; }
    record.counter.startedAt = null;
    activeCounters.add(record);
    if (!counterFrame) counterFrame = raf(counterTick);
  }
  function resetSpot(record) {
    if (!record.spot) return;
    restoreStyle(record.el, "--pointer-x", record.initialSpotX);
    restoreStyle(record.el, "--pointer-y", record.initialSpotY);
  }
  function resetTilt(record) {
    if (!record.tilt) return;
    activeTilts.delete(record);
    record.x = record.y = record.tx = record.ty = record.vx = record.vy = 0;
    restoreStyle(record.tilt, "--tilt-x", record.initialTiltX);
    restoreStyle(record.tilt, "--tilt-y", record.initialTiltY);
    if (!activeTilts.size) { cancel(tiltFrame); tiltFrame = 0; lastTiltTime = 0; }
  }
  function tiltEligible(record) {
    return initialized && record.el.isConnected && record.visible && !doc.hidden && !reduced() && pointerAllowed();
  }
  function tiltTick(now) {
    tiltFrame = 0;
    var dt = lastTiltTime ? clamp((now - lastTiltTime) / 16.667, 0.25, 2) : 1;
    lastTiltTime = now;
    activeTilts.forEach(function (record) {
      if (!tiltEligible(record)) { resetTilt(record); return; }
      var damping = Math.pow(0.72, dt);
      record.vx = (record.vx + (record.tx - record.x) * 0.14 * dt) * damping;
      record.vy = (record.vy + (record.ty - record.y) * 0.14 * dt) * damping;
      record.x = clamp(record.x + record.vx * dt, -8, 8);
      record.y = clamp(record.y + record.vy * dt, -8, 8);
      var settled = Math.abs(record.tx - record.x) < 0.02 && Math.abs(record.ty - record.y) < 0.02 &&
        Math.abs(record.vx) < 0.02 && Math.abs(record.vy) < 0.02;
      if (settled) { record.x = record.tx; record.y = record.ty; activeTilts.delete(record); }
      setStyle(record.tilt, "--tilt-x", record.x.toFixed(3) + "deg");
      setStyle(record.tilt, "--tilt-y", record.y.toFixed(3) + "deg");
      if (settled && !record.tx && !record.ty) resetTilt(record);
    });
    if (activeTilts.size) tiltFrame = raf(tiltTick);
    else lastTiltTime = 0;
  }
  function startTilt(record) {
    if (!hasRAF() || !tiltEligible(record)) { resetTilt(record); return; }
    activeTilts.add(record);
    if (!tiltFrame) tiltFrame = raf(tiltTick);
  }
  function flushPointers() {
    pointerFrame = 0;
    pendingPointers.forEach(function (record) {
      if (!record.pointerInside || !tiltEligible(record)) return;
      var box = record.el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      var x = clamp((record.pointerX - box.left) / box.width, 0, 1);
      var y = clamp((record.pointerY - box.top) / box.height, 0, 1);
      if (record.spot) {
        setStyle(record.el, "--pointer-x", (x * 100).toFixed(2) + "%");
        setStyle(record.el, "--pointer-y", (y * 100).toFixed(2) + "%");
      }
      if (record.tilt) { record.tx = (0.5 - y) * 16; record.ty = (x - 0.5) * 16; startTilt(record); }
    });
    pendingPointers.clear();
  }
  function bindPointer(record) {
    if ((!record.spot && !record.tilt) || record.pointerBound) return;
    record.pointerBound = true;
    function move(event) {
      if (event.pointerType === "touch" || event.isPrimary === false || !tiltEligible(record)) return;
      record.pointerInside = true;
      record.pointerX = event.clientX; record.pointerY = event.clientY;
      pendingPointers.add(record);
      if (!pointerFrame && hasRAF()) pointerFrame = raf(flushPointers);
    }
    function leave() {
      record.pointerInside = false;
      pendingPointers.delete(record);
      resetSpot(record);
      if (record.tilt) { record.tx = 0; record.ty = 0; startTilt(record); }
    }
    listen(record.el, "pointerenter", move, { passive: true }, record.cleanups);
    listen(record.el, "pointermove", move, { passive: true }, record.cleanups);
    listen(record.el, "pointerleave", leave, { passive: true }, record.cleanups);
    listen(record.el, "pointercancel", leave, { passive: true }, record.cleanups);
  }
  function loopPolicy(record) {
    if (record.loop) record.el.classList.toggle("is-paused",
      reduced() || !!doc.hidden || !record.visible || record.el.getAttribute("data-motion-paused") === "true");
  }
  function syncRecord(record) {
    loopPolicy(record);
    if (record.visible) { reveal(record); startCounter(record); }
    else if (activeCounters.has(record)) finishCounter(record);
    if (!record.visible || doc.hidden || reduced() || !pointerAllowed()) { resetTilt(record); resetSpot(record); }
  }
  function removeRecord(record) {
    if (observer) observer.unobserve(record.el);
    record.cleanups.forEach(function (fn) { fn(); });
    finishCounter(record); resetTilt(record); resetSpot(record);
    pendingPointers.delete(record);
    reveal(record);
    if (record.loop) record.el.classList.add("is-paused");
    records.delete(record.el);
  }
  function register(el) {
    var record = records.get(el);
    if (!record) {
      record = { el: el, cleanups: [], revealed: el.classList.contains("is-revealed"),
        visible: visibleNow(el), x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 };
      records.set(el, record);
    }
    record.reveal = el.hasAttribute("data-reveal") || el.classList.contains("reveal");
    record.loop = el.hasAttribute("data-motion-loop");
    if (el.hasAttribute("data-spotlight") && !record.spot) {
      record.spot = true;
      record.initialSpotX = el.style.getPropertyValue("--pointer-x");
      record.initialSpotY = el.style.getPropertyValue("--pointer-y");
    }
    if (el.hasAttribute("data-tilt") && !record.tilt) {
      record.tilt = el.querySelector("[data-tilt-inner]") || el;
      record.initialTiltX = record.tilt.style.getPropertyValue("--tilt-x");
      record.initialTiltY = record.tilt.style.getPropertyValue("--tilt-y");
    }
    if (el.hasAttribute("data-counter")) {
      var next = readCounter(el);
      if (next && (!record.counter || record.counter.key !== next.key)) {
        if (record.counter) finishCounter(record);
        record.counter = next; record.counterDone = false;
      }
    }
    bindPointer(record);
    if (observer) observer.observe(el);
    if (!observer || reduced()) syncRecord(record);
    else loopPolicy(record);
  }
  function flags() {
    doc.documentElement.classList.toggle("motion-reduced", reduced());
    doc.documentElement.classList.toggle("motion-ready", !!observer && !reduced());
  }
  function refresh() {
    if (!initialized) return false;
    records.forEach(function (record) { if (!record.el.isConnected) removeRecord(record); });
    doc.querySelectorAll(SELECTOR).forEach(register);
    flags();
    return true;
  }
  function applyPolicy() {
    if (!initialized) return;
    var changed = previousReduced !== reduced();
    previousReduced = reduced();
    flags();
    records.forEach(function (record) {
      if (changed) { reveal(record); finishCounter(record); }
      if (doc.hidden || changed || !pointerAllowed()) { resetTilt(record); resetSpot(record); }
      if (doc.hidden && activeCounters.has(record)) finishCounter(record);
      if (!observer) record.visible = visibleNow(record.el);
      loopPolicy(record);
    });
    if (doc.hidden || changed || reduced() || !pointerAllowed()) {
      cancel(pointerFrame); pointerFrame = 0; pendingPointers.clear();
      cancel(visibilityFrame); visibilityFrame = 0;
    }
  }
  function syncVisibility() {
    visibilityFrame = 0;
    records.forEach(function (record) { record.visible = visibleNow(record.el); syncRecord(record); });
  }
  function scheduleVisibility() {
    if (!initialized || visibilityFrame) return;
    if (hasRAF()) visibilityFrame = raf(syncVisibility);
    else syncVisibility();
  }
  function setReduced(value) { requestedReduced = !!value; applyPolicy(); }
  function destroy() {
    if (!initialized) return;
    initialized = false;
    if (observer) observer.disconnect();
    observer = null;
    records.forEach(removeRecord);
    records.clear(); activeCounters.clear(); activeTilts.clear(); pendingPointers.clear();
    cleanups.forEach(function (fn) { fn(); }); cleanups = [];
    cancel(counterFrame); cancel(tiltFrame); cancel(pointerFrame); cancel(visibilityFrame);
    counterFrame = tiltFrame = pointerFrame = visibilityFrame = 0; lastTiltTime = 0;
    doc.documentElement.classList.remove("motion-ready", "motion-reduced");
    systemMotion = finePointer = null;
  }
  function init(options) {
    if (!doc || !doc.documentElement) return false;
    if (initialized) {
      if (options && typeof options.reduced === "boolean") setReduced(options.reduced);
      return refresh();
    }
    if (options && typeof options.reduced === "boolean") requestedReduced = options.reduced;
    systemMotion = media("(prefers-reduced-motion: reduce)");
    finePointer = media("(hover: hover) and (pointer: fine)");
    previousReduced = reduced();
    initialized = true;
    try {
      if (typeof global.IntersectionObserver === "function") {
        observer = new global.IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            var record = records.get(entry.target);
            if (!record) return;
            record.visible = entry.isIntersecting && entry.intersectionRatio > 0;
            syncRecord(record);
          });
        }, { rootMargin: "0px 0px -5% 0px", threshold: [0, 0.01, 0.12] });
      }
      listen(doc, "visibilitychange", function () { applyPolicy(); if (!doc.hidden) scheduleVisibility(); });
      listen(global, "resize", scheduleVisibility, { passive: true });
      if (!observer) listen(global, "scroll", scheduleVisibility, { passive: true });
      listenMedia(systemMotion, applyPolicy);
      listenMedia(finePointer, applyPolicy);
      return refresh();
    } catch (_) {
      destroy();
      doc.querySelectorAll("[data-reveal], .reveal").forEach(function (el) { el.classList.add("is-revealed"); });
      return false;
    }
  }

  global.ZaionMotion = Object.freeze({ init: init, setReduced: setReduced, refresh: refresh, destroy: destroy });
})(window);
