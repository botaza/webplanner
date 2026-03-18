// js/api.js

export async function api(action, body = {}, options = {}) {
    const isJson = options.json === true;

    try {
        let res;

        if (isJson) {
            // 🔥 JSON mode (for bulk operations like save_expenses)
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
            // ✅ Default FormData mode (existing behavior)
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