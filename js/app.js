// js/app.js

// ================== PASSWORD CONFIG ==========================================
// Change APP_PASSWORD to update the app password
const APP_PASSWORD = 'phoenix';

// ================== LOCK SCREEN ==============================================
function isUnlocked() {
    return localStorage.getItem('planner_unlocked') === '1';
}

function showLockScreen() {
    document.body.insertAdjacentHTML('beforeend', `
        <div id="lock-screen"
             style="position:fixed;inset:0;background:#09090b;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px;">
            <div style="width:56px;height:56px;background:#22c55e;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;">P</div>
            <div style="font-size:22px;font-weight:600;color:#f4f4f5;">Planner</div>
            <div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap:12px;">
                <input id="lock-input"
                       type="password"
                       placeholder="Enter password"
                       autocomplete="current-password"
                       style="width:100%;background:#27272a;border:1px solid #3f3f46;border-radius:16px;padding:16px 20px;font-size:18px;color:#f4f4f5;outline:none;box-sizing:border-box;text-align:center;letter-spacing:4px;"
                       onkeydown="if(event.key==='Enter') attemptUnlock()">
                <div id="lock-error"
                     style="color:#f87171;font-size:14px;text-align:center;min-height:20px;"></div>
                <button onclick="attemptUnlock()"
                        style="width:100%;background:#22c55e;border:none;border-radius:16px;padding:16px;font-size:17px;font-weight:600;color:#fff;cursor:pointer;">
                    Unlock
                </button>
            </div>
        </div>
    `);
    setTimeout(() => document.getElementById('lock-input')?.focus(), 100);
}

function attemptUnlock() {
    const input = document.getElementById('lock-input');
    if (!input) return;
    if (input.value === APP_PASSWORD) {
        localStorage.setItem('planner_unlocked', '1');
        document.getElementById('lock-screen')?.remove();
        bootApp();
    } else {
        input.value = '';
        const err = document.getElementById('lock-error');
        if (err) {
            err.textContent = 'Incorrect password';
            setTimeout(() => { err.textContent = ''; }, 2000);
        }
        input.style.borderColor = '#f87171';
        setTimeout(() => { input.style.borderColor = '#3f3f46'; }, 600);
        input.focus();
    }
}

// ─────────────────────────────────────────────────────────────────────────────

let currentScreen = 'screen-dashboard';
let eventsData    = [];
let expensesData  = [];
let incomeData    = [];
let messaging     = null;

const VAPID_KEY = 'BMlwBTFnXAZuDBkyK8UENXQz-kUTTzZGy1HEoNXbV6l-MmUyTilUJmXbVNs-vetYYHUvjLfAfk24hTHU4lJMxYY';

// ================== UTC+10 DATE HELPERS ======================================
const UTC_OFFSET_MS = 10 * 60 * 60 * 1000;

function nowUTC10()         { return new Date(Date.now() + UTC_OFFSET_MS); }
function todayString()      { return nowUTC10().toISOString().slice(0, 10); }
function nowDatetimeLocal() { return nowUTC10().toISOString().slice(0, 16); }
function currentMonthKey()  { return nowUTC10().toISOString().slice(0, 7);  }
function nowAsDatetimeString() {
    return nowUTC10().toISOString().slice(0, 16).replace('T', ' ');
}

// ================== HASHTAG SUGGESTIONS ======================================
const COMMON_HASHTAGS = ['#pers', '#cons', '#job', '#event', '#control'];

function renderHashtagSuggestions() {
    const container = document.getElementById('hashtag-suggestions');
    if (!container) return;
    container.innerHTML = COMMON_HASHTAGS.map(tag => `
        <div class="hashtag-chip"
             onclick="selectHashtag('${tag}')"
             data-tag="${tag}">
            ${tag}
        </div>
    `).join('');
}

function selectHashtag(tag) {
    const input = document.getElementById('event-hashtag');
    // Toggle off if already selected
    if (input.value === tag) {
        input.value = '';
        document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
        return;
    }
    input.value = tag;
    document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.tag === tag);
    });
}

// ================== PLACE QUICK BUTTONS ======================================
const PLACE_SUGGESTIONS = ['?', 'Office', 'Home', 'Online'];

function renderPlaceSuggestions() {
    const container = document.getElementById('place-suggestions');
    if (!container) return;
    container.innerHTML = PLACE_SUGGESTIONS.map(p => `
        <div class="hashtag-chip"
             onclick="selectPlace('${p}')"
             data-place="${p}">
            ${p}
        </div>
    `).join('');
}

function selectPlace(val) {
    const input = document.getElementById('event-place');
    if (input.value === val) {
        input.value = '';
        document.querySelectorAll('#place-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
        return;
    }
    input.value = val;
    document.querySelectorAll('#place-suggestions .hashtag-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.place === val);
    });
}

// ================== DURATION QUICK BUTTONS ===================================
const DURATION_SUGGESTIONS = ['?', '15', '30', '45', '60', '90', '120'];

function renderDurationSuggestions() {
    const container = document.getElementById('duration-suggestions');
    if (!container) return;
    container.innerHTML = DURATION_SUGGESTIONS.map(d => `
        <div class="hashtag-chip"
             onclick="selectDuration('${d}')"
             data-dur="${d}">
            ${d === '?' ? '?' : d + ' min'}
        </div>
    `).join('');
}

function selectDuration(val) {
    const input = document.getElementById('event-duration');
    if (input.value === val) {
        input.value = '';
        document.querySelectorAll('#duration-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
        return;
    }
    input.value = val;
    document.querySelectorAll('#duration-suggestions .hashtag-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.dur === val);
    });
}

// ================== EXPENSE TOOLS ============================================
const EXPENSE_TOOLS = [
    {code: "gp",       name: "GP"},
    {code: "hal",      name: "Hal"},
    {code: "sb",       name: "SB"},
    {code: "ren",      name: "Ren"},
    {code: "oz",       name: "OZON"},
    {code: "ya",       name: "Yandex"},
    {code: "cert",     name: "Certificate"},
    {code: "cash",     name: "Cash"},
    {code: "transfer", name: "Transfer"},
    {code: "other",    name: "Other…"}
];

let selectedExpenseTool = null;

function renderExpenseTools() {
    const container = document.getElementById('exp-tool-buttons');
    if (!container) return;
    container.innerHTML = EXPENSE_TOOLS.map(t => `
        <div class="tool-btn ${t.code === selectedExpenseTool ? 'active' : ''}"
             data-code="${t.code}"
             onclick="selectExpenseTool('${t.code}')">
            ${t.name}
        </div>
    `).join('');
}

function selectExpenseTool(code) {
    selectedExpenseTool = code;
    document.querySelectorAll('#exp-tool-buttons .tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.code === code);
    });
    const other = document.getElementById('exp-tool-other-group');
    if (code === 'other') {
        other.classList.remove('hidden');
    } else {
        other.classList.add('hidden');
        document.getElementById('exp-tool-other').value = '';
    }
}

// ================== EXPENSE CATEGORIES =======================================
const EXPENSE_CATEGORIES = [
    {emoji: "🍔", name: "food"},
    {emoji: "🚗", name: "transport"},
    {emoji: "✈️", name: "travel"},
    {emoji: "🏠", name: "housing"},
    {emoji: "💊", name: "health"},
    {emoji: "🚫", name: "notmy"},
    {emoji: "🎮", name: "fun"},
    {emoji: "🛒", name: "shop"},
    {emoji: "➡️", name: "transfer"},
    {emoji: "🎓", name: "education"},
    {emoji: "🧾", name: "bills"},
    {emoji: "🎁", name: "gifts"},
    {emoji: "📲", name: "sbp"},
    {emoji: "📦", name: "other"},
];

let selectedExpenseCategory = null;

function renderExpenseCategories() {
    const container = document.getElementById('exp-category-buttons');
    if (!container) return;
    container.innerHTML = EXPENSE_CATEGORIES.map(c => `
        <div class="category-btn ${c.name === selectedExpenseCategory ? 'active' : ''}"
             title="${c.name}"
             onclick="selectExpenseCategory('${c.name}')">
            ${c.emoji}
        </div>
    `).join('');
}

function selectExpenseCategory(name) {
    selectedExpenseCategory = name;
    document.querySelectorAll('#exp-category-buttons .category-btn').forEach(b => {
        b.classList.toggle('active', b.title === name);
    });
}

// ================== CORE FUNCTIONS ===========================================
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const idx = ['dashboard','planner','expenses','income','more']
        .indexOf(screenId.split('-')[1]);
    if (idx >= 0) document.querySelectorAll('.nav-item')[idx].classList.add('active');

    currentScreen = screenId;
    if (screenId === 'screen-planner')   loadPlanner();
    if (screenId === 'screen-expenses')  loadExpenses();
    if (screenId === 'screen-income')    loadIncome();
    if (screenId === 'screen-dashboard') loadDashboard();
}

async function api(action, body = {}) {
    const form = new FormData();
    form.append('action', action);
    Object.keys(body).forEach(k => form.append(k, body[k]));
    try {
        const res  = await fetch('php/api.php', { method: 'POST', body: form });
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('API fetch error:', err);
        throw err;
    }
}

// ================== EVENTS / PLANNER =========================================
async function loadPlanner() {
    const data = await api('get_events');
    eventsData = data || [];
    renderPlanner(eventsData);
}

function renderPlanner(list) {
    const container = document.getElementById('planner-list');
    container.innerHTML = '';
    list.forEach(ev => {
        const dt   = new Date(ev.dt.replace(' ', 'T'));
        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-3xl p-5 card flex gap-4';
        card.innerHTML = `
            <div class="flex-1">
                <div class="text-xs text-zinc-500">${dt.toLocaleDateString('ru-RU', {weekday:'short', day:'numeric', month:'short'})}</div>
                <div class="font-medium text-lg mt-1">${ev.desc}</div>
                <div class="flex gap-2 text-xs mt-2 flex-wrap">
                    ${ev.hashtag ? `<span class="bg-zinc-800 px-3 py-1 rounded-2xl">${ev.hashtag}</span>` : ''}
                    ${ev.place   ? `<span class="bg-zinc-800 px-3 py-1 rounded-2xl">📍 ${ev.place}</span>` : ''}
                    ${ev.duration ? `<span class="bg-zinc-800 px-3 py-1 rounded-2xl">⏱ ${ev.duration} min</span>` : ''}
                </div>
            </div>
            <div class="flex flex-col items-end justify-between">
                <div onclick="editEvent('${ev.id}'); event.stopPropagation()"
                     class="text-emerald-400 text-xl cursor-pointer">✏️</div>
                <div onclick="deleteEvent('${ev.id}'); event.stopPropagation()"
                     class="text-red-400 text-xl cursor-pointer">🗑</div>
            </div>
        `;
        card.onclick = () => markComplete(ev.id);
        container.appendChild(card);
    });
}

function filterPlanner() {
    const term = document.getElementById('planner-filter').value.toLowerCase();
    const filtered = eventsData.filter(e =>
        (e.desc?.toLowerCase().includes(term)) ||
        (e.hashtag?.toLowerCase().includes(term))
    );
    renderPlanner(filtered);
}

// Default occurrence counts per recurrence type
const RECURRENCE_DEFAULTS = { weekly: 10, biweekly: 6, monthly: 6, yearly: 3 };

function onRecurrenceChange() {
    const rec = document.getElementById('event-recurrence').value;
    const section = document.getElementById('recurrence-occurrences-section');
    if (rec === 'none') {
        section.classList.add('hidden');
        document.getElementById('occurrence-preview').innerHTML = '';
    } else {
        section.classList.remove('hidden');
        document.getElementById('event-occurrences').value = RECURRENCE_DEFAULTS[rec] || 6;
        updateOccurrencePreview();
    }
}

function getRecurrenceDates(startDt, recurrence, count) {
    const dates = [];
    const base = new Date(startDt.replace(' ', 'T'));
    for (let i = 0; i < count; i++) {
        const d = new Date(base);
        if (recurrence === 'weekly')   d.setDate(base.getDate() + i * 7);
        if (recurrence === 'biweekly') d.setDate(base.getDate() + i * 14);
        if (recurrence === 'monthly')  d.setMonth(base.getMonth() + i);
        if (recurrence === 'yearly')   d.setFullYear(base.getFullYear() + i);
        const pad = n => String(n).padStart(2, '0');
        const formatted = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
            + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
        dates.push(formatted);
    }
    return dates;
}

function updateOccurrencePreview() {
    const rec     = document.getElementById('event-recurrence').value;
    const count   = parseInt(document.getElementById('event-occurrences').value) || 0;
    const dt      = document.getElementById('event-dt').value;
    const preview = document.getElementById('occurrence-preview');
    if (!preview) return;
    if (!dt || rec === 'none' || count < 1) { preview.innerHTML = ''; return; }

    const dates = getRecurrenceDates(dt.replace('T', ' ') + ':00', rec, count);
    preview.innerHTML = dates.map((d, i) => {
        const dateObj = new Date(d.replace(' ', 'T'));
        const label   = dateObj.toLocaleDateString('ru-RU', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
        return `<div class="text-xs text-zinc-400 flex items-center gap-2">
            <span class="text-emerald-500 shrink-0">${i+1}.</span>
            <span>${label}</span>
        </div>`;
    }).join('');
}

function showAddEventModal() {
    document.getElementById('event-dt').value         = nowDatetimeLocal();
    document.getElementById('event-desc').value       = '';
    document.getElementById('event-hashtag').value    = '';
    document.getElementById('event-place').value      = '';
    document.getElementById('event-duration').value   = '';
    document.getElementById('event-recurrence').value = 'none';
    document.getElementById('recurrence-occurrences-section').classList.add('hidden');
    document.getElementById('occurrence-preview').innerHTML = '';

    // Reset all chip selections
    document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('#place-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('#duration-suggestions .hashtag-chip').forEach(c => c.classList.remove('active'));

    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('modal-event').classList.add('flex');

    renderHashtagSuggestions();
    renderPlaceSuggestions();
    renderDurationSuggestions();
}

async function saveEvent() {
    const dt = document.getElementById('event-dt').value;
    if (!dt) { alert("Please select date and time"); return; }

    const recurrence = document.getElementById('event-recurrence').value;
    const base = {
        desc:       document.getElementById('event-desc').value.trim() || '(no description)',
        hashtag:    document.getElementById('event-hashtag').value.trim(),
        place:      document.getElementById('event-place').value.trim(),
        duration:   document.getElementById('event-duration').value.trim(),
        recurrence
    };

    // Build list of datetimes to save
    let datetimes = [dt.replace('T', ' ') + ':00'];
    if (recurrence !== 'none') {
        const count = parseInt(document.getElementById('event-occurrences').value) || 1;
        datetimes = getRecurrenceDates(dt.replace('T', ' ') + ':00', recurrence, count);
    }

    // Generate a shared group ID for recurring events
    const groupId = recurrence !== 'none' ? ('grp_' + Date.now()) : '';

    try {
        for (const dtStr of datetimes) {
            const payload = { ...base, dt: dtStr, recurrence_group: groupId };
            const res = await api('add_event', payload);
            if (!res.success) {
                alert("Save failed at " + dtStr + ": " + (res.error || "unknown"));
                return;
            }
        }
        hideModal('modal-event');
        loadPlanner();
        loadDashboard();
    } catch (err) {
        console.error(err);
        alert("Error saving event: " + err.message);
    }
}

async function editEvent(id) {
    const ev = eventsData.find(e => e.id == id);
    if (!ev) return;

    document.getElementById('event-dt').value         = ev.dt.replace(' ', 'T');
    document.getElementById('event-desc').value       = ev.desc     || '';
    document.getElementById('event-hashtag').value    = ev.hashtag  || '';
    document.getElementById('event-place').value      = ev.place    || '';
    document.getElementById('event-duration').value   = ev.duration || '';
    document.getElementById('event-recurrence').value = ev.recurrence || 'none';

    const saveBtn = document.querySelector('#modal-event button[onclick^="saveEvent"]');
    if (saveBtn) saveBtn.onclick = () => updateEvent(id);

    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('modal-event').classList.add('flex');

    renderHashtagSuggestions();
    renderPlaceSuggestions();
    renderDurationSuggestions();

    // Restore chip active states
    if (ev.hashtag)  selectHashtag(ev.hashtag);
    if (ev.place)    selectPlace(ev.place);
    if (ev.duration) selectDuration(ev.duration);

    // Restore recurrence occurrences section (hide it — editing a single instance)
    document.getElementById('recurrence-occurrences-section').classList.add('hidden');
    document.getElementById('occurrence-preview').innerHTML = '';
}

async function updateEvent(id) {
    const dt = document.getElementById('event-dt').value;
    if (!dt) return alert("Date & time required");

    const payload = {
        id,
        dt:         dt.replace('T', ' '),
        desc:       document.getElementById('event-desc').value.trim(),
        hashtag:    document.getElementById('event-hashtag').value.trim(),
        place:      document.getElementById('event-place').value.trim(),
        duration:   document.getElementById('event-duration').value.trim(),
        recurrence: document.getElementById('event-recurrence').value
    };

    try {
        const res = await api('update_event', payload);
        if (res.success) {
            hideModal('modal-event');
            loadPlanner();
            loadDashboard();
        } else {
            alert("Update failed");
        }
    } catch (err) {
        console.error(err);
        alert("Error updating event");
    }
}

async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await api('delete_event', {id});
    loadPlanner();
    loadDashboard();
}

async function markComplete(id) {
    if (!confirm('Mark as done?')) return;
    await api('complete_event', {id});
    loadPlanner();
    loadDashboard();
}

// ================== EXPENSES =================================================
async function loadExpenses() {
    const data = await api('get_expenses');
    expensesData = data || [];
    renderExpenses(expensesData);
}

function renderExpenses(list) {
    const container = document.getElementById('expenses-list');
    container.innerHTML = list.map(exp => `
        <div class="bg-zinc-900 rounded-3xl p-5 flex justify-between items-center card">
            <div>
                <div class="text-xs text-zinc-500">${exp.date || '—'}</div>
                <div class="font-semibold text-xl">−${parseFloat(exp.amount || 0).toLocaleString('ru-RU')}</div>
                <div class="text-sm text-zinc-400 mt-1">
                    ${exp.tool || '?'}
                    ${exp.category ? ` • ${exp.category}` : ''}
                    ${exp.desc     ? ` • ${exp.desc}`     : ''}
                </div>
            </div>
            <div onclick="deleteExpense('${exp.id}'); event.stopPropagation()"
                 class="text-red-400 text-2xl cursor-pointer">🗑</div>
        </div>
    `).join('');
}

function showAddExpenseModal() {
    document.getElementById('exp-date').value   = todayString();
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value   = '';
    selectedExpenseTool     = null;
    selectedExpenseCategory = null;

    document.getElementById('modal-expense').classList.remove('hidden');
    document.getElementById('modal-expense').classList.add('flex');

    renderExpenseTools();
    renderExpenseCategories();
    document.getElementById('exp-tool-other-group').classList.add('hidden');
}

async function saveExpense() {
    if (!selectedExpenseTool)     { alert("Please select a tool");     return; }
    if (!selectedExpenseCategory) { alert("Please select a category"); return; }

    let toolValue = selectedExpenseTool;
    if (selectedExpenseTool === 'other') {
        const custom = document.getElementById('exp-tool-other').value.trim();
        if (!custom) { alert("Please specify the other tool"); return; }
        toolValue = custom;
    }

    const amountStr = document.getElementById('exp-amount').value.trim();
    const amount    = parseFloat(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid positive amount");
        return;
    }

    const payload = {
        date:     document.getElementById('exp-date').value,
        amount,
        tool:     toolValue,
        category: selectedExpenseCategory,
        desc:     document.getElementById('exp-desc').value.trim()
    };

    try {
        const res = await api('add_expense', payload);
        if (res?.success) {
            hideModal('modal-expense');
            loadExpenses();
            loadDashboard();
        } else {
            alert("Could not save expense" + (res?.error ? `: ${res.error}` : ""));
        }
    } catch (err) {
        console.error(err);
        alert("Network/server error while saving expense");
    }
}

async function deleteExpense(id) {
    if (!confirm('Delete expense?')) return;
    await api('delete_expense', {id});
    loadExpenses();
    loadDashboard();
}

// ================== INCOME ===================================================
async function showAddIncomeModal() {
    document.getElementById('inc-date').value   = todayString();
    document.getElementById('inc-amount').value = '';
    document.getElementById('inc-desc').value   = '';

    document.getElementById('modal-income').classList.remove('hidden');
    document.getElementById('modal-income').classList.add('flex');
}

async function saveIncome() {
    const amount = parseFloat(document.getElementById('inc-amount').value);
    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount");
        return;
    }

    const payload = {
        date:   document.getElementById('inc-date').value,
        amount,
        desc:   document.getElementById('inc-desc').value.trim()
    };

    try {
        const res = await api('add_income', payload);
        if (res.success) {
            hideModal('modal-income');
            loadIncome();
            loadDashboard();
        } else {
            alert("Save failed");
        }
    } catch (err) {
        console.error(err);
        alert("Error saving income");
    }
}

async function loadIncome() {
    const data = await api('get_income');
    incomeData = data || [];
    renderIncome(incomeData);
}

function renderIncome(list) {
    const container = document.getElementById('income-list');
    container.innerHTML = list.map(inc => `
        <div class="bg-zinc-900 rounded-3xl p-5 flex justify-between items-center card">
            <div>
                <div class="text-xs text-zinc-500">${inc.date}</div>
                <div class="font-semibold text-xl text-emerald-400">+${parseFloat(inc.amount).toLocaleString('ru-RU')}</div>
                <div class="text-sm text-zinc-400">${inc.desc || ''}</div>
            </div>
            <div onclick="deleteIncome('${inc.id}'); event.stopPropagation()"
                 class="text-red-400 text-2xl cursor-pointer">🗑</div>
        </div>
    `).join('');
}

async function deleteIncome(id) {
    if (!confirm('Delete income?')) return;
    await api('delete_income', {id});
    loadIncome();
    loadDashboard();
}

// ================== DASHBOARD ================================================
async function loadDashboard() {
    const monthKey = currentMonthKey();

    const exps = await api('get_expenses') || [];
    const incs = await api('get_income')   || [];

    const expTotal = exps
        .filter(e => e.date.startsWith(monthKey))
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

    const incTotal = incs
        .filter(i => i.date.startsWith(monthKey))
        .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

    document.getElementById('dash-exp-total').textContent = `−${expTotal.toLocaleString('ru-RU')}`;
    document.getElementById('dash-inc-total').textContent = `+${incTotal.toLocaleString('ru-RU')}`;

    const evs    = await api('get_events') || [];
    const nowStr = nowAsDatetimeString();

    const upcoming = evs
        .filter(e => (e.dt || '') > nowStr)
        .sort((a, b) => (a.dt > b.dt ? 1 : -1))
        .slice(0, 5);

    document.getElementById('upcoming-list').innerHTML = upcoming.length
        ? upcoming.map(e => {
            const dt      = new Date(e.dt.replace(' ', 'T'));
            const timeStr = dt.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
            const dateStr = dt.toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'});
            return `
                <div class="bg-zinc-900 rounded-3xl p-4 text-sm flex justify-between items-center">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium">${e.desc}</div>
                        <div class="text-xs text-zinc-500 mt-0.5 flex flex-wrap gap-1 items-center">
                            <span class="text-emerald-400 font-medium">🕐 ${timeStr}</span>
                            ${e.hashtag  ? `<span class="bg-zinc-800 px-2 py-0.5 rounded-xl">${e.hashtag}</span>` : ''}
                            ${e.place    ? `<span>📍 ${e.place}</span>` : ''}
                            ${e.duration ? `<span>⏱ ${e.duration} min</span>` : ''}
                        </div>
                    </div>
                    <div class="text-zinc-400 text-right shrink-0 ml-3 text-xs">
                        <div class="font-medium text-sm text-zinc-300">${dateStr}</div>
                    </div>
                </div>
            `;
          }).join('')
        : `<div class="text-zinc-500 text-sm text-center py-4">No upcoming events</div>`;
}

// ================== PUSH NOTIFICATIONS (FCM) =================================
async function registerFcmToken(token) {
    const storageKey = 'fcm_registered_token';
    const savedToken = localStorage.getItem(storageKey);

    if (savedToken === token) {
        console.log('FCM token unchanged, skipping re-registration.');
        return;
    }

    try {
        const res = await fetch('php/save-subscription.php', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token })
        });

        if (res.ok) {
            const isFirstTime = !savedToken;
            localStorage.setItem(storageKey, token);
            if (isFirstTime) {
                alert("Notifications enabled! You'll receive event reminders.");
            } else {
                console.log('FCM token refreshed silently.');
            }
        } else {
            console.error('Failed to save FCM token on server.');
        }
    } catch (err) {
        console.error('Error saving FCM token:', err);
    }
}

async function enableNotifications() {
    if (typeof firebase === 'undefined') {
        console.warn("Firebase SDK not loaded.");
        return;
    }
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            alert("Notifications blocked. You can change this in your browser settings.");
            return;
        }

        const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
        const token = await messaging.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (token) {
            console.log('FCM Token obtained.');
            await registerFcmToken(token);
        } else {
            console.warn('No FCM token received — check VAPID key and service worker.');
        }
    } catch (err) {
        console.error('Error enabling notifications:', err);
        alert("Could not enable notifications: " + err.message);
    }
}

function initForegroundMessaging() {
    if (!messaging) return;
    messaging.onMessage(payload => {
        const { title, body } = payload.notification || {};
        if (title) {
            const toast = document.createElement('div');
            toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg z-[200] text-sm font-medium';
            toast.textContent = `🔔 ${title}: ${body}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }
    });
}

// ================== UTILITIES ================================================
async function takeSnapshot() {
    const res = await api('snapshot');
    if (res.success) alert('Snapshot created!');
}

function hideModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

async function clearAllData() {
    if (!confirm('Clear ALL data permanently?')) return;
    await api('clear_all');
    location.reload();
}

async function exportData() {
    const exps = await api('get_expenses');
    const incs = await api('get_income');
    const evs  = await api('get_events');
    const blob  = new Blob(
        [JSON.stringify({events: evs, expenses: exps, income: incs}, null, 2)],
        {type: 'application/json'}
    );
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'planner-backup.json';
    a.click();
}

function showMonthPicker(type) {
    alert("Month stats coming soon...");
}

// ================== SERVICE WORKER ===========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Cache SW registered'))
        .catch(err => console.error('Cache SW failed:', err));
}

// ================== INIT =====================================================
async function bootApp() {
    await api('init');
    switchScreen('screen-dashboard');
    loadDashboard();

    if (typeof firebase !== 'undefined') {
        messaging = firebase.messaging();
        initForegroundMessaging();
    }

    if (Notification.permission === 'default') {
        await enableNotifications();
    } else if (Notification.permission === 'granted' && messaging) {
        try {
            const registration = await navigator.serviceWorker.register('firebase-messaging-sw.js');
            const token = await messaging.getToken({
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });
            if (token) await registerFcmToken(token);
        } catch (err) {
            console.warn('Silent token refresh failed:', err);
        }
    }
}

window.onload = async () => {
    if (!isUnlocked()) {
        showLockScreen();
        return;
    }
    await bootApp();
};
