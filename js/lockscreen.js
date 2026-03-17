// js/lockscreen.js
const APP_PASSWORD = 'phoenix';

function isUnlocked() {
    return localStorage.getItem('planner_unlocked') === '1';
}
function showLockScreen() {
    // ← paste the entire showLockScreen function exactly as it was
}
function attemptUnlock() {
    // ← paste the entire attemptUnlock function exactly
    // (it already calls window.bootApp now — no other change needed)
}

// Global exposure for inline onclick + onkeydown
Object.assign(window, { isUnlocked, showLockScreen, attemptUnlock });