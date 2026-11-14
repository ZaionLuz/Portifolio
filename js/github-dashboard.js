/* ZAION — original, dependency-free GitHub dashboard. */
(function (global) {
  "use strict";
  var USER = "ZaionLuz";
  var API = "https://api.github.com";
  var CACHE = "zaion.github.public.v1";
  var TTL = 15 * 60 * 1000;
  var COLS = ["name", "language", "stars", "updated"];
  var DEFAULT_QUERY = "SELECT name, language, stars, updated FROM repos ORDER BY updated DESC";
  var COLORS = { JavaScript: "#f2d76b", TypeScript: "#77a9f7", HTML: "#f78052", CSS: "#aa8be8", Luau: "#7cc9ea", Lua: "#8b9eef", Python: "#84c69a", Java: "#df9d69" };
  var text = {
    pt: {
      title: "Código em movimento", subtitle: "Repositórios públicos de ZaionLuz",
      refresh: "Atualizar dados", refreshing: "Atualizando…", repos: "Repositórios listados", stars: "Estrelas recebidas", languages: "Linguagens principais",
      chartBytes: "Distribuição por bytes de código", chartRepos: "Repositórios por linguagem principal",
      chartNoteBytes: "Bytes classificados pelo GitHub nos repositórios listados. Isso não mede domínio de uma tecnologia.",
      chartNoteRepos: "Contagem de repositórios por linguagem principal. O detalhamento por bytes não está disponível nesta leitura.",
      noData: "Ainda não há dados verificados disponíveis nesta conexão.", noCode: "Nenhum código classificado nesta leitura.", queryLabel: "Consulta local dos repositórios",
      queryNote: "Uma interface inspirada em SQL para filtrar estes metadados públicos. A consulta roda neste navegador.",
      run: "Executar consulta", all: "Todos", recent: "Recentes", starred: "Com estrelas", empty: "Nenhum repositório corresponde à consulta.",
      result: "resultado", results: "resultados", of: "de", lastValid: "Mostrando a última consulta válida.",
      noLanguage: "Não classificada", open: "Abrir repositório", table: "Resultados da consulta sobre repositórios públicos",
      columns: { name: "Repositório", language: "Linguagem", stars: "Estrelas", updated: "Atualizado" },
      live: "Leitura da API pública", cache: "Cache local da API", snapshot: "Snapshot verificado", fallback: "Atualização indisponível",
      verified: "Verificado em", read: "Lido em", checking: "Consultando o GitHub…",
      rate: "O limite público do GitHub foi atingido. Tente atualizar mais tarde.",
      unavailable: "O GitHub não respondeu a tempo ou está indisponível nesta conexão.",
      retaining: "Os dados abaixo continuam disponíveis com a origem indicada.",
      partial: "O detalhamento por bytes não pôde ser carregado; o gráfico usa a linguagem principal de cada repositório.",
      capped: "A listagem foi limitada às primeiras 10 páginas da API.",
      queryErrors: {
        QUERY_SYNTAX: "Use SELECT name, language, stars, updated FROM repos, com WHERE, ORDER BY e LIMIT opcionais.",
        QUERY_COLUMN: "Colunas aceitas: name, language, stars e updated. Não repita colunas.",
        QUERY_WHERE: "Filtros aceitos: language = 'HTML', name = 'Portifolio' ou stars >= 1.",
        QUERY_ORDER: "Ordene por name, language, stars ou updated, usando ASC ou DESC.",
        QUERY_LIMIT: "LIMIT deve ser um inteiro entre 0 e 500."
      }
    },
    en: {
      title: "Code in motion", subtitle: "Public repositories by ZaionLuz",
      refresh: "Refresh data", refreshing: "Refreshing…", repos: "Listed repositories", stars: "Stars received", languages: "Primary languages",
      chartBytes: "Distribution by code bytes", chartRepos: "Repositories by primary language",
      chartNoteBytes: "Bytes classified by GitHub in the listed repositories. This does not measure technology proficiency.",
      chartNoteRepos: "Repository count by primary language. A byte breakdown is unavailable in this reading.",
      noData: "No verified data are available on this connection yet.", noCode: "No classified code in this reading.", queryLabel: "Local repository query",
      queryNote: "A SQL-inspired interface for filtering these public metadata. Queries run in this browser.",
      run: "Run query", all: "All", recent: "Recent", starred: "Starred", empty: "No repositories match this query.",
      result: "result", results: "results", of: "of", lastValid: "Showing the last valid query.",
      noLanguage: "Unclassified", open: "Open repository", table: "Query results for public repositories",
      columns: { name: "Repository", language: "Language", stars: "Stars", updated: "Updated" },
      live: "Public API reading", cache: "Local API cache", snapshot: "Verified snapshot", fallback: "Refresh unavailable",
      verified: "Verified on", read: "Read on", checking: "Checking GitHub…",
      rate: "GitHub's public rate limit was reached. Try refreshing later.",
      unavailable: "GitHub timed out or is unavailable on this connection.",
      retaining: "The data below remain available with their source indicated.",
      partial: "The byte breakdown could not be loaded; the chart uses each repository's primary language.",
      capped: "The list was limited to the first 10 API pages.",
      queryErrors: {
        QUERY_SYNTAX: "Use SELECT name, language, stars, updated FROM repos, optionally followed by WHERE, ORDER BY and LIMIT.",
        QUERY_COLUMN: "Accepted columns: name, language, stars and updated. Do not repeat columns.",
        QUERY_WHERE: "Accepted filters: language = 'HTML', name = 'Portifolio', or stars >= 1.",
        QUERY_ORDER: "Sort by name, language, stars or updated, using ASC or DESC.",
        QUERY_LIMIT: "LIMIT must be an integer between 0 and 500."
      }
    }
  };
  var state = { root: null, lang: "pt", repositories: [], bytesVerified: false, verifiedOn: "", fetchedAt: null, source: "snapshot", failure: null, busy: false, truncated: false, generation: 0, controller: null, query: DEFAULT_QUERY, validQuery: DEFAULT_QUERY, error: null, focusHint: null, available: false };
  function t() { return text[state.lang] || text.pt; }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function fail(code) { var e = new Error(code); e.code = code; throw e; }
  function parseQuery(input) {
    var q = String(input || "").trim().replace(/;\s*$/, "");
    if (!q || q.length > 1000 || /;|--|\/\*|\*\//.test(q)) fail("QUERY_SYNTAX");
    var match = /^SELECT\s+(.+?)\s+FROM\s+repos(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+([a-z]+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i.exec(q);
    if (!match) fail("QUERY_SYNTAX");
    var columns = match[1].trim() === "*" ? COLS.slice() : match[1].split(",").map(function (s) { return s.trim().toLowerCase(); });
    if (!columns.length || columns.some(function (c) { return COLS.indexOf(c) < 0; }) || new Set(columns).size !== columns.length) fail("QUERY_COLUMN");
    var filter = null;
    if (match[2]) {
      var str = /^(language|name)\s*=\s*'([^']{1,100})'$/i.exec(match[2].trim());
      var num = /^stars\s*(>=|<=|!=|=|>|<)\s*(\d{1,9})$/i.exec(match[2].trim());
      if (str) filter = { field: str[1].toLowerCase(), op: "=", value: str[2] };
      else if (num) filter = { field: "stars", op: num[1], value: Number(num[2]) };
      else fail("QUERY_WHERE");
    }
    var order = match[3] ? match[3].toLowerCase() : null;
    if (order && COLS.indexOf(order) < 0) fail("QUERY_ORDER");
    var limit = match[5] === undefined ? 500 : Number(match[5]);
    if (!Number.isSafeInteger(limit) || limit < 0 || limit > 500) fail("QUERY_LIMIT");
    return { columns: columns, filter: filter, order: order, direction: (match[4] || "ASC").toUpperCase(), limit: limit };
  }
  function queryRows(repositories, spec) {
    var rows = repositories.filter(function (r) {
      if (!spec.filter) return true;
      var f = spec.filter, v = r[f.field];
      if (f.field !== "stars") return String(v || "").toLowerCase() === f.value.toLowerCase();
      if (f.op === ">=") return v >= f.value;
      if (f.op === "<=") return v <= f.value;
      if (f.op === ">") return v > f.value;
      if (f.op === "<") return v < f.value;
      if (f.op === "!=") return v !== f.value;
      return v === f.value;
    }).slice();
    if (spec.order) rows.sort(function (a, b) {
      var x = a[spec.order], y = b[spec.order], compare;
      if (spec.order === "stars") compare = x - y;
      else compare = String(x || "").localeCompare(String(y || ""), "en", { sensitivity: "base" });
      if (!compare) compare = a.name.localeCompare(b.name, "en");
      return spec.direction === "DESC" ? -compare : compare;
    });
    return { columns: spec.columns.slice(), rows: rows.slice(0, spec.limit) };
  }
  function normalizeRepo(r) {
    if (!r || typeof r.name !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/.test(r.name)) throw new Error("DATA");
    if (r.private === true || (r.full_name && r.full_name.toLowerCase() !== (USER + "/" + r.name).toLowerCase())) throw new Error("DATA");
    var stars = r.stargazers_count === undefined ? r.stars : r.stargazers_count;
    var forks = r.forks_count === undefined ? r.forks : r.forks_count;
    var updated = r.updated_at || r.updated, pushed = r.pushed_at || r.pushed || updated;
    if (!Number.isSafeInteger(stars) || stars < 0 || !Number.isSafeInteger(forks) || forks < 0 || !Number.isFinite(Date.parse(updated))) throw new Error("DATA");
    if (r.language !== null && r.language !== undefined && (typeof r.language !== "string" || r.language.length > 60)) throw new Error("DATA");
    var languages = null;
    if (r.languages && typeof r.languages === "object" && !Array.isArray(r.languages)) {
      languages = {};
      Object.keys(r.languages).forEach(function (key) {
        var value = r.languages[key];
        if (!key || key.length > 60 || !Number.isSafeInteger(value) || value < 0) throw new Error("DATA");
        languages[key] = value;
      });
    }
    return { name: r.name, full_name: USER + "/" + r.name, description: typeof r.description === "string" ? r.description.slice(0, 1000) : "", language: r.language || null, stars: stars, forks: forks, updated: new Date(updated).toISOString(), pushed: Number.isFinite(Date.parse(pushed)) ? new Date(pushed).toISOString() : new Date(updated).toISOString(), url: "https://github.com/" + USER + "/" + encodeURIComponent(r.name), languages: languages, fork: !!r.fork, archived: !!r.archived };
  }
  function normalizedData(value) {
    if (!value || !Array.isArray(value.repositories) || value.repositories.length > 1000) throw new Error("DATA");
    var seen = new Set();
    var repos = value.repositories.map(normalizeRepo);
    repos.forEach(function (r) { if (seen.has(r.name.toLowerCase())) throw new Error("DATA"); seen.add(r.name.toLowerCase()); });
    return { repositories: repos, languageBytesVerified: value.languageBytesVerified === true && repos.every(function (r) { return r.languages !== null; }), verifiedOn: typeof value.verifiedOn === "string" ? value.verifiedOn : "", truncated: value.truncated === true };
  }
  function date(value, time) {
    if (!value) return "—";
    var v = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T12:00:00Z" : value;
    if (!Number.isFinite(Date.parse(v))) return "—";
    return new Intl.DateTimeFormat(state.lang === "en" ? "en-GB" : "pt-BR", { dateStyle: "medium", timeStyle: time ? "short" : undefined, timeZone: "America/Fortaleza" }).format(new Date(v));
  }
  function chartData() {
    var data = Object.create(null);
    state.repositories.forEach(function (r) {
      if (state.bytesVerified) Object.keys(r.languages || {}).forEach(function (key) { data[key] = (data[key] || 0) + r.languages[key]; });
      else { var key = r.language || t().noLanguage; data[key] = (data[key] || 0) + 1; }
    });
    var entries = Object.keys(data).map(function (key) { return { name: key, value: data[key] }; }).filter(function (e) { return e.value > 0; }).sort(function (a, b) { return b.value - a.value || a.name.localeCompare(b.name); });
    var total = entries.reduce(function (n, e) { return n + e.value; }, 0);
    return entries.map(function (e, i) { return { name: e.name, value: e.value, percent: total ? e.value / total * 100 : 0, color: Object.prototype.hasOwnProperty.call(COLORS, e.name) ? COLORS[e.name] : ["#a6b2c7", "#d3b4a4", "#a0bdad", "#b6a5c8"][i % 4] }; });
  }
  function sourceText() {
    var a = t();
    if (!state.available) return a.noData;
    var label = state.source === "live" ? a.live : state.source === "cache" ? a.cache : a.snapshot;
    var stamp = state.source === "snapshot" ? a.verified + " " + date(state.verifiedOn, false) : a.read + " " + date(state.fetchedAt, true);
    return label + " · " + stamp;
  }
  function render() {
    var root = state.root;
    if (!root) return;
    var a = t(), active = global.document.activeElement, queryFocused = active && active === root.querySelector("[data-gh-query]"), start = queryFocused ? active.selectionStart : 0, end = queryFocused ? active.selectionEnd : 0;
    var hint = null, oldWrap = root.querySelector(".gh-table-wrap"), oldScroll = oldWrap ? oldWrap.scrollLeft : 0;
    if (active && root.contains(active)) {
      if (active.matches("[data-gh-query]")) hint = "[data-gh-query]";
      else if (active.matches("[data-gh-action]")) hint = '[data-gh-action="' + active.dataset.ghAction + '"]';
      else if (active.matches("[data-gh-preset]")) hint = '[data-gh-preset="' + active.dataset.ghPreset + '"]';
      else if (active.matches("[data-gh-run]")) hint = "[data-gh-run]";
      else if (active.matches("[data-gh-repo]")) hint = '[data-gh-repo="' + active.dataset.ghRepo + '"]';
      else if (active.matches(".gh-table-wrap")) hint = ".gh-table-wrap";
      state.focusHint = hint;
    } else if (active && active !== global.document.body) state.focusHint = null;
    var chart = chartData(), result = queryRows(state.repositories, parseQuery(state.validQuery));
    var stars = state.repositories.reduce(function (n, r) { return n + r.stars; }, 0);
    var languageCount = new Set(state.repositories.map(function (r) { return r.language; }).filter(Boolean)).size;
    var chartTitle = state.bytesVerified ? a.chartBytes : a.chartRepos, chartNote = state.bytesVerified ? a.chartNoteBytes : a.chartNoteRepos;
    var status = state.busy ? a.checking : state.failure ? a.fallback + ". " + (state.failure === "RATE" ? a.rate : a.unavailable) + " " + (state.available ? a.retaining : a.noData) : sourceText();
    var notices = [];
    if (state.truncated) notices.push(a.capped);
    if (state.source === "live" && !state.bytesVerified && state.repositories.length) notices.push(a.partial);
    root.setAttribute("aria-busy", String(state.busy));
    root.innerHTML = '<div class="gh-head"><div><p class="gh-kicker">' + esc(a.subtitle) + '</p><h3>' + esc(a.title) + '</h3></div><button type="button" class="gh-button gh-refresh" data-gh-action="refresh"' + (state.busy ? ' disabled' : '') + '><span aria-hidden="true">↻</span> ' + esc(state.busy ? a.refreshing : a.refresh) + '</button></div>' +
      '<p class="gh-source" data-source="' + esc(state.source) + '"><span class="gh-dot" aria-hidden="true" data-state="' + (state.failure ? 'fallback' : state.source) + '"></span>' + esc(sourceText()) + '</p>' +
      '<p class="gh-status" role="status">' + esc(status) + '</p>' +
      '<div class="gh-metrics"><div class="gh-metric"><strong class="gh-number">' + (state.available ? state.repositories.length : '—') + '</strong><span>' + esc(a.repos) + '</span></div><div class="gh-metric"><strong class="gh-number">' + (state.available ? stars : '—') + '</strong><span>' + esc(a.stars) + '</span></div><div class="gh-metric"><strong class="gh-number">' + (state.available ? languageCount : '—') + '</strong><span>' + esc(a.languages) + '</span></div></div>' +
      '<div class="gh-main"><div class="gh-chart"><h4>' + esc(chartTitle) + '</h4><p class="gh-note">' + esc(chartNote) + '</p>' +
      (chart.length ? '<div class="gh-bar" role="img" aria-label="' + esc(chartTitle + ": " + chart.map(function (e) { return e.name + " " + e.percent.toFixed(1) + "%"; }).join(", ")) + '">' + chart.map(function (e) { return '<span class="gh-segment" style="--gh-share:' + e.percent.toFixed(5) + '%;--gh-color:' + e.color + '"></span>'; }).join("") + '</div><ul class="gh-legend">' + chart.map(function (e) { return '<li class="gh-item"><span class="gh-swatch" style="--gh-color:' + e.color + '" aria-hidden="true"></span><span>' + esc(e.name) + '</span><strong>' + e.percent.toFixed(1) + '%</strong></li>'; }).join("") + '</ul>' : '<p class="gh-empty">' + esc(state.available ? a.noCode : a.noData) + '</p>') +
      (notices.length ? '<p class="gh-note gh-notice">' + esc(notices.join(" ")) + '</p>' : '') + '</div>' +
      '<form class="gh-editor" data-gh-form><label for="gh-query">' + esc(a.queryLabel) + '</label><p id="gh-query-note" class="gh-note">' + esc(a.queryNote) + '</p><textarea id="gh-query" class="gh-query" data-gh-query maxlength="1000" rows="4" spellcheck="false" autocapitalize="off" aria-describedby="gh-query-note' + (state.error ? ' gh-query-error' : '') + '" aria-invalid="' + String(!!state.error) + '">' + esc(state.query) + '</textarea><div class="gh-presets"><button class="gh-chip" type="button" data-gh-preset="all">' + esc(a.all) + '</button><button class="gh-chip" type="button" data-gh-preset="recent">' + esc(a.recent) + '</button><button class="gh-chip" type="button" data-gh-preset="html">HTML</button><button class="gh-chip" type="button" data-gh-preset="luau">Luau</button><button class="gh-chip" type="button" data-gh-preset="starred">' + esc(a.starred) + '</button></div><button type="submit" class="gh-button gh-run" data-gh-run>' + esc(a.run) + ' <span aria-hidden="true">↗</span></button>' + (state.error ? '<p id="gh-query-error" class="gh-error" role="alert">' + esc(a.queryErrors[state.error] || a.queryErrors.QUERY_SYNTAX) + '</p>' : '') + '</form></div>' +
      '<p class="gh-results" aria-live="polite">' + (state.available ? result.rows.length + " " + esc(result.rows.length === 1 ? a.result : a.results) + " " + esc(a.of) + " " + state.repositories.length + (state.error ? " · " + esc(a.lastValid) : "") : esc(a.noData)) + '</p>' +
      '<div class="gh-table-wrap" tabindex="0" role="region" aria-label="' + esc(a.table) + '"><table class="gh-table"><caption class="gh-sr-only">' + esc(a.table) + '</caption><thead><tr>' + result.columns.map(function (c) { return '<th scope="col">' + esc(a.columns[c]) + '</th>'; }).join("") + '</tr></thead><tbody>' + (result.rows.length ? result.rows.map(function (r) { return '<tr>' + result.columns.map(function (c) { return '<td>' + (c === "name" ? '<a data-gh-repo="' + esc(r.name) + '" href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(a.open + ": " + r.name) + '">' + esc(r.name) + '<span aria-hidden="true"> ↗</span></a>' : c === "updated" ? '<time datetime="' + esc(r.updated) + '">' + esc(date(r.updated, false)) + '</time>' : c === "language" ? '<span class="gh-language">' + esc(r.language || a.noLanguage) + '</span>' : String(r.stars)) + '</td>'; }).join("") + '</tr>'; }).join("") : '<tr><td colspan="' + result.columns.length + '" class="gh-empty">' + esc(state.available ? a.empty : a.noData) + '</td></tr>') + '</tbody></table></div>';
    var freshWrap = root.querySelector(".gh-table-wrap");
    if (freshWrap) freshWrap.scrollLeft = oldScroll;
    if (queryFocused) { var field = root.querySelector("[data-gh-query]"); field.focus({ preventScroll: true }); field.setSelectionRange(start, end); }
    else if (state.focusHint) { var target = root.querySelector(state.focusHint); if (target && !target.disabled) target.focus({ preventScroll: true }); }
  }
  function runQuery(query) {
    state.query = String(query === undefined ? state.query : query);
    try {
      var spec = parseQuery(state.query);
      state.validQuery = state.query; state.error = null; render();
      return { ok: true, result: queryRows(state.repositories, spec) };
    } catch (error) {
      state.error = error.code || "QUERY_SYNTAX"; render();
      return { ok: false, error: state.error, result: queryRows(state.repositories, parseQuery(state.validQuery)) };
    }
  }
  function useData(data, source, stamp) {
    var value = normalizedData(data);
    if (source === "snapshot" && (!/^\d{4}-\d{2}-\d{2}$/.test(value.verifiedOn) || !Number.isFinite(Date.parse(value.verifiedOn)))) throw new Error("DATA");
    state.available = true;
    state.repositories = value.repositories; state.bytesVerified = value.languageBytesVerified; state.verifiedOn = value.verifiedOn; state.truncated = value.truncated; state.source = source; state.fetchedAt = stamp || null;
  }
  function loadCache() {
    try {
      var value = JSON.parse(global.sessionStorage.getItem(CACHE) || "null"), age = value && Date.now() - value.timestamp;
      if (!value || value.schema !== 1 || value.username !== USER || !Number.isFinite(age) || age < 0 || age > TTL) return false;
      useData(value.data, "cache", new Date(value.timestamp).toISOString()); return true;
    } catch (_) { return false; }
  }
  function saveCache(data, stamp) {
    try { global.sessionStorage.setItem(CACHE, JSON.stringify({ schema: 1, username: USER, timestamp: stamp, data: data })); } catch (_) {}
  }
  async function fetchJSON(url, parentSignal) {
    var controller = new AbortController();
    var stop = function () { controller.abort(); };
    if (parentSignal.aborted) stop(); else parentSignal.addEventListener("abort", stop, { once: true });
    var timeout = global.setTimeout(stop, 6500);
    try {
      var response = await global.fetch(url, { signal: controller.signal, headers: { Accept: "application/vnd.github+json" }, credentials: "omit", referrerPolicy: "no-referrer" });
      if (!response.ok) { var e = new Error("HTTP"); e.code = response.status === 403 || response.status === 429 ? "RATE" : "HTTP"; throw e; }
      return { data: await response.json(), link: response.headers.get("Link") || "" };
    } finally { global.clearTimeout(timeout); parentSignal.removeEventListener("abort", stop); }
  }
  async function readLive(signal) {
    var repositories = [], page = 1, more = true;
    while (more && page <= 10) {
      var response = await fetchJSON(API + "/users/" + USER + "/repos?type=owner&sort=updated&per_page=100&page=" + page, signal);
      if (!Array.isArray(response.data)) throw new Error("DATA");
      repositories = repositories.concat(response.data.map(normalizeRepo));
      more = /rel="next"/.test(response.link); page += 1;
    }
    var data = normalizedData({ repositories: repositories, languageBytesVerified: false, truncated: more });
    if (data.repositories.length > 0 && data.repositories.length <= 12) {
      var reads = await Promise.allSettled(data.repositories.map(function (r) { return fetchJSON(API + "/repos/" + USER + "/" + encodeURIComponent(r.name) + "/languages", signal); }));
      var all = true;
      reads.forEach(function (r, i) {
        if (r.status === "fulfilled" && r.value.data && typeof r.value.data === "object" && !Array.isArray(r.value.data)) {
          try { data.repositories[i] = normalizeRepo(Object.assign({}, data.repositories[i], { languages: r.value.data })); } catch (_) { all = false; }
        } else all = false;
      });
      data.languageBytesVerified = all;
    }
    return data;
  }
  async function refresh() {
    if (!state.root || state.busy) return false;
    state.busy = true; state.failure = null; render();
    var generation = state.generation, controller = new AbortController();
    state.controller = controller;
    var flowTimeout = global.setTimeout(function () { controller.abort(); }, 16000);
    try {
      var data = await readLive(controller.signal);
      if (state.generation !== generation) return false;
      var stamp = Date.now();
      useData(data, "live", new Date(stamp).toISOString()); saveCache(data, stamp); state.failure = null;
      return true;
    } catch (error) {
      if (state.generation === generation) state.failure = error.code === "RATE" ? "RATE" : "NETWORK";
      return false;
    } finally {
      global.clearTimeout(flowTimeout);
      if (state.generation === generation) { state.busy = false; state.controller = null; render(); }
    }
  }
  function click(event) {
    var action = event.target.closest("[data-gh-action]"), preset = event.target.closest("[data-gh-preset]");
    if (action && state.root.contains(action) && action.dataset.ghAction === "refresh") refresh();
    if (preset && state.root.contains(preset)) {
      var queries = { all: DEFAULT_QUERY, recent: DEFAULT_QUERY + " LIMIT 3", html: "SELECT name, language, stars FROM repos WHERE language = 'HTML' ORDER BY stars DESC", luau: "SELECT name, language, stars FROM repos WHERE language = 'Luau'", starred: "SELECT name, language, stars FROM repos WHERE stars >= 1 ORDER BY stars DESC" };
      runQuery(queries[preset.dataset.ghPreset] || DEFAULT_QUERY);
    }
  }
  function input(event) { if (event.target.matches("[data-gh-query]")) state.query = event.target.value; }
  function submit(event) { if (event.target.matches("[data-gh-form]")) { event.preventDefault(); runQuery(state.root.querySelector("[data-gh-query]").value); } }
  function detach() {
    if (state.controller) state.controller.abort();
    if (state.root) { state.root.removeEventListener("click", click); state.root.removeEventListener("input", input); state.root.removeEventListener("submit", submit); }
    state.generation += 1; state.busy = false; state.controller = null;
  }
  function init(options) {
    detach();
    state.root = options && options.root;
    if (!state.root || typeof state.root.querySelector !== "function") throw new Error("ZaionGitHub.init requires a dashboard element.");
    state.lang = options.lang === "en" ? "en" : "pt"; state.failure = null; state.query = DEFAULT_QUERY; state.validQuery = DEFAULT_QUERY; state.error = null;
    state.available = false; state.repositories = []; state.bytesVerified = false; state.source = "unavailable"; state.verifiedOn = ""; state.fetchedAt = null; state.truncated = false;
    if (global.ZaionGitHubSnapshot) { try { useData(global.ZaionGitHubSnapshot, "snapshot", null); } catch (_) {} }
    var cached = loadCache();
    state.root.addEventListener("click", click); state.root.addEventListener("input", input); state.root.addEventListener("submit", submit);
    render();
    if (!cached) refresh();
    return global.ZaionGitHub;
  }
  function setLanguage(language) { state.lang = language === "en" ? "en" : "pt"; render(); }
  global.ZaionGitHub = Object.freeze({ init: init, setLanguage: setLanguage, refresh: refresh, runQuery: runQuery, parseQuery: parseQuery, queryRows: queryRows, destroy: function () { detach(); state.root = null; } });
})(window);
