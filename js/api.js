// js/api.js

export async function api(action, body = {}, options = {}) {
    const isJson = options.json === true;

    try {
        let res;

        if (isJson) {
            // JSON mode (for bulk operations)
            res = await fetch('php/api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action,
                    ...body
                })
            });
        } else {
            // Default FormData mode
            const form = new FormData();
            form.append('action', action);

            Object.keys(body).forEach(k => {
                form.append(k, body[k]);
            });

            res = await fetch('php/api.php', {
                method: 'POST',
                body: form
            });
        }

        const data = await res.json();
        return data;

    } catch (err) {
        console.error('API fetch error:', err);
        throw err;
    }
}

/* =========================================================
   PATCH: helper wrappers (this fixes your error)
   ========================================================= */

// Simple POST (FormData)
export function apiPost(action, body = {}) {
    return api(action, body);
}

// Simple GET-style (still POST under the hood, for consistency)
export function apiGet(action) {
    return api(action, {});
}

// JSON POST (for bulk operations like save_expenses)
export function apiPostJSON(action, body = {}) {
    return api(action, body, { json: true });
}