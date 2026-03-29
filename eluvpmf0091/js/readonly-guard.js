// js/readonly-guard.js
// GUEST MODE GUARD
// Call requireAdmin() at the top of any write action (add / edit / delete / save).
// If the current role is 'guest', it shows a toast and returns false.
// The caller should bail out immediately when it returns false.
//
// Usage:
//   import { requireAdmin } from './readonly-guard.js';
//
//   async function handleSaveExpense() {
//       if (!requireAdmin()) return;
//       // ... rest of save logic
//   }

import { isGuest } from './lockscreen.js';

/**
 * Check whether the current user has write permission.
 * Shows a toast and returns false if they are a guest.
 * @returns {boolean} true = proceed, false = blocked
 */
export function requireAdmin() {
    if (!isGuest()) return true;
    _showReadonlyToast();
    return false;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastTimer = null;

function _showReadonlyToast() {
    // Reuse existing toast if visible
    let toast = document.getElementById('readonly-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'readonly-toast';
        toast.style.cssText = [
            'position:fixed',
            'bottom:90px',           // above bottom nav
            'left:50%',
            'transform:translateX(-50%)',
            'background:#3f3f46',
            'color:#f4f4f5',
            'padding:10px 20px',
            'border-radius:999px',
            'font-size:14px',
            'z-index:9000',
            'white-space:nowrap',
            'box-shadow:0 4px 24px rgba(0,0,0,0.5)',
            'transition:opacity 0.3s'
        ].join(';');
        document.body.appendChild(toast);
    }

    toast.textContent = '🔒 View-only mode — editing is disabled';
    toast.style.opacity = '1';

    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        toast.style.opacity = '0';
    }, 2800);
}
