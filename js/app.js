/* Original interactions for Zaion Araújo's static portfolio. No framework or tracking. */
(function (global) {
  "use strict";
  var data = global.ZaionContent;
  if (!data || global.ZaionApp) return;
  var doc = global.document || null;
  var keys = { theme: "zaion.theme", lang: "zaion.lang", focus: "zaion.focus", motion: "zaion.motion" };
  var state = { lang: "pt", theme: "dark", focus: "all", filter: "all", active: "home", flipped: false, reduced: false, paused: false, osReduced: false, dialog: null, project: null, projectTab: "about", zoomed: false, commands: [], commandIndex: 0, commandOrigin: null, formStatus: null, submitting: false, heroVisible: true, dashboardReady: false, initialised: false };
  var returnFocus = new Map(), timers = {}, sectionObserver = null, heroObserver = null, scrollFrame = 0;
  var themeTransition = null, themeAnimation = null, themeTarget = null, themeVersion = 0, wordIndex = 0, wordList = [], unlockStyles = null;
  var reduceMedia = null, themeMedia = null, explicitTheme = false;
  function normalise(value) { return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
  function escapeHTML(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function choose(value, allowed, fallback) { var v = typeof value === "string" ? value.toLowerCase() : ""; return allowed.indexOf(v) >= 0 ? v : fallback; }
  function resolvePreference(urlValue, savedValue, allowed, fallback) { return urlValue !== null && urlValue !== undefined ? choose(urlValue, allowed, fallback) : choose(savedValue, allowed, fallback); }
  function validForm(values) {
    var name = String(values.name || "").replace(/\s+/g, " ").trim();
    var service = String(values.service || "");
    var message = String(values.message || "").trim();
    if (name.length < 2 || name.length > 80) return { valid: false, field: "name", key: "form.error.name" };
    if (service !== "other" && !data.services.some(function (s) { return s.id === service; })) return { valid: false, field: "service", key: "form.error.service" };
    if (message.length < 10 || message.length > 900) return { valid: false, field: "message", key: "form.error.message" };
    return { valid: true, name: name, service: service, message: message };
  }
  function makeWhatsAppURL(values, lang) {
    var checked = validForm(values);
    if (!checked.valid) throw new Error(checked.key);
    var dictionary = data.copy[lang === "en" ? "en" : "pt"];
    var service = data.services.find(function (s) { return s.id === checked.service; });
    var vars = { name: checked.name, service: service ? service.request[lang === "en" ? "en" : "pt"] : dictionary["form.service.other"], message: checked.message };
    var text = dictionary["form.whatsapp.template"].replace(/\{(name|service|message)\}/g, function (_, key) { return vars[key]; });
    if (!/^\d{10,15}$/.test(data.site.phone)) throw new Error("Invalid contact configuration.");
    return "https://wa.me/" + data.site.phone + "?text=" + encodeURIComponent(text);
  }
  global.ZaionAppUtils = Object.freeze({ normalise: normalise, escapeHTML: escapeHTML, resolvePreference: resolvePreference, validateForm: validForm, makeWhatsAppURL: makeWhatsAppURL });
  if (!doc || typeof doc.querySelector !== "function") return;
  var $ = function (selector, root) { return (root || doc).querySelector(selector); };
  var $$ = function (selector, root) { return Array.from((root || doc).querySelectorAll(selector)); };
  var t = function (key) { var value = data.copy[state.lang][key]; return value === undefined ? (data.copy.pt[key] === undefined ? key : data.copy.pt[key]) : value; };
  var L = function (pt, en) { return state.lang === "en" ? en : pt; };
  var raf = function (callback) { return typeof global.requestAnimationFrame === "function" ? global.requestAnimationFrame(callback) : global.setTimeout(callback, 16); };
  function read(key) { try { return global.localStorage.getItem(key); } catch (_) { return null; } }
  function save(key, value) { try { global.localStorage.setItem(key, value); } catch (_) { /* Preferences are optional. */ } }
  function setText(element, text) { if (element) element.textContent = String(text == null ? "" : text); }
  function updateURL() {
    try {
      var url = new global.URL(global.location.href);
      url.searchParams.set("lang", state.lang);
      url.searchParams.set("focus", state.focus);
      global.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (_) { /* Local previews with limited history still work. */ }
  }
  function translate(root) {
    $$("[data-t]", root).forEach(function (node) { var value = t(node.getAttribute("data-t")); if (typeof value === "string") setText(node, value); });
    [["data-t-placeholder", "placeholder"], ["data-t-aria-label", "aria-label"], ["data-t-title", "title"], ["data-t-alt", "alt"]].forEach(function (pair) {
      $$("[" + pair[0] + "]", root).forEach(function (node) { var value = t(node.getAttribute(pair[0])); if (typeof value === "string") node.setAttribute(pair[1], value); });
    });
  }
  function toast(message) {
    var node = $("#toast");
    if (!node) return;
    global.clearTimeout(timers.toast);
    setText(node, message); node.hidden = false; node.classList.add("is-visible");
    timers.toast = global.setTimeout(function () { node.classList.remove("is-visible"); node.hidden = true; }, 4200);
  }
  function themeButton() {
    var button = $("#theme-toggle"); if (!button) return;
    button.setAttribute("aria-label", t(state.theme === "dark" ? "theme.toLight" : "theme.toDark"));
    button.setAttribute("title", t(state.theme === "dark" ? "theme.toLight" : "theme.toDark"));
    button.setAttribute("aria-pressed", String(state.theme === "light"));
    var label = $("[data-theme-label]", button); if (label) setText(label, t("theme." + state.theme));
    var icon = $("[data-theme-icon]", button);
    if (icon) icon.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (state.theme === "dark" ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>' : '<path d="M20.7 13A8.8 8.8 0 0 1 11 3.3a9 9 0 1 0 9.7 9.7Z"/>') + '</svg>';
  }
  function applyTheme(theme) {
    state.theme = choose(theme, ["dark", "light"], "dark");
    doc.documentElement.setAttribute("data-theme", state.theme);
    doc.documentElement.style.colorScheme = state.theme;
    var meta = $('meta[name="theme-color"]'); if (meta) meta.content = state.theme === "dark" ? "#390d27" : "#e9a9c3";
    themeButton();
  }
  function flushThemeStyles() {
    // Commit final variables for the whole document before capturing the new view.
    void doc.documentElement.offsetWidth;
    if (doc.body && typeof global.getComputedStyle === "function") global.getComputedStyle(doc.body).backgroundColor;
  }
  function releaseTheme(version) {
    if (version !== themeVersion) return;
    global.clearTimeout(timers.themeSafety);
    doc.documentElement.classList.remove("theme-switching");
    doc.documentElement.removeAttribute("data-theme-transition");
    themeTransition = null; themeAnimation = null; themeTarget = null;
  }
  function cancelThemeVisuals() {
    if (themeAnimation && typeof themeAnimation.cancel === "function") {
      try { themeAnimation.cancel(); } catch (_) {}
    }
    if (themeTransition && typeof themeTransition.skipTransition === "function") {
      try { themeTransition.skipTransition(); } catch (_) {}
    }
    themeAnimation = null; themeTransition = null;
  }
  function toggleTheme(event) {
    var next = (themeTarget || state.theme) === "dark" ? "light" : "dark";
    explicitTheme = true; save(keys.theme, next);
    themeVersion += 1; var version = themeVersion;
    cancelThemeVisuals(); global.clearTimeout(timers.themeSafety);
    themeTarget = next;
    doc.documentElement.classList.add("theme-switching");
    doc.documentElement.setAttribute("data-theme-transition", "pending");
    flushThemeStyles();
    var committed = false;
    function commit() {
      if (version !== themeVersion || committed) return;
      applyTheme(next); flushThemeStyles(); committed = true;
    }
    if (state.reduced || typeof doc.startViewTransition !== "function") {
      commit(); releaseTheme(version); return;
    }
    var button = $("#theme-toggle"), rect = button ? button.getBoundingClientRect() : { left: global.innerWidth / 2, top: 20, width: 0, height: 0 };
    var x = event && event.clientX ? event.clientX : rect.left + rect.width / 2;
    var y = event && event.clientY ? event.clientY : rect.top + rect.height / 2;
    var radius = Math.hypot(Math.max(x, global.innerWidth - x), Math.max(y, global.innerHeight - y));
    try {
      var transition = doc.startViewTransition(commit);
      themeTransition = transition;
      // A watchdog prevents a stuck state if a browser suspends its transition tree.
      timers.themeSafety = global.setTimeout(function () {
        if (version !== themeVersion) return;
        cancelThemeVisuals(); commit(); releaseTheme(version);
      }, 1200);
      transition.ready.then(function () {
        if (version !== themeVersion) return;
        if (state.reduced || typeof doc.documentElement.animate !== "function") {
          if (typeof transition.skipTransition === "function") transition.skipTransition();
          commit(); releaseTheme(version); return;
        }
        doc.documentElement.setAttribute("data-theme-transition", "revealing");
        try {
          var animation = doc.documentElement.animate(
            { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
            { duration: 460, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both", pseudoElement: "::view-transition-new(root)" }
          );
          themeAnimation = animation;
          animation.finished.then(function () { releaseTheme(version); }, function () { releaseTheme(version); });
        } catch (_) {
          if (typeof transition.skipTransition === "function") transition.skipTransition();
          commit(); releaseTheme(version);
        }
      }, function () {
        if (version !== themeVersion) return;
        commit(); releaseTheme(version);
      });
      transition.finished.then(function () {
        if (version !== themeVersion) return;
        commit(); releaseTheme(version);
      }, function () {
        if (version !== themeVersion) return;
        commit(); releaseTheme(version);
      });
    } catch (_) { commit(); releaseTheme(version); }
  }
  function motionButtons() {
    $$("[data-motion-toggle]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(state.reduced));
      var label = state.osReduced ? L("Movimento reduzido pelo sistema", "Motion reduced by system preference") : state.reduced ? L("Retomar animações", "Resume animations") : L("Pausar animações", "Pause animations");
      button.setAttribute("aria-label", label); button.title = label;
      setText($("[data-motion-label]", button), state.reduced ? L("Movimento pausado", "Motion paused") : L("Pausar movimento", "Pause motion"));
    });
  }
  function refreshMotion() {
    state.osReduced = !!(reduceMedia && reduceMedia.matches);
    state.reduced = state.osReduced || state.paused;
    doc.documentElement.setAttribute("data-motion", state.reduced ? "reduce" : "full");
    if (global.ZaionMotion) global.ZaionMotion.setReduced(state.reduced);
    if (state.reduced && themeTransition && typeof themeTransition.skipTransition === "function") themeTransition.skipTransition();
    if (state.reduced) hideIntro();
    motionButtons(); resetWords();
  }
  function toggleMotion() {
    if (state.osReduced) { toast(L("A preferência de movimento reduzido do sistema está ativa.", "Your system's reduced-motion preference is active.")); return; }
    state.paused = !state.paused; save(keys.motion, state.paused ? "reduce" : "system"); refreshMotion(); renderCommands();
  }
  function stopWords() {
    global.clearTimeout(timers.word); global.clearTimeout(timers.wordSwap);
    var word = $("#rotating-word"); if (word) word.classList.remove("is-changing");
  }
  function nextWord() {
    if (state.reduced || doc.hidden || !state.heroVisible || wordList.length < 2) return;
    timers.word = global.setTimeout(function () {
      var word = $("#rotating-word"); if (!word) return;
      word.classList.add("is-changing");
      timers.wordSwap = global.setTimeout(function () {
        wordIndex = (wordIndex + 1) % wordList.length;
        setText(word, wordList[wordIndex]); word.classList.remove("is-changing"); nextWord();
      }, 160);
    }, 3100);
  }
  function resetWords() {
    stopWords(); var all = t("hero.rotating");
    wordList = Array.isArray(all) ? (state.focus === "dev" ? [all[0], all[2]] : state.focus === "design" ? [all[1], all[2]] : all.slice()) : [String(all)];
    wordIndex = 0; setText($("#rotating-word"), wordList[0]); nextWord();
  }
  function updateClock() {
    var clock = $("#local-clock"); if (!clock) return;
    try { setText(clock, new Intl.DateTimeFormat(state.lang === "pt" ? "pt-BR" : "en-GB", { timeZone: data.site.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())); }
    catch (_) { setText(clock, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); }
  }
  function startClock() {
    global.clearTimeout(timers.clock); updateClock();
    if (!doc.hidden) timers.clock = global.setTimeout(startClock, 30000);
  }
  function hideIntro() {
    global.clearTimeout(timers.intro);
    var intro = $("#intro"); if (intro) { intro.hidden = true; intro.classList.remove("is-active"); }
  }
  function firstIntro() {
    var intro = $("#intro"); if (!intro || state.reduced) return;
    try { if (global.sessionStorage.getItem("zaion.intro-seen")) return; global.sessionStorage.setItem("zaion.intro-seen", "1"); } catch (_) { return; }
    intro.hidden = false; intro.classList.add("is-active");
    timers.intro = global.setTimeout(hideIntro, 900);
  }
  function lockScroll() {
    if (unlockStyles) return;
    var gap = Math.max(0, global.innerWidth - doc.documentElement.clientWidth);
    unlockStyles = { overflow: doc.body.style.overflow, paddingRight: doc.body.style.paddingRight };
    var padding = parseFloat(global.getComputedStyle(doc.body).paddingRight) || 0;
    doc.body.style.overflow = "hidden";
    if (gap) doc.body.style.paddingRight = padding + gap + "px";
    doc.body.classList.add("has-dialog");
  }
  function unlockScroll() {
    if (!unlockStyles) return;
    doc.body.style.overflow = unlockStyles.overflow; doc.body.style.paddingRight = unlockStyles.paddingRight;
    doc.body.classList.remove("has-dialog"); unlockStyles = null;
  }
  function closeDialog(dialog, restore) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    if (state.dialog === dialog) { state.dialog = null; unlockScroll(); }
    if (dialog.id === "mobile-menu") { var toggle = $("#menu-open"); if (toggle) toggle.setAttribute("aria-expanded", "false"); }
    if (dialog.id === "command-dialog") { var input = $("#command-search"); if (input) input.removeAttribute("aria-activedescendant"); }
    if (restore !== false) {
      var previous = returnFocus.get(dialog); if (previous && previous.isConnected && typeof previous.focus === "function") { try { previous.focus({ preventScroll: true }); } catch (_) { previous.focus(); } }
    }
  }
  function openDialog(dialog, trigger) {
    if (!dialog) return;
    var origin = trigger || doc.activeElement;
    if (state.dialog && state.dialog !== dialog) { origin = returnFocus.get(state.dialog) || origin; closeDialog(state.dialog, false); }
    returnFocus.set(dialog, origin);
    lockScroll(); state.dialog = dialog;
    if (!dialog.open) { if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); }
    if (dialog.id === "mobile-menu") { var toggle = $("#menu-open"); if (toggle) toggle.setAttribute("aria-expanded", "true"); }
    var first = dialog.id === "command-dialog" ? $("#command-search") : $("[autofocus], [data-close-dialog], button, a[href], input", dialog);
    if (first) first.focus({ preventScroll: true });
  }
  function focusable(dialog) {
    return $$('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])', dialog).filter(function (el) { return !el.hidden && el.getClientRects().length && !el.closest("[hidden]"); });
  }
  function bindDialogs() {
    $$("dialog").forEach(function (dialog) {
      dialog.addEventListener("cancel", function (event) { event.preventDefault(); closeDialog(dialog); });
      dialog.addEventListener("click", function (event) { if (event.target === dialog) closeDialog(dialog); });
      dialog.addEventListener("close", function () { if (state.dialog === dialog) { state.dialog = null; unlockScroll(); } });
      dialog.addEventListener("keydown", function (event) {
        if (event.key !== "Tab") return;
        var nodes = focusable(dialog); if (!nodes.length) { event.preventDefault(); return; }
        var first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (doc.activeElement === first || !dialog.contains(doc.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (doc.activeElement === last || !dialog.contains(doc.activeElement))) { event.preventDefault(); first.focus(); }
      });
    });
  }
  function setActive(id) {
    state.active = id;
    $$("[data-nav]").forEach(function (a) { var selected = a.getAttribute("href") === "#" + id; a.classList.toggle("is-active", selected); if (selected) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
    updatePill();
  }
  function updatePill() {
    var pill = $("#nav-pill"); if (!pill || !pill.parentElement) return;
    var parent = pill.parentElement;
    var active = $('[data-nav][aria-current="location"]', parent); if (!active || !active.getClientRects().length) { pill.style.opacity = "0"; return; }
    var a = active.getBoundingClientRect(), p = parent.getBoundingClientRect();
    pill.style.width = a.width + "px"; pill.style.transform = "translateX(" + (a.left - p.left) + "px)"; pill.style.opacity = "1";
  }
  function chooseActiveSection() {
    var section = $("#home"), target = global.innerHeight * 0.27;
    $$("main section[id]").filter(function (node) { return ["home","about","projects","stack","github","services","contact"].indexOf(node.id) >= 0; }).forEach(function (node) { if (node.getBoundingClientRect().top <= target) section = node; });
    if (global.innerHeight + global.scrollY >= doc.documentElement.scrollHeight - 6) section = $("#contact") || section;
    if (section && section.id !== state.active) setActive(section.id);
  }
  function onScroll() {
    if (scrollFrame) return;
    scrollFrame = raf(function () {
      scrollFrame = 0;
      var height = doc.documentElement.scrollHeight - global.innerHeight;
      var progress = height > 0 ? Math.min(1, Math.max(0, global.scrollY / height)) : 0;
      var line = $("#scroll-progress"); if (line) line.style.transform = "scaleX(" + progress + ")";
      chooseActiveSection();
      var header = $("#site-header"); if (header) header.classList.toggle("is-scrolled", global.scrollY > 24);
    });
  }
  function navigateTo(id) {
    var section = doc.getElementById(id); if (!section) return;
    if (state.dialog) closeDialog(state.dialog, false);
    try { if (global.location.hash !== "#" + id) global.history.pushState(null, "", "#" + id); } catch (_) {}
    section.scrollIntoView({ behavior: state.reduced ? "auto" : "smooth", block: "start" });
    var heading = $("h1,h2", section);
    if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
    setActive(id);
  }
  function reorderNavigation(order) {
    var groups = new Map();
    $$("[data-nav]").forEach(function (a) { var item = a.closest("li") || a; var parent = item.parentElement; if (!parent) return; if (!groups.has(parent)) groups.set(parent, []); groups.get(parent).push({ item: item, id: a.getAttribute("href").slice(1) }); });
    groups.forEach(function (entries, parent) { entries.sort(function (a,b) { return order.indexOf(a.id) - order.indexOf(b.id); }).forEach(function (row) { parent.appendChild(row.item); }); });
  }
  function setFocus(focus, persist) {
    state.focus = choose(focus, ["all", "dev", "design"], "all");
    var orders = { all: ["about","projects","stack","github","services","contact"], dev: ["projects","github","stack","about","services","contact"], design: ["projects","services","about","stack","github","contact"] };
    var wrapper = $("#page-sections"), order = orders[state.focus];
    if (wrapper) order.forEach(function (id, index) { var section = doc.getElementById(id); if (section && section.parentElement === wrapper) { wrapper.appendChild(section); $$("[data-section-number]", section).forEach(function (span) { setText(span, String(index + 1).padStart(2, "0")); }); } });
    reorderNavigation(["home"].concat(order));
    $$("[data-focus]").forEach(function (button) { var active = button.getAttribute("data-focus") === state.focus; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    var grid = $("#project-grid");
    if (grid) {
      var cards = $$("[data-project-card]", grid);
      var preferred = state.focus === "dev" ? "web" : state.focus === "design" ? "design" : "";
      if (preferred) cards.sort(function (a,b) { return Number(b.getAttribute("data-kind") === preferred) - Number(a.getAttribute("data-kind") === preferred); });
      else cards.sort(function (a,b) { return data.projects.findIndex(function (p) { return p.id === a.getAttribute("data-project-card"); }) - data.projects.findIndex(function (p) { return p.id === b.getAttribute("data-project-card"); }); });
      cards.forEach(function (card) { grid.appendChild(card); });
    }
    setProjectFilter(state.focus === "dev" ? "web" : state.focus === "design" ? "design" : "all");
    resetWords(); raf(updatePill);
    if (persist !== false) { save(keys.focus, state.focus); updateURL(); }
    if (global.ZaionMotion) global.ZaionMotion.refresh();
    var note = $("#focus-description"); if (note) setText(note, t("focus." + state.focus));
  }
  function setProjectFilter(filter) {
    state.filter = choose(filter, ["all","web","design"], "all"); var count = 0;
    $$("[data-project-card]").forEach(function (card) { var show = state.filter === "all" || card.getAttribute("data-kind") === state.filter; card.hidden = !show; if (show) count += 1; });
    $$("[data-project-filter]").forEach(function (button) { var active = button.getAttribute("data-project-filter") === state.filter; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
    var empty = $("#project-empty"); if (empty) empty.hidden = count > 0;
    setText($("#project-status"), count + " " + L(count === 1 ? "projeto nesta seleção" : "projetos nesta seleção", count === 1 ? "project in this selection" : "projects in this selection"));
    if (global.ZaionMotion) global.ZaionMotion.refresh();
  }
  function projectData(id) { return data.projects.find(function (project) { return project.id === id; }); }
  function updateCards() {
    $$("[data-project-card]").forEach(function (card) {
      var p = projectData(card.getAttribute("data-project-card")); if (!p) return;
      setText($("[data-project-title]",card), p.title); setText($("[data-project-summary]",card), p.summary[state.lang]); setText($("[data-project-status]",card), p.status[state.lang]);
      var tags = $("[data-project-tags]",card); if (tags) tags.innerHTML = p.tags[state.lang].map(function (tag) { return "<span>" + escapeHTML(tag) + "</span>"; }).join("");
      var image = $("img",card); if (image) image.alt = p.imageAlt[state.lang];
      $$("[data-project-open]", card).forEach(function (a) { a.setAttribute("aria-label", t("projects.open") + ": " + p.title); a.setAttribute("aria-haspopup", "dialog"); });
    });
    $$("[data-service-card]").forEach(function (card) { var service = data.services.find(function (s) { return s.id === card.getAttribute("data-service-card"); }); if (!service) return; setText($("[data-service-title]", card), service.title[state.lang]); setText($("[data-service-summary]", card), service.summary[state.lang]); });
    var select = $("#contact-service");
    if (select) Array.from(select.options).forEach(function (option) { var s = data.services.find(function (item) { return item.id === option.value; }); if (s) option.textContent = s.request[state.lang]; else option.textContent = t(option.value === "other" ? "form.service.other" : "form.service.placeholder"); });
  }
  function renderProject() {
    var p = projectData(state.project), root = $("#project-detail-content");
    if (!p || !root) return;
    setText($("#project-dialog-title"), p.title);
    var previewLabel = L("Prévia visual", "Visual preview"), imageLabel = L("Abrir imagem original", "Open original image");
    root.innerHTML =
      '<div class="project-detail-grid"><div class="project-preview' + (state.zoomed ? ' is-zoomed' : '') + '"><img src="' + escapeHTML(p.image) + '" alt="' + escapeHTML(p.imageAlt[state.lang]) + '" width="1000" height="700"></div>' +
      '<div class="project-detail-copy"><span class="status-badge">' + escapeHTML(p.status[state.lang]) + '</span><p class="project-lead">' + escapeHTML(p.summary[state.lang]) + '</p>' +
      '<div class="detail-tabs" role="tablist" aria-label="' + escapeHTML(t("projects.details")) + '">' +
      ['about','scope','preview'].map(function (id, i) { var names=[t("projects.details"),t("projects.deliverables"),previewLabel]; return '<button type="button" role="tab" id="project-tab-' + id + '" data-detail-tab="' + id + '" aria-controls="project-panel-' + id + '" aria-selected="' + (state.projectTab === id) + '" tabindex="' + (state.projectTab === id ? '0' : '-1') + '">' + escapeHTML(names[i]) + '</button>'; }).join('') + '</div>' +
      '<div class="detail-panel" id="project-panel-about" role="tabpanel" aria-labelledby="project-tab-about"' + (state.projectTab !== 'about' ? ' hidden' : '') + '><p>' + escapeHTML(p.detail[state.lang]) + '</p></div>' +
      '<div class="detail-panel" id="project-panel-scope" role="tabpanel" aria-labelledby="project-tab-scope"' + (state.projectTab !== 'scope' ? ' hidden' : '') + '><ul>' + p.deliverables[state.lang].map(function (line) { return '<li>' + escapeHTML(line) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="detail-panel" id="project-panel-preview" role="tabpanel" aria-labelledby="project-tab-preview"' + (state.projectTab !== 'preview' ? ' hidden' : '') + '><p>' + escapeHTML(L('Explore a imagem do trabalho. Propostas e demonstrações mantêm o status indicado na ficha.', 'Explore the project image. Proposals and demonstrations retain the status shown in this record.')) + '</p><div class="preview-actions"><button type="button" class="button button-small button-ghost" data-preview-zoom aria-pressed="' + state.zoomed + '">' + escapeHTML(state.zoomed ? L('Ajustar imagem','Fit image') : L('Ampliar imagem','Zoom image')) + '</button><a class="text-link" href="' + escapeHTML(p.image) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(imageLabel) + ' ↗</a></div></div>' +
      (p.url && /^https:\/\//.test(p.url) ? '<a class="button button-secondary" data-project-visit href="' + escapeHTML(p.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHTML(L(p.statusCode === 'demo' ? 'Explorar demo' : 'Visitar site', p.statusCode === 'demo' ? 'Explore demo' : 'Visit website')) + ' ↗</a>' : '') +
      '<button type="button" class="button button-primary" data-project-inquire="' + escapeHTML(p.id) + '">' + escapeHTML(t('projects.cta')) + ' ↗</button></div></div>';
  }
  function openProject(id, trigger) {
    if (!projectData(id)) return;
    state.project = id; state.projectTab = "about"; state.zoomed = false; renderProject(); openDialog($("#project-dialog"), trigger);
  }
  function selectProjectTab(id, focus) {
    if (["about","scope","preview"].indexOf(id) < 0) return;
    state.projectTab = id;
    $$("[data-detail-tab]").forEach(function (tab) { var active = tab.getAttribute("data-detail-tab") === id; tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1; if (active && focus) tab.focus(); });
    ["about","scope","preview"].forEach(function (key) { var panel = $("#project-panel-" + key); if (panel) panel.hidden = key !== id; });
  }
  function selectService(id, fromProject) {
    var service = data.services.find(function (s) { return s.id === id; }); if (!service) return;
    var select = $("#contact-service"); if (select) { select.value = service.id; select.setCustomValidity(""); select.removeAttribute("aria-invalid"); }
    var message = $("#contact-message");
    if (fromProject && message && !message.value.trim()) message.value = L("Gostaria de conversar sobre um projeto parecido com ", "I would like to discuss a project similar to ") + fromProject + ".";
    if (state.dialog) closeDialog(state.dialog, false);
    navigateTo("contact"); var name = $("#contact-name"); if (name) name.focus({ preventScroll: true }); updateMessageCounter();
  }
  async function copyEmail() {
    var ok = false;
    try { if (global.navigator.clipboard && global.isSecureContext) { await global.navigator.clipboard.writeText(data.site.email); ok = true; } } catch (_) {}
    if (!ok) {
      var previous = doc.activeElement, input = doc.createElement("textarea");
      input.value = data.site.email; input.setAttribute("readonly", ""); input.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      (state.dialog || doc.body).appendChild(input);
      try { input.select(); ok = !!doc.execCommand("copy"); } catch (_) {} input.remove();
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    }
    toast(t(ok ? "contact.emailCopied" : "contact.copyUnavailable")); return ok;
  }
  function printCV() { if (state.dialog) closeDialog(state.dialog, false); global.print(); }
  function commands() {
    var list = ["home","about","projects","stack","github","services","contact"].map(function (id) { return { id: "nav-" + id, title: t("nav." + id), group: t("palette.navigation"), keywords: id + " navegar section", run: function () { navigateTo(id); } }; });
    data.projects.forEach(function (p) { list.push({ id: "project-" + p.id, title: p.title, group: t("palette.projects"), keywords: p.kind + " projeto marca site " + p.tags[state.lang].join(" "), run: function (origin) { openProject(p.id, origin); } }); });
    [
      ["theme", t("palette.toggleTheme"), "dark light claro escuro", toggleTheme],
      ["language", t("palette.switchLanguage"), "pt en idioma language", function () { setLanguage(state.lang === "pt" ? "en" : "pt"); }],
      ["cv",t("palette.printCV"),"curriculo curriculum resume pdf",printCV],
      ["email",t("palette.copyEmail"),"email contato contact",copyEmail],
      ["motion",state.reduced ? L("Retomar animações","Resume animations") : L("Pausar animações","Pause animations"),"motion movimento acessibilidade accessibility",toggleMotion],
      ["whatsapp",t("palette.openWhatsApp"),"whatsapp contato contact",function () { global.location.assign("https://wa.me/" + data.site.phone); }],
      ["source",t("palette.openGitHub"),"github repositorio code",function () { global.open(data.site.github, "_blank", "noopener,noreferrer"); }]
    ].forEach(function (entry) { list.push({ id: entry[0], title: entry[1], group: t("palette.actions"), keywords: entry[2], run: entry[3] }); });
    ["all","dev","design"].forEach(function (id) { list.push({ id: "focus-" + id, title: t("palette.focus" + id.charAt(0).toUpperCase() + id.slice(1)), group: t("palette.focus"), keywords: "foco focus " + id, run: function () { setFocus(id); navigateTo("home"); } }); });
    return list;
  }
  function renderCommands() {
    var input = $("#command-search"), root = $("#command-results"); if (!input || !root) return;
    var query = normalise(input.value);
    state.commands = commands().filter(function (c) { return normalise(c.title + " " + c.keywords).indexOf(query) >= 0; });
    state.commandIndex = Math.max(0, Math.min(state.commandIndex, state.commands.length - 1));
    root.innerHTML = state.commands.map(function (c, index) { return '<div class="palette-option" role="option" id="command-option-' + index + '" data-command-index="' + index + '" aria-selected="' + (index === state.commandIndex) + '"><span><span class="palette-option-title">' + escapeHTML(c.title) + '</span><small>' + escapeHTML(c.group) + '</small></span><span aria-hidden="true">↵</span></div>'; }).join("");
    if (state.commands.length) input.setAttribute("aria-activedescendant", "command-option-" + state.commandIndex); else input.removeAttribute("aria-activedescendant");
    var empty = $("#command-empty"); if (empty) { empty.hidden = state.commands.length > 0; setText(empty, t("palette.empty")); }
  }
  function moveCommand(delta) {
    if (!state.commands.length) return;
    state.commandIndex = (state.commandIndex + delta + state.commands.length) % state.commands.length;
    $$("[data-command-index]").forEach(function (option) { option.setAttribute("aria-selected", String(Number(option.getAttribute("data-command-index")) === state.commandIndex)); });
    var input = $("#command-search"), option = $("#command-option-" + state.commandIndex); if (input && option) { input.setAttribute("aria-activedescendant", option.id); option.scrollIntoView({ block: "nearest" }); }
  }
  function executeCommand(index) {
    var command = state.commands[index]; if (!command) return;
    var dialog = $("#command-dialog"), origin = returnFocus.get(dialog) || state.commandOrigin;
    closeDialog(dialog, false);
    if (origin && origin.isConnected) origin.focus({ preventScroll: true });
    try { command.run(origin); } catch (_) { toast(L("Não foi possível concluir esta ação.", "This action could not be completed.")); }
  }
  function openCommands(trigger) {
    state.commandIndex = 0; state.commandOrigin = trigger || doc.activeElement;
    var input = $("#command-search"); if (input) input.value = "";
    renderCommands(); openDialog($("#command-dialog"), trigger);
  }
  function flipCard() {
    var card = $("#identity-card"); if (!card) return;
    state.flipped = !state.flipped; card.classList.toggle("is-flipped", state.flipped); card.setAttribute("aria-pressed", String(state.flipped));
    var front = $("[data-card-front]",card), back = $("[data-card-back]",card);
    if (front) front.setAttribute("aria-hidden", String(state.flipped));
    if (back) back.setAttribute("aria-hidden", String(!state.flipped));
    card.setAttribute("aria-label", state.flipped ? L("Voltar à frente do cartão de Zaion", "Return to the front of Zaion's card") : t("hero.flipAria"));
  }
  function renderFormStatus() {
    var root = $("#form-status"); if (!root || !state.formStatus) return;
    root.classList.toggle("is-error", state.formStatus.kind === "error");
    setText(root, t(state.formStatus.key));
    if (state.formStatus.url) {
      var a = doc.createElement("a"); a.href = state.formStatus.url; a.className = "text-link"; a.textContent = t("form.openWhatsApp") + " ↗";
      root.appendChild(doc.createTextNode(" ")); root.appendChild(a);
    }
  }
  function updateMessageCounter() {
    var field = $("#contact-message"), counter = $("#message-counter");
    if (field && counter) setText(counter, t("form.counter").replace("{count}", String(field.value.length)));
  }
  function submitContact(event) {
    event.preventDefault(); if (state.submitting) return;
    var form = $("#contact-form"), name = $("#contact-name"), service = $("#contact-service"), message = $("#contact-message");
    if (!form || !name || !service || !message) return;
    [name,service,message].forEach(function (field) { field.setCustomValidity(""); field.removeAttribute("aria-invalid"); });
    var checked = validForm({ name: name.value, service: service.value, message: message.value });
    if (!checked.valid) {
      var field = ({ name:name, service:service, message:message })[checked.field]; field.setCustomValidity(t(checked.key)); field.setAttribute("aria-invalid","true");
      state.formStatus = { kind:"error", key:checked.key }; renderFormStatus(); field.focus(); form.reportValidity(); return;
    }
    var url = makeWhatsAppURL(checked, state.lang);
    state.formStatus = { kind:"ready", key:"form.ready", url:url }; renderFormStatus(); state.submitting = true;
    try { global.location.assign(url); } catch (_) { state.submitting = false; }
    global.clearTimeout(timers.submit); timers.submit = global.setTimeout(function () { state.submitting = false; }, 1500);
  }
  function setLanguage(language, persist) {
    state.lang = choose(language, ["pt","en"], "pt");
    doc.documentElement.lang = state.lang === "pt" ? "pt-BR" : "en";
    doc.title = data.site.name + (state.lang === "pt" ? " — Desenvolvimento e Design" : " — Development & Design");
    translate(doc); updateCards(); updateClock(); resetWords(); themeButton(); motionButtons();
    var currentCard = $("#identity-card");
    if (currentCard) currentCard.setAttribute("aria-label", state.flipped ? L("Voltar à frente do cartão de Zaion", "Return to the front of Zaion's card") : t("hero.flipAria"));
    var languageButton = $("#language-toggle");
    if (languageButton) {
      var destination = state.lang === "pt" ? "en" : "pt";
      var destinationLabel = $("[data-language-code], [data-language-label]", languageButton);
      var languageAction = t(destination === "en" ? "language.toEnglish" : "language.toPortuguese");
      languageButton.setAttribute("aria-label", languageAction);
      languageButton.setAttribute("data-t-aria-label", destination === "en" ? "language.toEnglish" : "language.toPortuguese");
      languageButton.title = languageAction;
      setText(destinationLabel, destination.toUpperCase());
      if (destinationLabel) destinationLabel.setAttribute("lang", destination === "pt" ? "pt-BR" : "en");
    }
    if (state.project && state.dialog && state.dialog.id === "project-dialog") renderProject();
    if (state.dialog && state.dialog.id === "command-dialog") renderCommands();
    setProjectFilter(state.filter); renderFormStatus(); updateMessageCounter();
    if (state.dashboardReady && global.ZaionGitHub) global.ZaionGitHub.setLanguage(state.lang);
    if (persist !== false) { save(keys.lang,state.lang); updateURL(); }
    raf(updatePill);
    if (typeof global.CustomEvent === "function") doc.dispatchEvent(new global.CustomEvent("portfolio:languagechange", { detail:{lang:state.lang} }));
  }
  function onClick(event) {
    var target = event.target && typeof event.target.closest === "function" ? event.target : null; if (!target) return;
    var button;
    if ((button=target.closest("[data-close-dialog]"))) { event.preventDefault(); closeDialog(button.closest("dialog")); return; }
    if (target.closest("#menu-open")) { event.preventDefault(); openDialog($("#mobile-menu"),$("#menu-open")); return; }
    if (target.closest("#theme-toggle")) { event.preventDefault(); toggleTheme(event); return; }
    if (target.closest("#language-toggle")) { event.preventDefault(); setLanguage(state.lang === "pt" ? "en" : "pt"); return; }
    if ((button=target.closest("#command-open,[data-command-open]"))) { event.preventDefault(); openCommands(button); return; }
    if ((button=target.closest("[data-command-index]"))) { event.preventDefault(); executeCommand(Number(button.getAttribute("data-command-index"))); return; }
    if ((button=target.closest("[data-focus]"))) { event.preventDefault(); setFocus(button.getAttribute("data-focus")); return; }
    if ((button=target.closest("[data-project-filter]"))) { event.preventDefault(); setProjectFilter(button.getAttribute("data-project-filter")); return; }
    if ((button=target.closest("[data-project-open]"))) { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); openProject(button.getAttribute("data-project-open"),button); return; }
    if ((button=target.closest("[data-detail-tab]"))) { event.preventDefault(); selectProjectTab(button.getAttribute("data-detail-tab")); return; }
    if (target.closest("[data-preview-zoom]")) { event.preventDefault(); state.zoomed=!state.zoomed; renderProject(); var zoom=$("[data-preview-zoom]"); if(zoom)zoom.focus(); return; }
    if ((button=target.closest("[data-project-inquire]"))) { var p=projectData(button.getAttribute("data-project-inquire")); if(p) { event.preventDefault(); selectService(p.kind === "design" ? "brand" : "web",p.title); } return; }
    if ((button=target.closest("[data-service-select]"))) { event.preventDefault(); selectService(button.getAttribute("data-service-select")); return; }
    if (target.closest("[data-copy-email]")) { event.preventDefault(); copyEmail(); return; }
    if (target.closest("[data-print-cv]")) { event.preventDefault(); printCV(); return; }
    if (target.closest("[data-flip]")) { event.preventDefault(); flipCard(); return; }
    if (target.closest("[data-motion-toggle]")) { event.preventDefault(); toggleMotion(); return; }
    if ((button=target.closest("[data-skill]"))) {
      event.preventDefault(); var skill=button.getAttribute("data-skill");
      if (["HTML","CSS","JavaScript","Design"].indexOf(skill)>=0) { setProjectFilter(skill === "Design" ? "design" : "web"); navigateTo("projects"); }
      else { navigateTo("github"); if (state.dashboardReady && global.ZaionGitHub) global.ZaionGitHub.runQuery(skill === "Git" ? "SELECT name, language, stars FROM repos ORDER BY updated DESC" : "SELECT name, language, stars FROM repos WHERE language = '" + skill + "'"); }
      return;
    }
    if ((button=target.closest('a[href^="#"]'))) {
      var id=button.getAttribute("href").slice(1); if (id && doc.getElementById(id)) { event.preventDefault(); navigateTo(id); }
    }
  }
  function onKey(event) {
    var target=event.target, editing=target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase()==="k") { event.preventDefault(); var palette=$("#command-dialog"); if(palette && palette.open)closeDialog(palette); else openCommands(); return; }
    if(event.key==="/" && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); openCommands(); return; }
    if(event.key==="Escape") { hideIntro(); if(state.dialog) { event.preventDefault(); closeDialog(state.dialog); } return; }
    if(state.dialog && state.dialog.id==="command-dialog" && target && target.id==="command-search") {
      if(event.key==="ArrowDown" || event.key==="ArrowUp") { event.preventDefault(); moveCommand(event.key==="ArrowDown" ? 1 : -1); }
      else if(event.key==="Enter") { event.preventDefault(); executeCommand(state.commandIndex); }
    }
    if(target && target.hasAttribute && target.hasAttribute("data-detail-tab") && ["ArrowLeft","ArrowRight","Home","End"].indexOf(event.key)>=0) {
      event.preventDefault(); var tabs=["about","scope","preview"], index=tabs.indexOf(state.projectTab);
      index=event.key==="Home" ? 0 : event.key==="End" ? 2 : (index+(event.key==="ArrowRight" ? 1 : -1)+3)%3; selectProjectTab(tabs[index],true);
    }
  }
  function mediaListen(media,callback) { if(!media)return; if(typeof media.addEventListener==="function")media.addEventListener("change",callback); else if(typeof media.addListener==="function")media.addListener(callback); }
  function init() {
    if(state.initialised)return; state.initialised=true;
    var params;try { params=new global.URLSearchParams(global.location.search); } catch (_) { params={get:function(){return null;}}; }
    state.lang=resolvePreference(params.get("lang"),read(keys.lang),["pt","en"],data.site.defaultLanguage);
    state.focus=resolvePreference(params.get("focus"),read(keys.focus),["all","dev","design"],"all");
    reduceMedia=typeof global.matchMedia==="function" ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
    themeMedia=typeof global.matchMedia==="function" ? global.matchMedia("(prefers-color-scheme: light)") : null;
    state.paused=read(keys.motion)==="reduce"; state.osReduced=!!(reduceMedia&&reduceMedia.matches); state.reduced=state.paused||state.osReduced;
    var savedTheme=read(keys.theme); explicitTheme=savedTheme==="light"||savedTheme==="dark";
    applyTheme(explicitTheme?savedTheme:(themeMedia&&themeMedia.matches?"light":"dark"));
    bindDialogs(); doc.addEventListener("click",onClick); doc.addEventListener("keydown",onKey);
    var search=$("#command-search"); if(search)search.addEventListener("input",function(){state.commandIndex=0;renderCommands();});
    var form=$("#contact-form"); if(form) { form.noValidate=true;form.addEventListener("submit",submitContact); [$("#contact-name"),$("#contact-service"),$("#contact-message")].forEach(function(field){if(!field)return;field.addEventListener("input",function(){field.setCustomValidity("");field.removeAttribute("aria-invalid");updateMessageCounter();});field.addEventListener("change",function(){field.setCustomValidity("");field.removeAttribute("aria-invalid");});}); }
    var message=$("#contact-message"); if(message)message.maxLength=900;
    var name=$("#contact-name"); if(name)name.maxLength=80;
    setLanguage(state.lang,false); setFocus(state.focus,false);
    if(global.ZaionMotion)global.ZaionMotion.init({reduced:state.reduced});
    refreshMotion(); startClock();
    if(typeof global.IntersectionObserver==="function") {
      heroObserver=new global.IntersectionObserver(function(entries){entries.forEach(function(entry){state.heroVisible=entry.isIntersecting;if(state.heroVisible)resetWords();else stopWords();});},{threshold:0.05});
      var hero=$("#home");if(hero)heroObserver.observe(hero);
      sectionObserver=new global.IntersectionObserver(chooseActiveSection,{rootMargin:"-20% 0px -55% 0px",threshold:0});
      ["home","about","projects","stack","github","services","contact"].forEach(function(id){var node=doc.getElementById(id);if(node)sectionObserver.observe(node);});
    }
    global.addEventListener("scroll",onScroll,{passive:true});
    global.addEventListener("resize",function(){onScroll();raf(updatePill);if(state.dialog&&state.dialog.id==="mobile-menu"&&global.innerWidth>960)closeDialog(state.dialog);},{passive:true});
    global.addEventListener("popstate",function(){var id=global.location.hash.slice(1);if(doc.getElementById(id)) {var s=doc.getElementById(id);s.scrollIntoView({behavior:"auto"});setActive(id);}});
    global.addEventListener("pageshow",function(){state.submitting=false;});
    doc.addEventListener("visibilitychange",function(){if(doc.hidden){stopWords();global.clearTimeout(timers.clock);}else{resetWords();startClock();}});
    mediaListen(reduceMedia,refreshMotion);
    mediaListen(themeMedia,function(){if(!explicitTheme)applyTheme(themeMedia.matches?"light":"dark");});
    var dashboard=$("#github-dashboard");
    if(dashboard&&global.ZaionGitHub) { try { global.ZaionGitHub.init({root:dashboard,lang:state.lang});state.dashboardReady=true; } catch (_) { /* Static repository links remain usable. */ } }
    doc.documentElement.classList.add("app-ready");doc.documentElement.setAttribute("data-motion",state.reduced?"reduce":"full");
    setText($("#year"),new Date().getFullYear());updateURL();firstIntro();onScroll();raf(updatePill);
    if(global.location.hash) {var section=doc.getElementById(global.location.hash.slice(1));if(section)raf(function(){section.scrollIntoView({behavior:"auto"});});}
  }
  global.ZaionApp=Object.freeze({setLanguage:setLanguage,setFocus:setFocus,setProjectFilter:setProjectFilter,openProject:openProject,openCommands:openCommands,closeDialog:closeDialog,toggleTheme:toggleTheme,toggleMotion:toggleMotion,copyEmail:copyEmail,printCV:printCV,getState:function(){return {lang:state.lang,theme:state.theme,focus:state.focus,filter:state.filter,reduced:state.reduced,active:state.active};}});
  if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",init,{once:true});else init();
})(window);
