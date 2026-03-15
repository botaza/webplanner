// js/app.js
let currentScreen = 'screen-dashboard';
let eventsData = [];
let expensesData = [];
let incomeData = [];

// ================== HASHTAG SUGGESTIONS ==================
const COMMON_HASHTAGS = [
    "#meeting", "#call", "#doctor", "#gym", "#study",
    "#travel", "#birthday", "#payment", "#deadline", "#family",
    "#shopping", "#repair", "#course", "#exam", "#flight"
];

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
    input.value = tag;
    
    document.querySelectorAll('#hashtag-suggestions .hashtag-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.tag === tag);
    });
}

// ================== EXPENSE TOOLS ==================
const EXPENSE_TOOLS = [
    {code: "gp",     name: "GP (Gas)"},
    {code: "hal",    name: "Halal"},
    {code: "sb",     name: "SB (Supermarket)"},
    {code: "ren",    name: "Rent"},
    {code: "oz",     name: "OZON"},
    {code: "ya",     name: "Yandex"},
    {code: "cert",   name: "Certificate"},
    {code: "cash",   name: "Cash"},
    {code: "transfer", name: "Transfer"},
    {code: "other",  name: "Other…"}
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

// ================== EXPENSE CATEGORIES (emoji) ==================
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

// ================== CORE FUNCTIONS ==================
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const idx = ['dashboard','planner','expenses','income','more'].indexOf(screenId.split('-')[1]);
    if (idx >= 0) document.querySelectorAll('.nav-item')[idx].classList.add('active');
    
    currentScreen = screenId;
    if (screenId === 'screen-planner') loadPlanner();
    if (screenId === 'screen-expenses') loadExpenses();
    if (screenId === 'screen-income') loadIncome();
    if (screenId === 'screen-dashboard') loadDashboard();
}

async function api(action, body = {}) {
    const form = new FormData();
    form.append('action', action);
    Object.keys(body).forEach(k => form.append(k, body[k]));
    
    try {
        const res = await fetch('php/api.php', {
            method: 'POST',
            body: form
        });
        const data = await res.json();
        return data;
    } catch (err) {
        console.error('API fetch error:', err);
        throw err;
    }
}

// ================== EVENTS / PLANNER ==================
async function loadPlanner() {
    const data = await api('get_events');
    eventsData = data || [];
    renderPlanner(eventsData);
}

function renderPlanner(list) {
    const container = document.getElementById('planner-list');
    container.innerHTML = '';
    
    list.forEach(ev => {
        const dt = new Date(ev.dt);
        const card = document.createElement('div');
        card.className = 'bg-zinc-900 rounded-3xl p-5 card flex gap-4';
        card.innerHTML = `
            <div class="flex-1">
                <div class="text-xs text-zinc-500">${dt.toLocaleDateString('ru-RU', {weekday:'short', day:'numeric', month:'short'})}</div>
                <div class="font-medium text-lg mt-1">${ev.desc}</div>
                <div class="flex gap-2 text-xs mt-2">
                    <span class="bg-zinc-800 px-3 py-1 rounded-2xl">${ev.hashtag || '#'}</span>
                    ${ev.place ? `<span class="bg-zinc-800 px-3 py-1 rounded-2xl">${ev.place}</span>` : ''}
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

function showAddEventModal() {
    document.getElementById('event-dt').value = new Date().toISOString().slice(0,16);
    document.getElementById('event-desc').value = '';
    document.getElementById('event-hashtag').value = '';
    document.getElementById('event-place').value = '';
    document.getElementById('event-recurrence').value = 'none';
    
    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('modal-event').classList.add('flex');
    
    renderHashtagSuggestions();
    selectHashtag('');
}

async function saveEvent() {
    const dt = document.getElementById('event-dt').value;
    if (!dt) {
        alert("Please select date and time");
        return;
    }

    const payload = {
        dt: dt.replace('T', ' '),
        desc: document.getElementById('event-desc').value.trim() || '(no description)',
        hashtag: document.getElementById('event-hashtag').value.trim(),
        place: document.getElementById('event-place').value.trim(),
        recurrence: document.getElementById('event-recurrence').value
    };

    try {
        const res = await api('add_event', payload);
        if (res.success) {
            hideModal('modal-event');
            loadPlanner();
            loadDashboard();
        } else {
            alert("Save failed: " + (res.error || "unknown response"));
        }
    } catch (err) {
        console.error(err);
        alert("Error saving event: " + err.message);
    }
}

async function editEvent(id) {
    const ev = eventsData.find(e => e.id == id);
    if (!ev) return;

    document.getElementById('event-dt').value = ev.dt.replace(' ', 'T');
    document.getElementById('event-desc').value = ev.desc || '';
    document.getElementById('event-hashtag').value = ev.hashtag || '';
    document.getElementById('event-place').value = ev.place || '';
    document.getElementById('event-recurrence').value = ev.recurrence || 'none';

    const saveBtn = document.querySelector('#modal-event button[onclick^="saveEvent"]');
    if (saveBtn) saveBtn.onclick = () => updateEvent(id);

    document.getElementById('modal-event').classList.remove('hidden');
    document.getElementById('modal-event').classList.add('flex');

    renderHashtagSuggestions();
    if (ev.hashtag) selectHashtag(ev.hashtag);
}

async function updateEvent(id) {
    const dt = document.getElementById('event-dt').value;
    if (!dt) return alert("Date & time required");

    const payload = {
        id,
        dt: dt.replace('T', ' '),
        desc: document.getElementById('event-desc').value.trim(),
        hashtag: document.getElementById('event-hashtag').value.trim(),
        place: document.getElementById('event-place').value.trim(),
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

// ================== EXPENSES ==================
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
                    ${exp.desc ? ` • ${exp.desc}` : ''}
                </div>
            </div>
            <div onclick="deleteExpense('${exp.id}'); event.stopPropagation()" 
                 class="text-red-400 text-2xl cursor-pointer">🗑</div>
        </div>
    `).join('');
}

function showAddExpenseModal() {
    document.getElementById('exp-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    selectedExpenseTool = null;
    selectedExpenseCategory = null;
    
    document.getElementById('modal-expense').classList.remove('hidden');
    document.getElementById('modal-expense').classList.add('flex');
    
    renderExpenseTools();
    renderExpenseCategories();
    document.getElementById('exp-tool-other-group').classList.add('hidden');
}

async function saveExpense() {
    if (!selectedExpenseTool) {
        alert("Please select a tool");
        return;
    }
    if (!selectedExpenseCategory) {
        alert("Please select a category");
        return;
    }

    let toolValue = selectedExpenseTool;
    if (selectedExpenseTool === 'other') {
        const custom = document.getElementById('exp-tool-other').value.trim();
        if (!custom) {
            alert("Please specify the other tool");
            return;
        }
        toolValue = custom;
    }

    const amountStr = document.getElementById('exp-amount').value.trim();
    const amount = parseFloat(amountStr);
    if (!amountStr || isNaN(amount) || amount <= 0) {
        alert("Please enter a valid positive amount");
        return;
    }

    const payload = {
        date: document.getElementById('exp-date').value,
        amount: amount,
        tool: toolValue,
        category: selectedExpenseCategory,
        desc: document.getElementById('exp-desc').value.trim()
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

// ================== INCOME ==================
async function showAddIncomeModal() {
    document.getElementById('inc-date').value = new Date().toISOString().slice(0,10);
    document.getElementById('inc-amount').value = '';
    document.getElementById('inc-desc').value = '';
    
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
        date: document.getElementById('inc-date').value,
        amount: amount,
        desc: document.getElementById('inc-desc').value.trim()
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
                <div class="text-sm text-zinc-400">${inc.desc||''}</div>
            </div>
            <div onclick="deleteIncome('${inc.id}');event.stopPropagation()" 
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

// ================== DASHBOARD ==================
async function loadDashboard() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    
    const exps = await api('get_expenses') || [];
    const incs = await api('get_income') || [];
    
    let expTotal = exps
        .filter(e => e.date.startsWith(monthKey))
        .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    
    let incTotal = incs
        .filter(i => i.date.startsWith(monthKey))
        .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    
    document.getElementById('dash-exp-total').textContent = `−${expTotal.toLocaleString('ru-RU')}`;
    document.getElementById('dash-inc-total').textContent = `+${incTotal.toLocaleString('ru-RU')}`;
    
    const evs = await api('get_events') || [];
    const upcoming = evs
        .filter(e => new Date(e.dt) > now)
        .sort((a,b) => new Date(a.dt) - new Date(b.dt))
        .slice(0,3);
    
    document.getElementById('upcoming-list').innerHTML = upcoming.map(e => `
        <div class="bg-zinc-900 rounded-3xl p-4 text-sm flex justify-between">
            <div>${e.desc}</div>
            <div class="text-emerald-400">${new Date(e.dt).toLocaleDateString('ru-RU', {day:'numeric', month:'short'})}</div>
        </div>
    `).join('');
}

// ================== UTILITIES ==================
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
    const blob = new Blob([JSON.stringify({events:evs, expenses:exps, income:incs}, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planner-backup.json';
    a.click();
}

function showMonthPicker(type) {
    alert("Month stats coming soon...");
}

// PWA service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

// INIT
window.onload = async () => {
    await api('init');
    switchScreen('screen-dashboard');
    loadDashboard();
    
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
};