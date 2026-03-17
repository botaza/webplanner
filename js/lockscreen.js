// js/lockscreen.js

const APP_PASSWORD = 'phoenix';

function isUnlocked() {
    return localStorage.getItem('planner_unlocked') === '1';
}

function showLockScreen() {
    document.body.insertAdjacentHTML('beforeend', `
        <div id="lock-screen"
             style="position:fixed;inset:0;background:#09090b;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px;">
            <div style="width:56px;height:56px;background:#22c55e;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;">P</div>
            <div style="font-size:22px;font-weight:600;color:#f4f4f5;">Planner</div>
            <div style="width:100%;max-width:320px;display:flex;flex-direction:column;gap-12px;">
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
        window.bootApp();
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

// Keep global access for inline usage if needed
Object.assign(window, {
    isUnlocked,
    showLockScreen,
    attemptUnlock
});

// ✅ ES module exports (required for import)
export {
    isUnlocked,
    showLockScreen,
    attemptUnlock
};