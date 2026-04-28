// >> - js/planner-scratch.js
// js/planner-scratch.js
// Server-backed scratch pad for the Planner tab.
// Text, image attachments, and voice recordings are all persisted on the server.
// Media files are uploaded as actual files (not base64) so there is no JSON bloat.
// The server enforces an 8 MB per-file cap (configurable in api.php: SCRATCH_MAX_BYTES).

import { api } from './api.js';

// ── Collapse state (UI preference only — localStorage fine here) ───────────────
const SCRATCH_COLL = 'planner_scratch_collapsed';

// ── In-memory pending media (staged before save) ──────────────────────────────
let _pendingImageFile = null;   // File object
let _pendingAudioBlob = null;   // Blob from MediaRecorder
let _pendingAudioExt  = 'webm'; // extension hint

let _mediaRecorder    = null;
let _recordingChunks  = [];
let _isRecording      = false;

// ── Blob URL cache (avoids re-fetching the same file) ─────────────────────────
const _mediaCache = {};

// ── Collapse toggle ───────────────────────────────────────────────────────────
function toggleScratchCollapse() {
    const body = document.getElementById('scratch-pad-body');
    const btn  = document.getElementById('scratch-collapse-btn');
    if (!body || !btn) return;
    const hidden = body.classList.toggle('hidden');
    btn.textContent = hidden ? '▶ show' : '▼ hide';
    localStorage.setItem(SCRATCH_COLL, hidden ? '1' : '0');
}

// ── Pending preview (staged image/audio before save) ─────────────────────────
function _renderPendingPreview() {
    const box = document.getElementById('scratch-pending-preview');
    if (!box) return;
    let html = '';

    if (_pendingImageFile) {
        const url = URL.createObjectURL(_pendingImageFile);
        html += `<div class="relative inline-block">
            <img src="${url}" alt="preview"
                 class="max-h-40 rounded-xl border border-zinc-700 object-cover">
            <button onclick="window.scratchClearPendingImage()"
                class="absolute top-1 right-1 bg-zinc-900/80 text-zinc-300 hover:text-red-400 rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none">×</button>
        </div>`;
    }

    if (_pendingAudioBlob) {
        const url = URL.createObjectURL(_pendingAudioBlob);
        html += `<div class="flex items-center gap-2 mt-1">
            <audio controls src="${url}" class="h-8 flex-1" style="height:36px;"></audio>
            <button onclick="window.scratchClearPendingAudio()"
                class="text-zinc-400 hover:text-red-400 text-xs px-2">✕</button>
        </div>`;
    }

    if (html) {
        box.innerHTML = html;
        box.classList.remove('hidden');
    } else {
        box.innerHTML = '';
        box.classList.add('hidden');
    }
}

function scratchAttachImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
        alert('Image is larger than 8 MB and will be rejected by the server. Please choose a smaller file.');
        input.value = '';
        return;
    }
    _pendingImageFile = file;
    _renderPendingPreview();
    input.value = '';
}

function scratchClearPendingImage() {
    _pendingImageFile = null;
    _renderPendingPreview();
}

function scratchClearPendingAudio() {
    _pendingAudioBlob = null;
    _renderPendingPreview();
}

// ── Voice recording ───────────────────────────────────────────────────────────
async function scratchToggleRecording() {
    if (_isRecording) {
        _stopRecording();
    } else {
        await _startRecording();
    }
}

async function _startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _recordingChunks = [];

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : '';
        _pendingAudioExt = mimeType.includes('ogg') ? 'ogg' : 'webm';

        const opts = mimeType ? { mimeType } : {};
        _mediaRecorder = new MediaRecorder(stream, opts);

        _mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) _recordingChunks.push(e.data);
        };

        _mediaRecorder.onstop = () => {
            _pendingAudioBlob = new Blob(_recordingChunks, { type: _mediaRecorder.mimeType || 'audio/webm' });
            stream.getTracks().forEach(t => t.stop());
            _renderPendingPreview();
        };

        _mediaRecorder.start();
        _isRecording = true;
        _updateRecordBtn();
    } catch (err) {
        alert('Microphone access denied or not available.');
        console.error('[scratch] recording error:', err);
    }
}

function _stopRecording() {
    if (_mediaRecorder && _isRecording) {
        _mediaRecorder.stop();
        _isRecording = false;
        _updateRecordBtn();
    }
}

function _updateRecordBtn() {
    const btn       = document.getElementById('scratch-record-btn');
    const indicator = document.getElementById('scratch-recording-indicator');
    if (btn) {
        btn.textContent = _isRecording ? '⏹' : '🎙';
        btn.classList.toggle('scratch-action-btn--recording', _isRecording);
    }
    if (indicator) indicator.classList.toggle('hidden', !_isRecording);
}

// ── Save note (text first, then media uploads) ────────────────────────────────
async function scratchSave() {
    const textInput = document.getElementById('scratch-text-input');
    const saveBtn   = document.getElementById('scratch-save-btn');
    const text = textInput ? textInput.value.trim() : '';

    if (!text && !_pendingImageFile && !_pendingAudioBlob) return;

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
        // Step 1: create text record — server returns the new note ID
        const res = await api('add_scratch', { text });
        if (!res || !res.success) {
            alert('Failed to save note: ' + (res && res.error ? res.error : 'unknown'));
            return;
        }
        const noteId = res.id;

        // Step 2: upload image if staged
        if (_pendingImageFile) {
            const form = new FormData();
            form.append('action', 'upload_scratch_media');
            form.append('note_id', noteId);
            form.append('kind', 'image');
            form.append('file', _pendingImageFile, _pendingImageFile.name);
            const r = await fetch('php/api.php', { method: 'POST', body: form });
            const j = await r.json();
            if (!j.success) alert('Image upload failed: ' + (j.error || 'unknown'));
        }

        // Step 3: upload audio if staged
        if (_pendingAudioBlob) {
            const form = new FormData();
            form.append('action', 'upload_scratch_media');
            form.append('note_id', noteId);
            form.append('kind', 'audio');
            form.append('file', _pendingAudioBlob, 'voice.' + _pendingAudioExt);
            const r = await fetch('php/api.php', { method: 'POST', body: form });
            const j = await r.json();
            if (!j.success) alert('Audio upload failed: ' + (j.error || 'unknown'));
        }

        // Step 4: clear inputs
        if (textInput) textInput.value = '';
        _pendingImageFile = null;
        _pendingAudioBlob = null;
        _renderPendingPreview();

        await renderScratchList();
    } catch (err) {
        console.error('[scratch] save error:', err);
        alert('Error saving note: ' + err.message);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    }
}

// ── Delete note ───────────────────────────────────────────────────────────────
async function scratchDelete(id) {
    if (!confirm('Delete this note?')) return;
    await api('delete_scratch', { id });
    await renderScratchList();
}

// ── Fetch a media file from server as a Blob URL ──────────────────────────────
async function _getMediaUrl(filename) {
    if (_mediaCache[filename]) return _mediaCache[filename];
    const form = new FormData();
    form.append('action', 'serve_scratch_media');
    form.append('file', filename);
    const res = await fetch('php/api.php', { method: 'POST', body: form });
    if (!res.ok) return null;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    _mediaCache[filename] = url;
    return url;
}

// ── Render saved notes list ───────────────────────────────────────────────────
async function renderScratchList() {
    const container = document.getElementById('scratch-notes-list');
    const countEl   = document.getElementById('scratch-count');
    if (!container) return;

    container.innerHTML = '<div class="text-xs text-zinc-600 text-center py-3">Loading…</div>';

    let notes = [];
    try {
        notes = await api('get_scratch');
        if (!Array.isArray(notes)) notes = [];
    } catch (e) {
        container.innerHTML = '<div class="text-xs text-red-500 text-center py-3">Failed to load notes</div>';
        return;
    }

    if (countEl) countEl.textContent = notes.length ? `(${notes.length})` : '';

    if (!notes.length) {
        container.innerHTML = '<div class="text-xs text-zinc-600 text-center py-3">No notes yet</div>';
        return;
    }

    container.innerHTML = notes.map(note => {
        const date    = new Date(note.ts);
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const images  = (note.media || []).filter(m => m.kind === 'image');
        const audios  = (note.media || []).filter(m => m.kind === 'audio');

        const imageSlots = images.map(m =>
            `<div class="mt-1.5">
                <img data-mediafile="${_esc(m.file)}"
                     src="" alt="loading…"
                     class="scratch-note-image opacity-40"
                     onclick="window.scratchOpenImage('${_esc(m.file)}')">
            </div>`
        ).join('');

        const audioSlots = audios.map(m =>
            `<div class="mt-1.5 flex items-center gap-2">
                <span class="text-xs text-sky-400">🎙</span>
                <audio data-mediafile="${_esc(m.file)}"
                       controls style="height:32px; max-width:200px; flex:1;"></audio>
            </div>`
        ).join('');

        return `
        <div class="scratch-note-card" data-note-id="${_esc(note.id)}">
            <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                    ${note.text ? `<div class="scratch-note-text">${_esc(note.text).replace(/\n/g,'<br>')}</div>` : ''}
                    ${imageSlots}
                    ${audioSlots}
                    <div class="scratch-note-meta">${dateStr} · ${timeStr}</div>
                </div>
                <button onclick="window.scratchDelete('${_esc(note.id)}')"
                    class="shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition text-sm"
                    title="Delete note">🗑</button>
            </div>
        </div>`;
    }).join('');

    // Async-load media blob URLs into the already-rendered img/audio tags
    _hydrateMedia(container);
}

async function _hydrateMedia(container) {
    const imgs   = container.querySelectorAll('img[data-mediafile]');
    const audios = container.querySelectorAll('audio[data-mediafile]');

    for (const img of imgs) {
        try {
            const url = await _getMediaUrl(img.dataset.mediafile);
            if (url) { img.src = url; img.classList.remove('opacity-40'); img.alt = ''; }
            else img.alt = '⚠ not found';
        } catch { img.alt = '⚠ error'; }
    }

    for (const audio of audios) {
        try {
            const url = await _getMediaUrl(audio.dataset.mediafile);
            if (url) audio.src = url;
        } catch { /* silent */ }
    }
}

// ── Image lightbox ────────────────────────────────────────────────────────────
async function scratchOpenImage(filename) {
    const url = await _getMediaUrl(filename);
    if (!url) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
        <div style="position:relative;max-width:100%;max-height:100%;">
            <img src="${url}" style="max-width:100%;max-height:85vh;border-radius:12px;object-fit:contain;">
            <button onclick="this.closest('div').parentElement.remove()"
                style="position:absolute;top:-12px;right:-12px;background:#3f3f46;color:#e4e4e7;border-radius:9999px;width:32px;height:32px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;">×</button>
        </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function _esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initScratchPad() {
    const isCollapsed = localStorage.getItem(SCRATCH_COLL) === '1';
    const body = document.getElementById('scratch-pad-body');
    const btn  = document.getElementById('scratch-collapse-btn');
    if (isCollapsed && body) body.classList.add('hidden');
    if (btn) btn.textContent = isCollapsed ? '▶ show' : '▼ hide';
    renderScratchList();
}

// ── Expose to window ──────────────────────────────────────────────────────────
Object.assign(window, {
    toggleScratchCollapse,
    scratchAttachImage,
    scratchToggleRecording,
    scratchSave,
    scratchDelete,
    scratchClearPendingImage,
    scratchClearPendingAudio,
    scratchOpenImage,
    initScratchPad,
    renderScratchList
});

export { initScratchPad, renderScratchList };
// << - js/planner-scratch.js
