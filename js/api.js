// js/api.js

export async function api(action, body = {}) {
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
