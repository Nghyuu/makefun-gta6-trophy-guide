// GTA VI trophy guide & tracker. Classic script, no modules, no network at runtime:
// it loads app/data/trophies.json (same folder) and keeps progress in localStorage.
(function () {
  'use strict';

  var KEY = 'gta6-trophy-guide-progress-v1';
  var SOURCE_LINKS = {
    'PowerPyx trophy guide': 'https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/',
    'Exophase official list': 'https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/',
    'PSNProfiles official list': 'https://psnprofiles.com/trophies/43531-grand-theft-auto-vi',
    'OutputLag trophy list': 'https://outputlag.com/guides/gta-6-trophy-list/'
  };
  var STAGES = [
    { n: 1, title: 'Stage 1 — Play the story: Chapters 1–2', blurb: 'Do the Chapter 1 meditation FIRST (the one missable trophy), then play the story and pick up the early side quests as they appear.',
      ids: [28, 2, 20, 21, 3, 8, 23, 4, 46, 24, 29, 54, 55] },
    { n: 2, title: 'Stage 2 — Story: Chapters 3–5 + side finales', blurb: 'Finish the story, then close out the side-character questlines. Everything here stays available after the credits.',
      ids: [9, 5, 22, 26, 27, 10, 11, 12, 6, 13, 7, 25] },
    { n: 3, title: 'Stage 3 — Free-roam: the 100% checklist grind', blurb: 'After the story the 100% checklist opens (Progress > Stats > 100% Completion). Work through it; most trophies below pop along the way.',
      ids: [14, 15, 35, 31, 30, 32, 16, 17, 18, 19, 33, 34, 39, 40, 41, 36, 37, 38, 42, 43, 47, 48, 52, 53] },
    { n: 4, title: 'Stage 4 — Cleanup & the unknowns', blurb: 'Five trophies have no confirmed unlock method yet (PowerPyx, 18 Nov 2026). Check the guides; they may pop while you play. Then the platinum.',
      ids: [44, 45, 49, 50, 51, 1] }
  ];
  var ROADMAP_ORDER = [];
  STAGES.forEach(function (s) { ROADMAP_ORDER = ROADMAP_ORDER.concat(s.ids); });

  var params = new URLSearchParams(location.search);
  var seedParam = params.get('seed');
  var tab = params.get('tab') || 'tracker';
  var openId = params.get('open') ? Number(params.get('open')) : null;
  var spoilersParam = params.get('spoilers') === 'on';

  var trophies = [];
  var byId = {};
  var earned = new Set();
  var seeded = false;

  function loadSaved() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) JSON.parse(raw).forEach(function (id) { earned.add(id); });
    } catch (e) { /* fresh start */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(earned).sort(function (a, b) { return a - b; }))); }
    catch (e) { /* storage unavailable */ }
  }
  // Deterministic seed: shuffle ids with a tiny LCG, take the first N as earned.
  function applySeed(n) {
    var ids = trophies.map(function (t) { return t.id; });
    var s = 1234567 + n * 2654435761;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    }
    earned = new Set(ids.slice(0, Math.max(0, Math.min(n, ids.length))));
    seeded = true;
  }

  var view = document.getElementById('view');
  var searchEl = document.getElementById('search');
  var kindEl = document.getElementById('kind');
  var gradeEl = document.getElementById('grade');
  var earnedEl = document.getElementById('earnedFilter');
  var spoilerEl = document.getElementById('spoilers');
  var controls = document.getElementById('controls');
  var nextUpEl = document.getElementById('nextUp');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtTarget(t) {
    if (t.target == null) return '';
    return t.target.toLocaleString('en-US');
  }
  function isHidden(t) { return t.hidden && spoilerEl.checked && !earned.has(t.id); }
  function displayName(t) { return isHidden(t) ? 'Hidden trophy' : t.name; }
  function displayDesc(t) { return isHidden(t) ? 'Hidden until earned — its name and description are a spoiler.' : t.description; }

  function gradeCounts() {
    var grades = ['platinum', 'gold', 'silver', 'bronze'];
    var out = grades.map(function (g) {
      var total = trophies.filter(function (t) { return t.grade === g; }).length;
      var got = trophies.filter(function (t) { return t.grade === g && earned.has(t.id); }).length;
      return '<b>' + got + '/' + total + '</b> ' + g;
    });
    document.getElementById('gradeCounts').innerHTML = out.join(' &middot; ');
    document.getElementById('progressBig').textContent = earned.size + ' / ' + trophies.length + ' earned';
    document.getElementById('progressFill').style.width = (trophies.length ? (earned.size / trophies.length * 100) : 0) + '%';
  }
  function nextUp() {
    var next = null;
    for (var i = 0; i < ROADMAP_ORDER.length; i++) {
      if (!earned.has(ROADMAP_ORDER[i])) { next = byId[ROADMAP_ORDER[i]]; break; }
    }
    if (!next) {
      nextUpEl.innerHTML = '<b>Platinum earned!</b> Vice Got a Price! is yours — you are a Leonida Legend.';
      return;
    }
    var stage = next.stage;
    nextUpEl.innerHTML = '<b>Next up:</b> ' + esc(displayName(next)) + ' — ' + esc(displayDesc(next)) +
      ' <span style="color:#c9bfe0">(Roadmap stage ' + stage + ' &middot; ' + esc(next.grade) + ')</span>';
  }

  function sourceLinks(t) {
    return t.sources.map(function (s) {
      var href = SOURCE_LINKS[s];
      return href ? '<a href="' + href + '">' + esc(s) + '</a>' : esc(s);
    }).join('; ');
  }

  function card(t, showGuide) {
    var div = document.createElement('div');
    div.className = 'card' + (earned.has(t.id) ? ' earned' : '') + (t.missable ? ' missable' : '');
    var head = document.createElement('div');
    head.className = 'card-head';
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earned.has(t.id);
    box.setAttribute('aria-label', 'Mark ' + t.name + ' as earned');
    box.addEventListener('change', function () {
      if (box.checked) earned.add(t.id); else earned.delete(t.id);
      if (!seeded) save();
      render();
    });
    var h = document.createElement('h2');
    h.innerHTML = '<span class="num">#' + t.id + '</span>' + esc(displayName(t));
    head.appendChild(box);
    var wrap = document.createElement('div');
    wrap.appendChild(h);
    var d = document.createElement('p');
    d.className = 'desc';
    d.textContent = displayDesc(t);
    wrap.appendChild(d);
    head.appendChild(wrap);
    div.appendChild(head);
    var tags = document.createElement('div');
    tags.className = 'tags';
    var tagHtml = '<span class="tag ' + t.grade + '">' + t.grade + '</span>' +
      '<span class="tag">' + t.kind + '</span>' +
      (t.hidden ? '<span class="tag hidden">Hidden</span>' : '') +
      (t.missable ? '<span class="tag missable">Missable</span>' : '') +
      (t.target != null ? '<span class="tag target">Progress: 0/' + fmtTarget(t) + '</span>' : '');
    tags.innerHTML = tagHtml;
    div.appendChild(tags);
    if (!isHidden(t)) {
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'guide-toggle';
      toggle.textContent = showGuide ? 'Hide guide' : 'Show guide';
      var guide = document.createElement('div');
      guide.className = 'guide';
      guide.style.display = showGuide ? 'block' : 'none';
      guide.innerHTML = '<p>' + esc(t.guide) + '</p><p class="src">Sources: ' + sourceLinks(t) + '</p>';
      toggle.addEventListener('click', function () {
        var open = guide.style.display === 'none';
        guide.style.display = open ? 'block' : 'none';
        toggle.textContent = open ? 'Hide guide' : 'Show guide';
      });
      div.appendChild(toggle);
      div.appendChild(guide);
    }
    return div;
  }

  function renderTracker() {
    controls.style.display = 'flex';
    var q = (searchEl.value || '').toLowerCase();
    var list = trophies.filter(function (t) {
      if (kindEl.value !== 'all' && t.kind !== kindEl.value) return false;
      if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
      if (earnedEl.value === 'earned' && !earned.has(t.id)) return false;
      if (earnedEl.value === 'unearned' && earned.has(t.id)) return false;
      if (q && (t.name.toLowerCase().indexOf(q) === -1 && t.description.toLowerCase().indexOf(q) === -1 && t.guide.toLowerCase().indexOf(q) === -1)) return false;
      return true;
    });
    view.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'count';
    p.textContent = 'Showing ' + list.length + ' of ' + trophies.length + ' trophies' + (seeded ? ' (seeded demo progress — your saved ticks are untouched)' : '');
    view.appendChild(p);
    if (!list.length) {
      var e = document.createElement('p');
      e.className = 'empty';
      e.textContent = 'No trophies match these filters.';
      view.appendChild(e);
      return;
    }
    list.forEach(function (t) { view.appendChild(card(t, t.id === openId)); });
  }

  function renderRoadmap() {
    controls.style.display = 'none';
    view.innerHTML = '';
    var intro = document.createElement('div');
    intro.className = 'callout';
    intro.innerHTML = '<h2>Road to the platinum — about 200 hours, difficulty 4/10</h2>' +
      '<p>One playthrough is enough. There is no mission replay and no New Game+, so keep manual saves at the start of each chapter (15 manual slots). Cheats disable trophies and saving. After the story, free-roam stays open and everything except the Chapter 1 meditation is still doable.</p>' +
      '<p>Source: <a href="https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/">PowerPyx GTA 6 Trophy Guide &amp; Roadmap</a> (18 Nov 2026).</p>';
    view.appendChild(intro);
    STAGES.forEach(function (s) {
      var sec = document.createElement('div');
      sec.className = 'stage';
      var h = document.createElement('h2');
      h.textContent = s.title;
      var b = document.createElement('p');
      b.textContent = s.blurb;
      var ol = document.createElement('ol');
      s.ids.forEach(function (id) {
        var t = byId[id];
        var li = document.createElement('li');
        if (earned.has(id)) li.className = 'done';
        li.innerHTML = esc(displayName(t)) + ' <span class="g">' + t.grade + (t.missable ? ' · missable' : '') + (t.hidden ? ' · hidden' : '') + '</span>';
        ol.appendChild(li);
      });
      sec.appendChild(h);
      sec.appendChild(b);
      sec.appendChild(ol);
      view.appendChild(sec);
    });
  }

  function renderMissables() {
    controls.style.display = 'none';
    view.innerHTML = '';
    var alert = document.createElement('div');
    alert.className = 'alert';
    alert.innerHTML = '<h2>Only one trophy can be missed</h2>' +
      '<p><b>Positive Mental Attitude</b> — meditate at every spot across Leonida. The first meditation happens in Chapter 1 at Jason\u2019s house: after the mission Down to Earth, talk to Lucia in the kitchen in the morning, follow her to the balcony and accept. It becomes permanently unavailable after Chapter 1. It is not yet confirmed whether this meditation is strictly required for the trophy, so do it anyway and keep a Chapter 1 save until the trophy pops.</p>' +
      '<p>Source: <a href="https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/">PowerPyx trophy guide</a> (roadmap Step 1). The other 54 trophies cannot be missed: every side questline, character and collectible stays available in free-roam after the story.</p>';
    view.appendChild(alert);
    var save = document.createElement('div');
    save.className = 'callout';
    save.innerHTML = '<h2>Save discipline (no mission replay)</h2>' +
      '<ul><li>Keep one manual save at the start of each chapter (5 chapters) and one from just before the final mission.</li>' +
      '<li>Do Lucia\u2019s balcony meditation the morning after Down to Earth, in Chapter 1.</li>' +
      '<li>Never use cheats on your trophy save: they disable trophies and saving.</li>' +
      '<li>Optional missions with an hourglass icon are time-sensitive, but none of them gate a trophy.</li></ul>' +
      '<p>Source: PowerPyx trophy guide, Steps 1–2.</p>';
    view.appendChild(save);
    var h = document.createElement('h2');
    h.textContent = 'The missable trophy in full';
    h.style.cssText = 'font-size:24px;margin:4px 0 12px';
    view.appendChild(h);
    view.appendChild(card(byId[28], true));
    var hidden = document.createElement('div');
    hidden.className = 'callout';
    hidden.innerHTML = '<h2>Hidden trophies: 28 of 55</h2>' +
      '<p>Their names stay secret on PlayStation until earned. The visible 27 and hidden 28 split is from the <a href="https://outputlag.com/guides/gta-6-trophy-list/">OutputLag trophy list</a>, which agrees with PowerPyx and GTABase. Turn on \u201cHide spoilers\u201d in the Tracker to keep hidden names and descriptions masked until you earn them.</p>';
    view.appendChild(hidden);
  }

  function renderSources() {
    controls.style.display = 'none';
    view.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'callout';
    div.innerHTML = '<h2>Sources</h2>' +
      '<p>Every guide in this app names its sources beside it. Official trophy names, descriptions and grades are shown as PlayStation publishes them; the guide text is written in our own words and never copied from a source.</p>' +
      '<ol class="src-list">' +
      '<li><a href="https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/">PowerPyx — GTA 6 Trophy Guide &amp; Roadmap</a> (18 Nov 2026). Primary guide source: difficulty 4/10, ~200 hours to platinum, the one missable trophy, 100% checklist numbers (200 of 277 vehicles, 100 of 255 animals, 70 of 80 challenges), and the per-trophy methods.</li>' +
      '<li><a href="https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/">Exophase — Grand Theft Auto VI Trophies (PS5)</a>. Official trophy list: names, descriptions, grades.</li>' +
      '<li><a href="https://psnprofiles.com/trophies/43531-grand-theft-auto-vi">PSNProfiles — Grand Theft Auto VI Trophies</a>. Official trophy list with per-trophy progress counters (e.g. 0/250 stunts, 0/18 meditations).</li>' +
      '<li><a href="https://outputlag.com/guides/gta-6-trophy-list/">OutputLag — GTA 6 Trophy List</a>. Visible-27 / hidden-28 split and confirmation of the one missable trophy.</li>' +
      '<li><a href="https://gta-zone.com/news/gta-6-trophies-achievements/">GTA Zone — GTA 6 Trophy List</a>. Cross-check for the 55-trophy list and hidden count.</li>' +
      '</ol>' +
      '<h3>What is not confirmed yet</h3>' +
      '<p>Five trophies have no published unlock method at launch (PowerPyx, 18 Nov 2026): In The Beginning…, Capital Offense, Bad Luck, I Guess, The Truth Is Out There and Ten Pin. Their guides say so plainly instead of inventing a method. Where a place or step is not pinned down by any source, the guide says \u201cnot yet confirmed\u201d.</p>';
    view.appendChild(div);
  }

  function render() {
    gradeCounts();
    nextUp();
    if (tab === 'roadmap') renderRoadmap();
    else if (tab === 'missables') renderMissables();
    else if (tab === 'sources') renderSources();
    else renderTracker();
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
  }

  function setTab(t) {
    tab = t;
    var url = new URL(location.href);
    url.searchParams.set('tab', t);
    history.replaceState(null, '', url);
    render();
  }

  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
  });
  [searchEl, kindEl, gradeEl, earnedEl].forEach(function (el) {
    el.addEventListener('input', renderTracker);
    el.addEventListener('change', renderTracker);
  });
  spoilerEl.addEventListener('change', function () { if (!seeded) save(); render(); });

  document.getElementById('export').addEventListener('click', function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ game: 'GTA VI', earned: Array.from(earned).sort(function (x, y) { return x - y; }) }, null, 2)], { type: 'application/json' }));
    a.download = 'gta6-trophy-progress.json';
    a.click();
  });
  document.getElementById('import').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var ids = Array.isArray(data) ? data : data.earned;
        earned = new Set((ids || []).filter(function (id) { return byId[id]; }));
        save();
        render();
      } catch (err) { alert('That file is not a valid progress export.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  if (spoilersParam) spoilerEl.checked = true;

  fetch('data/trophies.json')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (doc) {
      trophies = doc.trophies || doc;
      trophies.forEach(function (t) { byId[t.id] = t; });
      loadSaved();
      if (seedParam != null && !isNaN(Number(seedParam))) applySeed(Number(seedParam));
      render();
      window.__shotReady = true;
    })
    .catch(function (err) {
      view.innerHTML = '<p class="empty">Could not load the trophy data (data/trophies.json). Open this app over HTTP, or in a browser that allows local file access, and reload. Error: ' + esc(err.message) + '</p>';
      window.__shotReady = true;
    });
})();
