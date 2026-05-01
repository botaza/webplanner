// >> - js/planner-scratch.js
// js/planner-scratch.js
// Server-backed scratch pad for the Planner tab.
// Supports: plain text, image attachment, voice recording, document attachment.
// Media files are uploaded as actual files (not base64) — no JSON bloat.
// Server enforces 8 MB per-file cap (configurable in api.php: SCRATCH_MAX_BYTES).

import { api } from './api.js';

const SCRATCH_COLL = 'planner_scratch_collapsed';

// ── Pending media (staged before save) ───────────────────────────────────────
let _pendingImageFile = null;   // File — image
let _pendingAudioBlob = null;   // Blob — voice recording
let _pendingAudioExt  = 'webm';
let _pendingDocFile   = null;   // File — document

let _mediaRecorder   = null;
let _recordingChunks = [];
let _isRecording     = false;

// ── Blob URL cache ────────────────────────────────────────────────────────────
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

// ── Pending preview ───────────────────────────────────────────────────────────
function _renderPendingPreview() {
    const box = document.getElementById('scratch-pending-preview');
    if (!box) return;
    let html = '';

    if (_pendingImageFile) {
        const url = URL.createObjectURL(_pendingImageFile);
        html += `<div class="relative inline-block mr-2">
            <img src="${url}" alt="preview" class="max-h-40 rounded-xl border border-zinc-700 object-cover">
            <button onclick="window.scratchClearPendingImage()"
                class="absolute top-1 right-1 bg-zinc-900/80 text-zinc-300 hover:text-red-400 rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none">×</button>
        </div>`;
    }

    if (_pendingAudioBlob) {
        const url = URL.createObjectURL(_pendingAudioBlob);
        html += `<div class="flex items-center gap-2 mt-1">
            <audio controls src="${url}" style="height:36px; flex:1;"></audio>
            <button onclick="window.scratchClearPendingAudio()" class="text-zinc-400 hover:text-red-400 text-xs px-2">✕</button>
        </div>`;
    }

    if (_pendingDocFile) {
        html += `<div class="flex items-center gap-2 mt-1 bg-zinc-800 rounded-xl px-3 py-2">
            <span class="text-base">${_docIcon(_pendingDocFile.name)}</span>
            <span class="text-sm text-zinc-300 truncate flex-1">${_pendingDocFile.name}</span>
            <span class="text-xs text-zinc-500">${_fmtSize(_pendingDocFile.size)}</span>
            <button onclick="window.scratchClearPendingDoc()" class="text-zinc-400 hover:text-red-400 text-xs px-2">✕</button>
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

// ── Image ─────────────────────────────────────────────────────────────────────
function scratchAttachImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
        alert('Image is larger than 8 MB. Please choose a smaller file.');
        input.value = '';
        return;
    }
    _pendingImageFile = file;
    _renderPendingPreview();
    input.value = '';
}
function scratchClearPendingImage() { _pendingImageFile = null; _renderPendingPreview(); }

// ── Document ──────────────────────────────────────────────────────────────────
function scratchAttachDoc(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
        alert('File is larger than 8 MB. Please choose a smaller file.');
        input.value = '';
        return;
    }
    _pendingDocFile = file;
    _renderPendingPreview();
    input.value = '';
}
function scratchClearPendingDoc() { _pendingDocFile = null; _renderPendingPreview(); }

// ── Voice recording ───────────────────────────────────────────────────────────
function scratchClearPendingAudio() { _pendingAudioBlob = null; _renderPendingPreview(); }

async function scratchToggleRecording() {
    _isRecording ? _stopRecording() : await _startRecording();
}

async function _startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        _recordingChunks = [];
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        _pendingAudioExt = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const opts = mimeType ? { mimeType } : {};
        _mediaRecorder = new MediaRecorder(stream, opts);
        _mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) _recordingChunks.push(e.data); };
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
    if (_mediaRecorder && _isRecording) { _mediaRecorder.stop(); _isRecording = false; _updateRecordBtn(); }
}

function _updateRecordBtn() {
    const btn       = document.getElementById('scratch-record-btn');
    const indicator = document.getElementById('scratch-recording-indicator');
    if (btn) { btn.textContent = _isRecording ? '⏹' : '🎙'; btn.classList.toggle('scratch-action-btn--recording', _isRecording); }
    if (indicator) indicator.classList.toggle('hidden', !_isRecording);
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function scratchSave() {
    const textInput = document.getElementById('scratch-text-input');
    const saveBtn   = document.getElementById('scratch-save-btn');
    const text = textInput ? textInput.value.trim() : '';

    if (!text && !_pendingImageFile && !_pendingAudioBlob && !_pendingDocFile) return;

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
        const res = await api('add_scratch', { text });
        if (!res || !res.success) { alert('Failed to save note: ' + (res && res.error ? res.error : 'unknown')); return; }
        const noteId = res.id;

        if (_pendingImageFile) {
            const form = new FormData();
            form.append('action', 'upload_scratch_media');
            form.append('note_id', noteId);
            form.append('kind', 'image');
            form.append('file', _pendingImageFile, _pendingImageFile.name);
            const j = await (await fetch('php/api.php', { method: 'POST', body: form })).json();
            if (!j.success) alert('Image upload failed: ' + (j.error || 'unknown'));
        }

        if (_pendingAudioBlob) {
            const form = new FormData();
            form.append('action', 'upload_scratch_media');
            form.append('note_id', noteId);
            form.append('kind', 'audio');
            form.append('file', _pendingAudioBlob, 'voice.' + _pendingAudioExt);
            const j = await (await fetch('php/api.php', { method: 'POST', body: form })).json();
            if (!j.success) alert('Audio upload failed: ' + (j.error || 'unknown'));
        }

        if (_pendingDocFile) {
            const form = new FormData();
            form.append('action', 'upload_scratch_media');
            form.append('note_id', noteId);
            form.append('kind', 'doc');
            form.append('file', _pendingDocFile, _pendingDocFile.name);
            const j = await (await fetch('php/api.php', { method: 'POST', body: form })).json();
            if (!j.success) alert('Document upload failed: ' + (j.error || 'unknown'));
        }

        if (textInput) textInput.value = '';
        _pendingImageFile = null;
        _pendingAudioBlob = null;
        _pendingDocFile   = null;
        _renderPendingPreview();
        await renderScratchList();
    } catch (err) {
        console.error('[scratch] save error:', err);
        alert('Error saving note: ' + err.message);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function scratchDelete(id) {
    if (!confirm('Delete this note?')) return;
    await api('delete_scratch', { id });
    await renderScratchList();
}

// ── Fetch media from server as Blob URL ───────────────────────────────────────
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

// ── Render saved notes ────────────────────────────────────────────────────────
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
        const docs    = (note.media || []).filter(m => m.kind === 'doc');

        const imageSlots = images.map(m =>
            `<div class="mt-1.5">
                <img data-mediafile="${_esc(m.file)}" src="" alt="loading…"
                     class="scratch-note-image opacity-40"
                     onclick="window.scratchOpenImage('${_esc(m.file)}')">
            </div>`
        ).join('');

        const audioSlots = audios.map(m =>
            `<div class="mt-1.5 flex items-center gap-2">
                <span class="text-xs text-sky-400">🎙</span>
                <audio data-mediafile="${_esc(m.file)}" controls style="height:32px; max-width:200px; flex:1;"></audio>
            </div>`
        ).join('');

        const docSlots = docs.map(m =>
            `<div class="mt-1.5 scratch-doc-row" data-mediafile="${_esc(m.file)}">
                <span class="scratch-doc-icon">${_docIcon(m.file)}</span>
                <span class="scratch-doc-name">${_esc(_basename(m.file))}</span>
                <button class="scratch-doc-dl" onclick="window.scratchDownloadDoc('${_esc(m.file)}')">↓ download</button>
            </div>`
        ).join('');

        return `
        <div class="scratch-note-card" data-note-id="${_esc(note.id)}">
            <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                    ${note.text ? `<div class="scratch-note-text">${_esc(note.text).replace(/\n/g,'<br>')}</div>` : ''}
                    ${imageSlots}${audioSlots}${docSlots}
                    <div class="scratch-note-meta">${dateStr} · ${timeStr}</div>
                </div>
                <button onclick="window.scratchDelete('${_esc(note.id)}')"
                    class="shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition text-sm"
                    title="Delete note">🗑</button>
            </div>
        </div>`;
    }).join('');

    _hydrateMedia(container);
}

async function _hydrateMedia(container) {
    for (const img of container.querySelectorAll('img[data-mediafile]')) {
        try {
            const url = await _getMediaUrl(img.dataset.mediafile);
            if (url) { img.src = url; img.classList.remove('opacity-40'); img.alt = ''; }
            else img.alt = '⚠ not found';
        } catch { img.alt = '⚠ error'; }
    }
    for (const audio of container.querySelectorAll('audio[data-mediafile]')) {
        try { const url = await _getMediaUrl(audio.dataset.mediafile); if (url) audio.src = url; } catch {}
    }
}

// ── Document download ─────────────────────────────────────────────────────────
async function scratchDownloadDoc(filename) {
    const url = await _getMediaUrl(filename);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = _basename(filename);
    a.click();
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _basename(filepath) {
    // strip the noteId_kind_timestamp_ prefix added by server, keep original name portion
    // filename format: {noteId}_{kind}_{ts}.{ext}  — just use the full name if can't parse
    return String(filepath).split('/').pop();
}

function _docIcon(filename) {
    const ext = String(filename).split('.').pop().toLowerCase();
    const map = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📑', pptx: '📑',
                  txt: '📃', csv: '📊', zip: '🗜', rar: '🗜', '7z': '🗜', mp4: '🎬', mov: '🎬' };
    return map[ext] || '📎';
}

function _fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
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

Object.assign(window, {
    toggleScratchCollapse,
    scratchAttachImage,
    scratchAttachDoc,
    scratchToggleRecording,
    scratchSave,
    scratchDelete,
    scratchClearPendingImage,
    scratchClearPendingAudio,
    scratchClearPendingDoc,
    scratchOpenImage,
    scratchDownloadDoc,
    initScratchPad,
    renderScratchList
});

export { initScratchPad, renderScratchList };
// << - js/planner-scratch.js
