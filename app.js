/* Gym log: a phone workout log for a home gym.
   Everything stays on this phone (localStorage) until "Send to PC" shares a JSON file, which the owner's desktop app reads.
   No account, no server, nothing personal in this code: a four-day upper/lower routine,
   the main lifts follow a 5-3-1 plan, and the back rules follow a rehab tracker's pain scale. */
(function () {
  'use strict';
  var KEY = 'gym.v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var ymd = function (d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var hm = function (d) { d = d || new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var dmy = function (s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; };

  // ---------- the plan
  // main lifts: the 5-3-1 plan: warm-up 40/50/60% x 5/5/3, then the week's three sets (the last one "+": as many as you can)
  var MAIN = { squat: 'Back squat', bench: 'Bench press', deadlift: 'Deadlift', press: 'Overhead press' };
  var LOWER = { squat: 1, deadlift: 1 };
  var WEEKS = {
    1: { p: [65, 75, 85], r: ['5', '5', '5+'] },
    2: { p: [70, 80, 90], r: ['3', '3', '3+'] },
    3: { p: [75, 85, 95], r: ['5', '3', '1+'] },
    4: { p: [40, 50, 60], r: ['5', '5', '5'] }   // deload
  };
  var WARM = { p: [40, 50, 60], r: ['5', '5', '3'] };
  // the routine (Lower A, Upper A, Lower B, Upper B); "main" marks the 5-3-1 lift of the day
  var DAYS = {
    'Lower A': [['Jump lunges + squat pry + ankle rocks', '2 x 10'], ['Box jumps', '2 x 5'], ['Kettlebell swings', '2 x 6'], ['main', 'squat'], ['Single-leg / Romanian deadlift', '3-4 x 5-8'], ['Lunges', '2-5 x 20 each'], ['Calf raises', '3 x 10-15'], ['Front plank / loaded carry', '3 x 30 s / 10']],
    'Upper A': [['Wall slides / T-spine rotations / band pull-aparts', '2 x 10-15'], ['Medball chest pass / scoop toss', '2 x 4-6'], ['Speed bench / explosive push-ups + rotator cuff', '2 x 3-5'], ['main', 'bench'], ['Barbell row', '4 x 5-8'], ['Incline dumbbell press', '3 x 8-12'], ['One-arm dumbbell row', '2-5 x 12'], ['Face pull + triceps pushdown', '2 x 8-12'], ['Lateral raise + dumbbell curl', '2 x 8-12']],
    'Lower B': [['Hip airplanes + 90/90 transitions + ankle work', '2 x 10'], ['Broad jumps / split-squat jumps', '2 x 5'], ['Trap bar jump deadlift / DB jump squats', '2 x 3-5'], ['main', 'deadlift'], ['Leg press / front squat', '3-4 x 6-8'], ['Bulgarian split squat / step-up', '3 x 8-12'], ['Hip thrust / glute bridge', '3 x 8-12'], ['Hamstring curl / back extension + forearm curl', '3 x 10-15']],
    'Upper B': [['Band dislocates + scapular CARs + T-spine mobility', '2 sets'], ['Overhead medball slam / overhead throw', '2 x 4-6'], ['DB push press / push jerk + pull-ups', '2 x 3-5'], ['Weighted pull-ups', '4 x 4-8'], ['main', 'press'], ['Seated cable row', '3 x 8-12'], ['Dips / incline bench press', '3 x 8-12'], ['Face pulls + rotator cuff', '3 x 12-20'], ['Biceps + triceps isolation', '3 x 10-12']]
  };
  var ORDER = ['Lower A', 'Upper A', 'Lower B', 'Upper B'];
  // the rehab tracker: the daily core and glute stability block
  var REHAB = ['Dead bugs (2-3 x 10-12 each side)', 'Bird-dog (2-3 x 10-12 each side)', 'Glute bridges (2-3 x 12-15)', 'Single-leg bridges (2-3 x 8-10 each leg)', 'Side plank (2 x 20-30 s each side)'];
  var CARDIO = ['Rowing', 'Cycling', 'Jogging', 'Sprints', 'Rope waves', 'Walking', 'Other'];

  // ---------- storage
  function load() { var s; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {} s = s || {};
    s.settings = s.settings || {}; var st = s.settings;
    st.tm = st.tm || { squat: null, bench: null, deadlift: null, press: null };
    st.inc = st.inc || { lower: 5, upper: 2.5 };
    st.week = st.week || { squat: 1, bench: 1, deadlift: 1, press: 1 };
    st.cycle = st.cycle || { squat: 1, bench: 1, deadlift: 1, press: 1 };
    st.bar = st.bar || 20;
    st.plates = st.plates || [20, 15, 10, 10, 10, 5, 5, 2.5];   // one side: from the plates 2x20, 2x15, 6x10, 4x5, 2x2.5
    s.sessions = s.sessions || []; s.sent = s.sent || {}; return s; }
  var S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save on this phone (storage full?)'); } }
  if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }

  // ---------- weights you can load
  function loadable() { var p = S.settings.plates, sums = { 0: [] };
    p.forEach(function (w) { Object.keys(sums).forEach(function (k) { var n = Math.round((+k + w) * 10) / 10; if (!sums[n] || sums[n].length > sums[k].length + 1) sums[n] = sums[k].concat([w]); }); });
    return Object.keys(sums).map(function (k) { return { kg: S.settings.bar + 2 * +k, side: sums[k] }; }).sort(function (a, b) { return a.kg - b.kg; }); }
  function roundLoad(kg) { var L = loadable(), best = L[0]; L.forEach(function (x) { if (x.kg <= kg + 0.01) best = x; }); return best; }
  function platesText(x) { return x.side.length ? x.side.join(' + ') + ' each side' : 'empty bar'; }

  // ---------- the back (the tracker: goal pain 2-3 or less; 4-6 concerning; 7-10 stop)
  function pains() { return S.sessions.filter(function (x) { return x.painAfter != null; }).slice(-3).map(function (x) { return x.painAfter; }); }
  function backHold() { var p = pains(), n = p.length; if (!n) return '';
    if (p[n - 1] >= 6) return 'Back pain was ' + p[n - 1] + '/10 after the last session, so squat and deadlift stay where they were.';
    if (n >= 3 && p[2] > p[1] && p[1] > p[0]) return 'Back pain has gone up two sessions running (' + p.join(', ') + '), so squat and deadlift stay where they were.';
    return ''; }
  function lastTop(lift) { for (var i = S.sessions.length - 1; i >= 0; i--) { var e = (S.sessions[i].exercises || []).find(function (x) { return x.lift === lift; }); if (e) { var top = 0; e.sets.forEach(function (s) { if (s.done && !s.warm && +s.kg > top) top = +s.kg; }); if (top) return top; } } return 0; }

  function mainSets(lift) { var tm = +S.settings.tm[lift]; if (!tm) return null;
    var hold = LOWER[lift] ? backHold() : '', cap = hold ? lastTop(lift) : 0, out = [];
    // held by the back with nothing logged yet to hold at: the deload week's weights
    var w = hold && !cap ? WEEKS[4] : (WEEKS[S.settings.week[lift]] || WEEKS[1]);
    WARM.p.forEach(function (p, i) { var x = roundLoad(tm * p / 100); out.push({ kg: x.kg, reps: WARM.r[i], warm: true, plates: platesText(x), pct: p }); });
    w.p.forEach(function (p, i) { var x = roundLoad(tm * p / 100); if (cap && x.kg > cap) x = roundLoad(cap); out.push({ kg: x.kg, reps: w.r[i], warm: false, plates: platesText(x), pct: p }); });
    return { sets: out, week: S.settings.week[lift], hold: hold }; }

  function pace(p) { var m = Math.floor(p), s = Math.round((p - m) * 60); if (s === 60) { m++; s = 0; } return m + ':' + pad(s); }
  function lastOf(name) { for (var i = S.sessions.length - 1; i >= 0; i--) { var e = (S.sessions[i].exercises || []).find(function (x) { return x.name === name; }); if (e) return e; } return null; }
  function nextDay() { for (var i = S.sessions.length - 1; i >= 0; i--) { var d = S.sessions[i].day, k = ORDER.indexOf(d); if (k >= 0) return ORDER[(k + 1) % 4]; } return ORDER[0]; }

  // ---------- a session being logged
  function startSession(day) {
    var ex = [];
    (DAYS[day] || []).forEach(function (r) {
      if (r[0] === 'main') { var m = mainSets(r[1]); ex.push({ name: MAIN[r[1]], lift: r[1], target: m ? '5-3-1 week ' + m.week : 'Set your training max in Settings', hold: m ? m.hold : '', sets: m ? m.sets.map(function (s) { return { kg: s.kg, reps: String(s.reps).replace('+', ''), amrap: /\+/.test(s.reps), warm: s.warm, plates: s.plates, pct: s.pct, done: false }; }) : [{ kg: '', reps: '', done: false }] }); return; }
      var last = lastOf(r[0]), n = parseInt(r[1], 10) || 2, sets = [];
      for (var i = 0; i < n; i++) { var ls = last && last.sets[i]; sets.push({ kg: ls ? ls.kg : '', reps: ls ? ls.reps : (String(r[1]).match(/x\s*(\d+)/) || [])[1] || '', done: false }); }
      ex.push({ name: r[0], target: r[1], sets: sets });
    });
    S.draft = { id: uid(), date: ymd(), start: hm(), day: day, exercises: ex, cardio: [], rehab: [], painBefore: null, painAfter: null, painDuring: null, bodyKg: '', rpe: null, note: '' };
    save(); render();
  }
  function finish() {
    var d = S.draft; if (!d) return;
    d.end = hm();
    d.exercises = d.exercises.filter(function (e) { return e.sets.some(function (s) { return s.done; }); }).map(function (e) { e.sets = e.sets.filter(function (s) { return s.done; }); return e; });
    // 5-3-1: a lift moves to its next week once its work sets are done; after the deload week the training max goes up (unless the back says hold)
    var notes = [];
    d.exercises.forEach(function (e) { if (!e.lift || !e.sets.some(function (s) { return !s.warm; })) return;
      var st = S.settings, wk = st.week[e.lift];
      if (wk >= 4) { st.week[e.lift] = 1; st.cycle[e.lift]++;
        var hold = LOWER[e.lift] && (backHold() || (d.painAfter != null && d.painAfter >= 6));
        if (!hold) { st.tm[e.lift] = +st.tm[e.lift] + (LOWER[e.lift] ? st.inc.lower : st.inc.upper); notes.push(MAIN[e.lift] + ': new training max ' + st.tm[e.lift] + ' kg.'); }
        else notes.push(MAIN[e.lift] + ': training max kept at ' + st.tm[e.lift] + ' kg because of back pain.');
      } else st.week[e.lift] = wk + 1; });
    if (!d.exercises.length && !d.cardio.length && !d.rehab.length) { if (!confirm('Nothing is ticked. Throw this session away?')) return; S.draft = null; save(); render(); return; }
    S.sessions.push(d); S.draft = null; save(); render();
    toast('Saved on this phone.' + (notes.length ? ' ' + notes.join(' ') : ''));
  }

  // ---------- send to the PC (share sheet -> OneDrive -> Life\Gym\Phone log)
  function unsent() { return S.sessions.filter(function (x) { return !S.sent[x.id]; }); }
  function sendToPc() {
    var list = unsent(); if (!list.length) { toast('Everything is already sent.'); return; }
    var body = JSON.stringify({ app: 'gym-log', v: 1, made: new Date().toISOString(), settings: { tm: S.settings.tm, week: S.settings.week, cycle: S.settings.cycle }, sessions: list }, null, 1);
    var name = 'gym ' + ymd() + ' ' + hm().replace(':', '') + '.json';
    var file; try { file = new File([body], name, { type: 'application/json' }); } catch (e) {}
    var mark = function () { list.forEach(function (x) { S.sent[x.id] = new Date().toISOString(); }); save(); render(); };
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).then(function () { mark(); toast('Sent. Save it in OneDrive > Life > Gym > Phone log.'); }, function () {});
    } else {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      if (confirm('The file was downloaded. Did you save it into OneDrive > Life > Gym > Phone log?')) mark();
    }
  }

  // ---------- screens
  var view = 'today';
  function painRow(key, label) { var v = S.draft[key]; var h = '<label class="f">' + label + '</label><div class="pain" data-pain="' + key + '">';
    for (var i = 0; i <= 10; i++) h += '<button type="button" data-n="' + i + '" aria-pressed="' + (v === i) + '">' + i + '</button>'; return h + '</div>'; }
  function today() {
    var d = S.draft, m = $('#main');
    if (!d) {
      var nd = nextDay(), h = '<h2>Today</h2><p class="muted small">Pick a workout. The next in your routine has a gold edge.</p><div class="days">' +
        ORDER.map(function (x) { return '<button class="btn' + (x === nd ? ' next' : '') + '" data-day="' + x + '">' + x + '</button>'; }).join('') +
        '<button class="btn" data-day="Back block">Back block only</button><button class="btn" data-day="Cardio">Cardio only</button></div>';
      var hold = backHold(); if (hold) h += '<div class="note warn">' + esc(hold) + '</div>';
      if (!S.settings.tm.squat) h += '<div class="note">Set your training maxes in Settings so the main lifts are worked out for you.</div>';
      var u = unsent().length; h += '<h2>Send to PC</h2><p class="muted small">' + (u ? u + ' session' + (u > 1 ? 's' : '') + ' not sent yet.' : 'Everything is sent.') + ' Share the file to OneDrive and save it in Life > Gym > Phone log.</p><button class="btn primary" id="send"' + (u ? '' : ' disabled') + '>Send to PC</button>';
      if (!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) h += '<div class="note small">To keep this on your home screen: iPhone: Share > Add to Home Screen. Android: Chrome menu > Add to Home screen. It then opens with no signal.</div>';
      m.innerHTML = h; return;
    }
    var h2 = '<h2>' + esc(d.day) + '</h2><p class="muted small">' + dmy(d.date) + ', started ' + d.start + '</p>' + painRow('painBefore', 'Back pain now (0 none, 10 worst)');
    if (d.painBefore != null && d.painBefore >= 7) h2 += '<div class="note warn">Your rehab tracker says 7-10 means stop. Do the back block only today, or rest. These are the rules from your tracker, not medical advice; your physio has the final say.</div>';
    d.exercises.forEach(function (e, i) {
      h2 += '<div class="ex' + (e.lift ? ' main' : '') + '"><div class="row"><h3>' + esc(e.name) + '</h3><span class="sp"></span><span class="tgt">' + esc(e.target) + '</span></div>' + (e.hold ? '<div class="note warn small">' + esc(e.hold) + '</div>' : '') +
        '<div class="set" aria-hidden="true"><span class="lab">set</span><span class="lab">kg</span><span class="lab">reps</span><span></span></div>' +
        e.sets.map(function (s, j) { return '<div class="set' + (s.warm ? ' warm' : '') + '" data-e="' + i + '" data-s="' + j + '"><span class="lab">' + (j + 1) + '</span><input inputmode="decimal" aria-label="' + esc(e.name) + ' set ' + (j + 1) + ' kg" data-k="kg" value="' + esc(s.kg) + '"><input inputmode="numeric" aria-label="reps" data-k="reps" value="' + esc(s.reps) + '" placeholder="' + (s.amrap ? 'max' : '') + '"><button type="button" class="tick" aria-label="Done" aria-pressed="' + !!s.done + '">&#10003;</button>' + (s.plates ? '<span class="plates">' + (s.warm ? 'Warm-up ' : '') + s.pct + '%: ' + esc(s.plates) + (s.amrap ? ', as many reps as you can' : '') + '</span>' : '') + '</div>'; }).join('') +
        '<button type="button" class="btn small" data-add="' + i + '" style="margin-top:8px">+ set</button></div>';
    });
    h2 += '<div class="ex"><h3>Back block</h3>' + REHAB.map(function (r) { return '<label class="check"><input type="checkbox" data-rehab="' + esc(r) + '"' + (d.rehab.indexOf(r) >= 0 ? ' checked' : '') + '>' + esc(r) + '</label>'; }).join('') + '</div>';
    h2 += '<div class="ex"><h3>Cardio</h3>' + d.cardio.map(function (c, i) { return '<p class="small">' + esc(c.type) + ': ' + (c.min || '-') + ' min' + (c.km ? ', ' + c.km + ' km' : '') + (c.min && c.km ? (/cycl/i.test(c.type) ? ', ' + Math.round(c.km / (c.min / 60) * 10) / 10 + ' km/h' : ', ' + pace(c.min / c.km) + ' per km') : '') + (c.hr ? ', ' + c.hr + ' bpm' : '') + ' <button class="btn small" data-delc="' + i + '">Remove</button></p>'; }).join('') +
      '<div class="row"><select class="f" id="ct" style="flex:2">' + CARDIO.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select><input class="f" id="cm" inputmode="numeric" placeholder="min" style="flex:1"><input class="f" id="ck" inputmode="decimal" placeholder="km" style="flex:1"><input class="f" id="ch" inputmode="numeric" placeholder="bpm" style="flex:1"></div><button class="btn small" id="addc" style="margin-top:8px">Add cardio</button></div>';
    h2 += painRow('painDuring', 'Back pain during (highest)') + painRow('painAfter', 'Back pain after') +
      '<label class="f">Effort, 1 easy to 10 all-out</label><div class="pain" data-pain="rpe">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (i) { return '<button type="button" data-n="' + i + '" aria-pressed="' + (d.rpe === i) + '">' + i + '</button>'; }).join('') + '</div>' +
      '<label class="f" for="bw">Body weight (kg)</label><input class="f" id="bw" inputmode="decimal" value="' + esc(d.bodyKg) + '">' +
      '<label class="f" for="nt">How you felt, anything to remember</label><textarea class="f" id="nt" rows="2">' + esc(d.note) + '</textarea>';
    if (d.painDuring != null && d.painDuring >= 7) h2 += '<div class="note warn">Pain of 7 or more: your tracker says stop immediately. If it stays high, ask your physio.</div>';
    m.innerHTML = h2 + '<div class="bar"><button class="btn" id="cancel">Discard</button><button class="btn primary" id="finish">Finish and save</button></div>';
  }
  function history() {
    var L = S.sessions.slice().reverse(), h = '<h2>History</h2><p class="muted small">' + S.sessions.length + ' sessions on this phone. The full progress charts are on the Gym page of the app on your PC.</p><button class="btn primary" id="send"' + (unsent().length ? '' : ' disabled') + '>Send to PC (' + unsent().length + ')</button><ul class="list">';
    L.slice(0, 60).forEach(function (x) { var top = (x.exercises || []).filter(function (e) { return e.lift; }).map(function (e) { var t = 0, r = 0; e.sets.forEach(function (s) { if (!s.warm && +s.kg >= t) { t = +s.kg; r = s.reps; } }); return e.name + ' ' + t + ' kg x ' + r; }).join('; ');
      h += '<li><b>' + dmy(x.date) + '</b> ' + esc(x.day) + (S.sent[x.id] ? '' : ' <span class="muted small">(not sent)</span>') + '<br><span class="small muted">' + (x.exercises || []).length + ' exercises' + (x.cardio && x.cardio.length ? ', ' + x.cardio.length + ' cardio' : '') + (x.painAfter != null ? ', back ' + x.painAfter + '/10 after' : '') + (top ? '. ' + esc(top) : '') + '</span></li>'; });
    $('#main').innerHTML = h + '</ul>';
  }
  function settings() {
    var st = S.settings, h = '<h2>Training maxes</h2><p class="muted small">The weights 5-3-1 works from, in kg. Your plan uses a percentage of these each week. Type yours in; they go up by themselves after each deload week.</p>';
    Object.keys(MAIN).forEach(function (k) { h += '<label class="f" for="tm-' + k + '">' + MAIN[k] + ' (now week ' + st.week[k] + ', cycle ' + st.cycle[k] + ')</label><input class="f" id="tm-' + k + '" data-tm="' + k + '" inputmode="decimal" value="' + esc(st.tm[k] || '') + '">'; });
    h += '<h2>Rise each cycle</h2><p class="muted small">Your 5-3-1 sheet does not say how much to add; these are the usual 5-3-1 amounts. Change them if you like.</p><label class="f" for="il">Squat and deadlift (kg)</label><input class="f" id="il" inputmode="decimal" value="' + st.inc.lower + '"><label class="f" for="iu">Bench and overhead press (kg)</label><input class="f" id="iu" inputmode="decimal" value="' + st.inc.upper + '">' +
      '<p class="muted small">Squat and deadlift do not rise when back pain after a session was 6 or more, or has gone up two sessions running. These follow your rehab tracker; they are not medical advice, and your physio has the final say.</p>' +
      '<h2>Plates (one side)</h2><input class="f" id="pl" value="' + st.plates.join(', ') + '"><p class="muted small">Bar ' + st.bar + ' kg. Heaviest you can load: ' + loadable().slice(-1)[0].kg + ' kg. Suggested weights are rounded down to what you can load.</p>' +
      '<h2>Week of each lift</h2><p class="muted small">If you skipped or repeated a week, set it here.</p>' + Object.keys(MAIN).map(function (k) { return '<label class="f">' + MAIN[k] + '</label><select class="f" data-wk="' + k + '">' + [1, 2, 3, 4].map(function (w) { return '<option value="' + w + '"' + (st.week[k] === w ? ' selected' : '') + '>Week ' + w + (w === 4 ? ' (deload)' : '') + '</option>'; }).join('') + '</select>'; }).join('') +
      '<button class="btn primary" id="saveset" style="margin-top:14px;width:100%">Save settings</button>';
    $('#main').innerHTML = h;
  }
  function render() { document.querySelectorAll('nav button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.v === view ? 'page' : 'false'); });
    if (view === 'today') today(); else if (view === 'history') history(); else settings(); }
  function toast(t) { var el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 3800); }

  // ---------- events
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('button, [data-day]'); if (!t) return;
    if (t.dataset.v) { view = t.dataset.v; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.day) { startSession(t.dataset.day); window.scrollTo(0, 0); return; }
    if (t.id === 'send') return sendToPc();
    if (t.id === 'finish') return finish();
    if (t.id === 'cancel') { if (confirm('Discard this session?')) { S.draft = null; save(); render(); } return; }
    if (t.classList.contains('tick')) { var row = t.closest('.set'), s = S.draft.exercises[+row.dataset.e].sets[+row.dataset.s]; s.done = !s.done; t.setAttribute('aria-pressed', s.done); save(); return; }
    if (t.dataset.add != null) { var e = S.draft.exercises[+t.dataset.add], l = e.sets[e.sets.length - 1] || {}; e.sets.push({ kg: l.kg || '', reps: l.reps || '', done: false }); save(); render(); return; }
    var pr = t.closest('[data-pain]'); if (pr && t.dataset.n != null) { var k = pr.dataset.pain, n = +t.dataset.n; S.draft[k] = S.draft[k] === n ? null : n; save(); render(); return; }
    if (t.id === 'addc') { var c = { type: $('#ct').value, min: +$('#cm').value || null, km: +$('#ck').value || null, hr: +$('#ch').value || null }; if (!c.min && !c.km) { toast('Add minutes or distance.'); return; } S.draft.cardio.push(c); save(); render(); return; }
    if (t.dataset.delc != null) { S.draft.cardio.splice(+t.dataset.delc, 1); save(); render(); return; }
    if (t.id === 'saveset') {
      var st = S.settings; document.querySelectorAll('[data-tm]').forEach(function (i) { var v = parseFloat(i.value); st.tm[i.dataset.tm] = v > 0 ? v : null; });
      document.querySelectorAll('[data-wk]').forEach(function (i) { st.week[i.dataset.wk] = +i.value; });
      var il = parseFloat($('#il').value), iu = parseFloat($('#iu').value); if (il >= 0) st.inc.lower = il; if (iu >= 0) st.inc.upper = iu;
      var pl = $('#pl').value.split(/[,\s]+/).map(parseFloat).filter(function (x) { return x > 0; }); if (pl.length) st.plates = pl;
      save(); toast('Settings saved.'); render(); return; }
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target, d = S.draft; if (!d) return;
    if (t.dataset.k) { var row = t.closest('.set'); d.exercises[+row.dataset.e].sets[+row.dataset.s][t.dataset.k] = t.value; save(); return; }
    if (t.id === 'bw') { d.bodyKg = t.value; save(); } if (t.id === 'nt') { d.note = t.value; save(); }
  });
  document.addEventListener('change', function (ev) { var t = ev.target; if (t.dataset.rehab && S.draft) { var r = S.draft.rehab, i = r.indexOf(t.dataset.rehab); if (t.checked && i < 0) r.push(t.dataset.rehab); if (!t.checked && i >= 0) r.splice(i, 1); save(); } });

  // a day with only the back block or only cardio
  DAYS['Back block'] = []; DAYS['Cardio'] = [];
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  window.GYM = { S: S, mainSets: mainSets, roundLoad: roundLoad, backHold: backHold, loadable: loadable };   // for testing
  render();
})();
