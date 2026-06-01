// ===== STATE =====
let state = {
  profile: { name: 'RUNNER', age: '', weight: '', level: 'beginner', goal: 'marathon' },
  runs: [],
  plans: [],
  activeTab: 'dashboard',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDate: null,
  logRunType: 'easy',
  planRpw: 4,
  planType: 'base',
};

// ===== STORAGE =====
function save() {
  localStorage.setItem('stride_state', JSON.stringify({
    profile: state.profile,
    runs: state.runs,
    plans: state.plans,
  }));
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem('stride_state') || '{}');
    if (d.profile) state.profile = { ...state.profile, ...d.profile };
    if (d.runs) state.runs = d.runs;
    if (d.plans) state.plans = d.plans;
  } catch(e) {}
}

// ===== NAVIGATION =====
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  state.activeTab = tab;
  renderTab(tab);
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function renderTab(tab) {
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'calendar') renderCalendar();
  if (tab === 'plan') renderPlanList();
  if (tab === 'profile') renderProfile();
  if (tab === 'log') initLogForm();
}

// ===== HELPERS =====
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}
function fmtDateShort(d) {
  return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}
function isoDate(d = new Date()) {
  return d.toISOString().slice(0,10);
}
function parsePace(str) {
  if (!str || !str.includes(':')) return 0;
  const [m,s] = str.split(':').map(Number);
  return m + (s||0)/60;
}
function calcPace(km, timeStr) {
  if (!km || !timeStr) return '';
  const parts = timeStr.split(':').map(Number);
  let mins = 0;
  if (parts.length === 2) mins = parts[0] + parts[1]/60;
  if (parts.length === 3) mins = parts[0]*60 + parts[1] + parts[2]/60;
  const pace = mins / parseFloat(km);
  if (!isFinite(pace) || pace <= 0) return '';
  const pm = Math.floor(pace);
  const ps = Math.round((pace - pm) * 60).toString().padStart(2,'0');
  return `${pm}:${ps}`;
}
function typeColor(type) {
  const map = { easy:'#4FC3F7', tempo:'#FF9800', intervals:'#F44336', long:'#9C27B0', recovery:'#4CAF50', race:'#FFD600', rest:'#555' };
  return map[type] || '#888';
}
function showToast(msg, type = '') {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => t.classList.remove('show'), 2600);
}
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ===== DASHBOARD =====
function renderDashboard() {
  // Name
  document.getElementById('userName').textContent = state.profile.name || 'RUNNER';

  // Streak
  const streak = calcStreak();
  document.getElementById('streakCount').textContent = streak;

  // Today's run
  const today = isoDate();
  const todayPlanned = getTodayPlanned(today);
  const todayEl = document.getElementById('todayRun');
  if (todayPlanned) {
    todayEl.innerHTML = `
      <div class="today-run-info">
        <div class="today-run-type">${todayPlanned.type}</div>
        <div class="today-run-meta">
          <div class="today-meta-item"><strong>${todayPlanned.km} KM</strong>Distance</div>
          <div class="today-meta-item"><strong>${todayPlanned.note || '—'}</strong>Notes</div>
        </div>
      </div>`;
  } else {
    todayEl.innerHTML = `<div class="today-empty"><p>No run scheduled today</p><button class="btn-ghost" onclick="switchTab('plan')">Build your plan →</button></div>`;
  }

  // Week KM
  const weekStart = getWeekStart(new Date());
  const weekRuns = state.runs.filter(r => {
    const d = new Date(r.date);
    return d >= weekStart && d < new Date(weekStart.getTime() + 7*86400000);
  });
  const weekKm = weekRuns.reduce((s,r) => s + (parseFloat(r.distance)||0), 0);
  document.getElementById('weekKm').textContent = weekKm.toFixed(1);

  // Month runs
  const now = new Date();
  const monthRuns = state.runs.filter(r => {
    const d = new Date(r.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  document.getElementById('monthRuns').textContent = monthRuns.length;

  // Plan progress
  const prog = getPlanProgress();
  document.getElementById('planProgress').textContent = prog + '%';

  // Recent runs
  const recent = [...state.runs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,5);
  const rl = document.getElementById('recentRuns');
  if (recent.length === 0) {
    rl.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:12px 0">No runs logged yet. Start by logging your first run!</div>`;
  } else {
    rl.innerHTML = recent.map(r => `
      <div class="run-item" onclick="showRunDetail('${r.id}')">
        <div class="run-type-dot" style="background:${typeColor(r.type)}"></div>
        <div class="run-item-main">
          <div class="run-item-top">
            <span class="run-item-dist">${parseFloat(r.distance).toFixed(1)} km</span>
            <span class="run-item-type">${r.type}</span>
          </div>
          <div class="run-item-sub">${fmtDate(r.date)} · ${r.duration || '—'}</div>
        </div>
        ${r.pace ? `<div class="run-item-pace">${r.pace}<small>MIN/KM</small></div>` : ''}
      </div>`).join('');
  }

  // Comparison chart
  renderComparisonChart();
}

function calcStreak() {
  if (state.runs.length === 0) return 0;
  const dates = [...new Set(state.runs.map(r => r.date))].sort().reverse();
  const today = isoDate();
  let streak = 0;
  let check = new Date(today);
  for (let i = 0; i < 365; i++) {
    const d = isoDate(check);
    if (dates.includes(d)) { streak++; }
    else if (streak > 0) break;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function getTodayPlanned(today) {
  for (const plan of state.plans) {
    for (const week of plan.weeks) {
      for (const run of week.runs) {
        if (run.date === today && run.type !== 'rest') return run;
      }
    }
  }
  return null;
}

function getWeekStart(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getPlanProgress() {
  if (state.plans.length === 0) return 0;
  const plan = state.plans[0];
  const allRuns = plan.weeks.flatMap(w => w.runs.filter(r => r.type !== 'rest'));
  if (allRuns.length === 0) return 0;
  const done = allRuns.filter(r => r.completed).length;
  return Math.round(done / allRuns.length * 100);
}

function renderComparisonChart() {
  const el = document.getElementById('comparisonChart');
  if (state.plans.length === 0 && state.runs.length === 0) {
    el.innerHTML = `<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px">Log runs and create a plan to see comparison</div>`;
    return;
  }
  const weeks = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const ws = getWeekStart(new Date(now.getTime() - i * 7 * 86400000));
    const we = new Date(ws.getTime() + 7*86400000);
    const planned = getPlannedKmForWeek(ws, we);
    const actual = state.runs
      .filter(r => { const d = new Date(r.date); return d >= ws && d < we; })
      .reduce((s,r) => s + (parseFloat(r.distance)||0), 0);
    weeks.push({ label: `W${7-i}`, planned, actual });
  }
  const max = Math.max(...weeks.map(w => Math.max(w.planned, w.actual)), 1);
  el.innerHTML = `
    <div class="chart-legend">
      <div class="chart-legend-item"><div class="chart-legend-dot" style="background:var(--border)"></div> Planned</div>
      <div class="chart-legend-item"><div class="chart-legend-dot" style="background:var(--red)"></div> Actual</div>
    </div>
    <div class="chart-bars">
      ${weeks.map(w => `
        <div class="chart-week">
          <div class="chart-bar-wrap">
            <div class="bar bar-planned" style="height:${(w.planned/max*90)||2}px" title="${w.planned.toFixed(1)}km planned"></div>
            <div class="bar bar-actual" style="height:${(w.actual/max*90)||2}px" title="${w.actual.toFixed(1)}km actual"></div>
          </div>
          <div class="chart-wlbl">${w.label}</div>
        </div>`).join('')}
    </div>`;
}

function getPlannedKmForWeek(ws, we) {
  let total = 0;
  for (const plan of state.plans) {
    for (const week of plan.weeks) {
      for (const run of week.runs) {
        if (run.date) {
          const d = new Date(run.date);
          if (d >= ws && d < we) total += parseFloat(run.km||0);
        }
      }
    }
  }
  return total;
}

// ===== LOG RUN =====
function initLogForm() {
  const dateEl = document.getElementById('logDate');
  if (!dateEl.value) dateEl.value = isoDate();
  // RPE slider
  const rpe = document.getElementById('logRPE');
  rpe.addEventListener('input', () => {
    document.getElementById('rpeVal').textContent = rpe.value;
  });
  // Auto-calc pace
  ['logDist','logTime'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const dist = document.getElementById('logDist').value;
      const time = document.getElementById('logTime').value;
      document.getElementById('logPace').value = calcPace(dist, time);
    });
  });
  // Run type buttons
  document.querySelectorAll('#runTypeGrid .run-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#runTypeGrid .run-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.logRunType = btn.dataset.type;
    });
  });
  // File drop
  const drop = document.getElementById('fileDrop');
  drop.addEventListener('click', () => document.getElementById('fileInput').click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--blue)'; });
  drop.addEventListener('dragleave', () => drop.style.borderColor = '');
  drop.addEventListener('drop', e => { e.preventDefault(); drop.style.borderColor = ''; handleFileImport({ target: { files: e.dataTransfer.files } }); });
}

function saveRun() {
  const date = document.getElementById('logDate').value;
  const distance = document.getElementById('logDist').value;
  const duration = document.getElementById('logTime').value;
  const hr = document.getElementById('logHR').value;
  const notes = document.getElementById('logNotes').value;
  const rpe = document.getElementById('logRPE').value;
  if (!date || !distance) { showToast('Date and distance required', 'error'); return; }
  const run = {
    id: Date.now().toString(),
    date, distance: parseFloat(distance),
    duration, pace: calcPace(distance, duration),
    hr: hr ? parseInt(hr) : null,
    type: state.logRunType,
    rpe: parseInt(rpe), notes,
    source: 'manual',
  };
  state.runs.push(run);
  save();
  // Clear form
  document.getElementById('logDist').value = '';
  document.getElementById('logTime').value = '';
  document.getElementById('logPace').value = '';
  document.getElementById('logHR').value = '';
  document.getElementById('logNotes').value = '';
  showToast('Run saved! 🎉', 'success');
  switchTab('dashboard');
}

// ===== GPX IMPORT =====
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    if (file.name.endsWith('.gpx')) parseGPX(content, file.name);
    else showToast('.FIT files need a conversion tool. Try gpx.studio to convert.', 'error');
  };
  reader.readAsText(file);
}

function parseGPX(xml, filename) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const trk = doc.querySelector('trk');
    const name = trk?.querySelector('name')?.textContent || filename;
    const trkpts = doc.querySelectorAll('trkpt');
    if (trkpts.length < 2) { showToast('No track data found in GPX', 'error'); return; }
    let dist = 0;
    let pts = [];
    trkpts.forEach(pt => {
      pts.push({ lat: parseFloat(pt.getAttribute('lat')), lon: parseFloat(pt.getAttribute('lon')), time: pt.querySelector('time')?.textContent });
    });
    for (let i = 1; i < pts.length; i++) {
      dist += haversine(pts[i-1].lat, pts[i-1].lon, pts[i].lat, pts[i].lon);
    }
    const startTime = pts[0].time ? new Date(pts[0].time) : new Date();
    const endTime = pts[pts.length-1].time ? new Date(pts[pts.length-1].time) : new Date();
    const durationMs = endTime - startTime;
    const durationMin = durationMs / 60000;
    const durationStr = `${Math.floor(durationMin)}:${Math.round((durationMin%1)*60).toString().padStart(2,'0')}`;
    const run = {
      id: Date.now().toString(),
      date: isoDate(startTime),
      distance: Math.round(dist * 10) / 10,
      duration: durationStr,
      pace: calcPace(dist, durationStr),
      type: 'easy',
      source: 'garmin_gpx',
      notes: name,
    };
    state.runs.push(run);
    save();
    showToast(`Imported: ${dist.toFixed(1)}km run 📍`, 'success');
    switchTab('dashboard');
  } catch(err) {
    showToast('Failed to parse GPX file', 'error');
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ===== PLAN BUILDER =====
function openNewPlan() {
  const today = isoDate();
  document.getElementById('planStart').value = today;
  openModal('modalNewPlan');
}

function setRpw(btn) {
  document.querySelectorAll('#runsPerWeekGrid .run-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.planRpw = parseInt(btn.dataset.rpw);
}
function setPlanType(btn) {
  btn.closest('.run-type-grid').querySelectorAll('.run-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.planType = btn.dataset.pt;
}
function setLevel(btn) {
  btn.closest('.run-type-grid').querySelectorAll('.run-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.profile.level = btn.dataset.level;
}
function setGoal(btn) {
  btn.closest('.run-type-grid').querySelectorAll('.run-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.profile.goal = btn.dataset.goal;
}

function generatePlan() {
  const name = document.getElementById('planName').value || 'Training Plan';
  const startDate = document.getElementById('planStart').value;
  const numWeeks = parseInt(document.getElementById('planWeeks').value);
  const rpw = state.planRpw;
  const ptype = state.planType;

  if (!startDate) { showToast('Please select a start date', 'error'); return; }

  const WEEK_TEMPLATES = {
    base: {
      3: ['easy','long','recovery'],
      4: ['easy','easy','tempo','long'],
      5: ['easy','easy','tempo','long','recovery'],
      6: ['easy','easy','tempo','intervals','long','recovery'],
    },
    marathon: {
      3: ['easy','tempo','long'],
      4: ['easy','tempo','intervals','long'],
      5: ['easy','easy','tempo','intervals','long'],
      6: ['easy','easy','tempo','intervals','long','recovery'],
    },
    speed: {
      3: ['tempo','intervals','easy'],
      4: ['easy','tempo','intervals','long'],
      5: ['easy','tempo','intervals','intervals','easy'],
      6: ['easy','tempo','intervals','intervals','long','recovery'],
    },
    custom: {
      3: ['easy','tempo','long'],
      4: ['easy','easy','tempo','long'],
      5: ['easy','easy','tempo','long','recovery'],
      6: ['easy','easy','tempo','intervals','long','recovery'],
    },
  };

  const RUN_DAYS = { 3:[1,3,6], 4:[1,3,5,6], 5:[1,2,3,5,6], 6:[1,2,3,4,5,6] };
  const BASE_KM = { easy:6, tempo:5, intervals:4, long:10, recovery:4, rest:0 };

  const template = WEEK_TEMPLATES[ptype]?.[rpw] || WEEK_TEMPLATES.base[4];
  const runDays = RUN_DAYS[rpw] || RUN_DAYS[4];

  const start = new Date(startDate);

  const weeks = [];
  for (let w = 0; w < numWeeks; w++) {
    const factor = 1 + w * 0.08 + (w % 4 === 3 ? -0.25 : 0); // step-back weeks
    const weekStart = new Date(start.getTime() + w * 7 * 86400000);
    const allDays = [0,1,2,3,4,5,6].map(d => {
      const date = new Date(weekStart.getTime() + d * 86400000);
      return isoDate(date);
    });
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const runs = allDays.map((date, dayIdx) => {
      const pos = runDays.indexOf(dayIdx);
      if (pos === -1) return { date, day: dayNames[dayIdx], type: 'rest', km: 0 };
      const type = template[pos] || 'easy';
      const km = Math.max(3, Math.round(BASE_KM[type] * factor * 10) / 10);
      return { date, day: dayNames[dayIdx], type, km, completed: false, note: getRunNote(type) };
    });
    const vol = runs.reduce((s,r) => s + (r.km||0), 0);
    weeks.push({ weekNum: w+1, runs, volume: Math.round(vol * 10) / 10 });
  }

  const plan = {
    id: Date.now().toString(),
    name, startDate, numWeeks, rpw, type: ptype,
    weeks, createdAt: isoDate(),
  };
  state.plans.push(plan);
  save();
  closeModal('modalNewPlan');
  showToast(`Plan created: ${numWeeks} weeks 🏃`, 'success');
  renderPlanList();
}

function getRunNote(type) {
  const notes = {
    easy: 'Conversational pace', tempo: 'Comfortably hard, 80% effort',
    intervals: '4×1km at 5K pace', long: 'Easy pace, build endurance',
    recovery: 'Very easy, shake out legs', rest: 'Rest day',
  };
  return notes[type] || '';
}

function renderPlanList() {
  const list = document.getElementById('planList');
  const empty = document.getElementById('planEmpty');
  if (state.plans.length === 0) {
    list.innerHTML = ''; empty.style.display = 'block'; return;
  }
  empty.style.display = 'none';
  list.innerHTML = state.plans.map(plan => {
    const prog = getPlanProgressForPlan(plan);
    const allRuns = plan.weeks.flatMap(w => w.runs.filter(r => r.type !== 'rest'));
    const done = allRuns.filter(r => r.completed).length;
    return `
      <div class="plan-card" onclick="viewPlan('${plan.id}')">
        <div class="plan-card-header">
          <div class="plan-card-name">${plan.name}</div>
          <div class="plan-card-weeks">${plan.numWeeks} WKS</div>
        </div>
        <div class="plan-progress-bar"><div class="plan-progress-fill" style="width:${prog}%"></div></div>
        <div class="plan-card-meta">
          <div class="plan-meta-item">Started <strong>${fmtDateShort(plan.startDate)}</strong></div>
          <div class="plan-meta-item">Runs <strong>${done}/${allRuns.length}</strong></div>
          <div class="plan-meta-item">Completed <strong>${prog}%</strong></div>
        </div>
      </div>`;
  }).join('');
}

function getPlanProgressForPlan(plan) {
  const allRuns = plan.weeks.flatMap(w => w.runs.filter(r => r.type !== 'rest'));
  if (!allRuns.length) return 0;
  return Math.round(allRuns.filter(r => r.completed).length / allRuns.length * 100);
}

function viewPlan(planId) {
  const plan = state.plans.find(p => p.id === planId);
  if (!plan) return;
  document.getElementById('viewPlanTitle').textContent = plan.name.toUpperCase();
  const body = document.getElementById('viewPlanBody');
  body.innerHTML = `
    <div class="plan-weeks">
      ${plan.weeks.map(week => `
        <div class="week-block">
          <div class="week-header">
            <div class="week-title">WEEK ${week.weekNum}</div>
            <div class="week-vol">${week.volume} km</div>
          </div>
          <div class="week-runs">
            ${week.runs.map((run, ri) => {
              if (run.type === 'rest') return `
                <div class="plan-run-item" style="opacity:0.4">
                  <div class="plan-run-day">${run.day}</div>
                  <div class="plan-run-type type-rest">REST</div>
                </div>`;
              // check if there's an actual run logged for this date
              const actual = state.runs.find(r => r.date === run.date);
              const wi = plan.weeks.indexOf(week);
              return `
                <div class="plan-run-item">
                  <div class="plan-run-day">${run.day}</div>
                  <div class="plan-run-type type-${run.type}">${run.type.toUpperCase()}</div>
                  <div>
                    <div class="plan-run-dist">${run.km}</div>
                    <div class="plan-run-km">KM</div>
                  </div>
                  ${actual ? `<div style="font-size:11px;color:var(--green);letter-spacing:1px;font-family:var(--font-display)">✓ ${parseFloat(actual.distance).toFixed(1)}km</div>` : ''}
                  <div class="plan-run-check ${run.completed ? 'done' : ''}"
                    onclick="toggleRunComplete('${planId}',${wi},${ri},event)">
                    ${run.completed ? '✓' : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>`).join('')}
    </div>
    <div style="margin-top:12px;display:flex;gap:10px;">
      <button class="btn-secondary" onclick="deletePlan('${planId}')">DELETE PLAN</button>
    </div>`;
  openModal('modalViewPlan');
}

function toggleRunComplete(planId, weekIdx, runIdx, event) {
  event.stopPropagation();
  const plan = state.plans.find(p => p.id === planId);
  if (!plan) return;
  plan.weeks[weekIdx].runs[runIdx].completed = !plan.weeks[weekIdx].runs[runIdx].completed;
  save();
  viewPlan(planId);
}

function deletePlan(planId) {
  if (!confirm('Delete this plan?')) return;
  state.plans = state.plans.filter(p => p.id !== planId);
  save();
  closeModal('modalViewPlan');
  renderPlanList();
}

// ===== CALENDAR =====
function renderCalendar() {
  const year = state.calYear, month = state.calMonth;
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  document.getElementById('calMonthTitle').textContent = `${months[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday=0
  const today = isoDate();

  // Build date map
  const dateMap = {};
  state.runs.forEach(r => {
    if (!dateMap[r.date]) dateMap[r.date] = { runs: [], planned: [] };
    dateMap[r.date].runs.push(r);
  });
  state.plans.forEach(plan => {
    plan.weeks.forEach(week => {
      week.runs.forEach(run => {
        if (run.type !== 'rest' && run.date) {
          if (!dateMap[run.date]) dateMap[run.date] = { runs: [], planned: [] };
          dateMap[run.date].planned.push(run);
        }
      });
    });
  });

  const grid = document.getElementById('calendarGrid');
  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  let html = `<div class="cal-day-headers">${days.map(d=>`<div class="cal-day-hdr">${d}</div>`).join('')}</div><div class="cal-days">`;

  // Prev month filler
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, 1 - (startDow - i));
    const ds = isoDate(d);
    html += `<div class="cal-day other-month"><div class="cal-day-num">${d.getDate()}</div></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = ds === today;
    const info = dateMap[ds];
    const hasRun = info?.runs?.length > 0;
    const hasPlanned = info?.planned?.length > 0;
    const isPast = ds < today;
    let dots = '';
    if (hasPlanned) {
      const missed = isPast && !hasRun;
      dots += `<span class="cal-dot ${missed ? 'missed' : hasRun ? 'completed' : 'planned'}"></span>`;
    }
    if (hasRun && !hasPlanned) dots += `<span class="cal-dot completed"></span>`;
    const sel = state.selectedDate === ds ? 'selected' : '';
    html += `<div class="cal-day ${isToday?'today':''} ${sel}" onclick="selectCalDay('${ds}')">
      <div class="cal-day-num">${d}</div>
      <div class="cal-dot-row">${dots}</div>
    </div>`;
  }

  html += '</div>';
  grid.innerHTML = html;

  if (state.selectedDate) renderCalDetail(state.selectedDate, dateMap);
  else document.getElementById('calDetail').innerHTML = `<div style="color:var(--text3);font-size:13px">Tap a day to see details</div>`;
}

function selectCalDay(ds) {
  state.selectedDate = ds;
  renderCalendar();
}

function renderCalDetail(ds, dateMap) {
  const info = dateMap[ds] || { runs:[], planned:[] };
  const el = document.getElementById('calDetail');
  const d = new Date(ds);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let html = `<div class="cal-detail-date">${d.toLocaleDateString('en-GB',{weekday:'long'}).toUpperCase()}, ${d.getDate()} ${months[d.getMonth()].toUpperCase()} ${d.getFullYear()}</div>`;

  if (info.planned.length > 0) {
    html += `<div class="section-title" style="margin-bottom:8px">PLANNED</div>`;
    info.planned.forEach(p => {
      html += `<div class="cal-detail-item">
        <div class="cal-detail-label type-${p.type}">${p.type.toUpperCase()}</div>
        <div class="cal-detail-val">${p.km} km${p.note ? ' — '+p.note : ''}</div>
      </div>`;
    });
  }
  if (info.runs.length > 0) {
    html += `<div class="section-title" style="margin-top:12px;margin-bottom:8px">COMPLETED</div>`;
    info.runs.forEach(r => {
      html += `<div class="cal-detail-item">
        <div class="cal-detail-label type-${r.type}">${r.type.toUpperCase()}</div>
        <div class="cal-detail-val">${parseFloat(r.distance).toFixed(1)} km · ${r.pace ? r.pace+' /km' : r.duration || ''}</div>
      </div>`;
    });
  }
  if (!info.planned.length && !info.runs.length) {
    html += `<div style="color:var(--text3);font-size:13px">Rest day</div>`;
  }
  el.innerHTML = html;
}

function changeMonth(dir) {
  state.calMonth += dir;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  state.selectedDate = null;
  renderCalendar();
}

// ===== RUN DETAIL =====
function showRunDetail(id) {
  const run = state.runs.find(r => r.id === id);
  if (!run) return;
  const body = document.getElementById('runDetailBody');
  body.innerHTML = `
    <div class="cal-detail-date">${fmtDate(run.date)}</div>
    <div class="today-run-type" style="color:${typeColor(run.type)}">${run.type.toUpperCase()}</div>
    <div style="height:16px"></div>
    <div class="cal-detail-item"><div class="cal-detail-label">DISTANCE</div><div class="cal-detail-val">${parseFloat(run.distance).toFixed(2)} km</div></div>
    <div class="cal-detail-item"><div class="cal-detail-label">DURATION</div><div class="cal-detail-val">${run.duration || '—'}</div></div>
    <div class="cal-detail-item"><div class="cal-detail-label">PACE</div><div class="cal-detail-val">${run.pace ? run.pace + ' min/km' : '—'}</div></div>
    <div class="cal-detail-item"><div class="cal-detail-label">HEART RATE</div><div class="cal-detail-val">${run.hr ? run.hr + ' bpm' : '—'}</div></div>
    <div class="cal-detail-item"><div class="cal-detail-label">EFFORT (RPE)</div><div class="cal-detail-val">${run.rpe || '—'}/10</div></div>
    <div class="cal-detail-item"><div class="cal-detail-label">SOURCE</div><div class="cal-detail-val">${run.source === 'garmin_gpx' ? '📍 Garmin GPX' : '✍️ Manual'}</div></div>
    ${run.notes ? `<div class="cal-detail-item"><div class="cal-detail-label">NOTES</div><div class="cal-detail-val">${run.notes}</div></div>` : ''}
    <div style="height:12px"></div>
    <button class="btn-danger" onclick="deleteRun('${run.id}')">DELETE RUN</button>`;
  openModal('modalRunDetail');
}

function deleteRun(id) {
  if (!confirm('Delete this run?')) return;
  state.runs = state.runs.filter(r => r.id !== id);
  save();
  closeModal('modalRunDetail');
  renderDashboard();
  showToast('Run deleted');
}

// ===== PROFILE =====
function renderProfile() {
  document.getElementById('profileName').value = state.profile.name !== 'RUNNER' ? state.profile.name : '';
  document.getElementById('profileAge').value = state.profile.age || '';
  document.getElementById('profileWeight').value = state.profile.weight || '';
  // Stats
  const totalKm = state.runs.reduce((s,r) => s + (parseFloat(r.distance)||0), 0);
  document.getElementById('totalKm').textContent = Math.round(totalKm);
  document.getElementById('totalRuns').textContent = state.runs.length;
  const paces = state.runs.filter(r => r.pace).map(r => parsePace(r.pace)).filter(p => p > 0);
  if (paces.length > 0) {
    const best = Math.min(...paces);
    const bm = Math.floor(best), bs = Math.round((best-bm)*60).toString().padStart(2,'0');
    document.getElementById('bestPace').textContent = `${bm}:${bs}`;
  }
  const longest = Math.max(0, ...state.runs.map(r => parseFloat(r.distance)||0));
  document.getElementById('longestRun').textContent = longest.toFixed(1);
}

function saveProfile() {
  const name = document.getElementById('profileName').value.trim().toUpperCase();
  state.profile.name = name || 'RUNNER';
  state.profile.age = document.getElementById('profileAge').value;
  state.profile.weight = document.getElementById('profileWeight').value;
  save();
  showToast('Profile saved ✓', 'success');
}

function exportData() {
  const data = { profile: state.profile, runs: state.runs, plans: state.plans, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stride-backup-${isoDate()}.json`;
  a.click();
}

function confirmReset() {
  if (confirm('Reset ALL data? This cannot be undone.')) {
    localStorage.removeItem('stride_state');
    state.runs = []; state.plans = [];
    state.profile = { name: 'RUNNER', age: '', weight: '', level: 'beginner', goal: 'marathon' };
    renderDashboard();
    showToast('Data reset');
  }
}

// ===== MODAL BACKDROP CLOSE =====
document.querySelectorAll('.modal-backdrop').forEach(el => {
  el.addEventListener('click', (e) => {
    if (e.target === el) el.classList.remove('open');
  });
});

// ===== INIT =====
load();
document.getElementById('userName').textContent = state.profile.name || 'RUNNER';

// Splash
setTimeout(() => {
  document.getElementById('splash').classList.add('hide');
  setTimeout(() => document.getElementById('splash').remove(), 700);
  renderDashboard();
}, 1600);

// Set today date on log
const logDateEl = document.getElementById('logDate');
if (logDateEl) logDateEl.value = isoDate();
