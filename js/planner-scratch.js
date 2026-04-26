// >> - js/planner-scratch.js
// js/planner-scratch.js
// NEW: Quick scratch pad for the Planner tab
// Supports: plain text notes, image attachments (base64), voice recordings (base64)
// Persisted in localStorage under 'planner_scratch_notes'

const SCRATCH_KEY  = 'planner_scratch_notes';
const SCRATCH_COLL = 'planner_scratch_collapsed';

// ── Persistence ───────────────────────────────────────────────────────────────
function getScratchNotes() {
    try { return JSON.parse(localStorage.getItem(SCRATCH_KEY) || '[]'); }
    catch { return []; }
}

function saveScratchNotes(notes) {
    localStorage.setItem(SCRATCH_KEY, JSON.stringify(notes));
}

// ── Collapse toggle ───────────────────────────────────────────────────────────
function toggleScratchCollapse() {
    const body = document.getElementById('scratch-pad-body');
    const btn  = document.getElementById('scratch-collapse-btn');
    if (!body || !btn) return;
    const hidden = body.classList.toggle('hidden');
    btn.textContent = hidden ? '▶ show' : '▼ hide';
    localStorage.setItem(SCRATCH_COLL, hidden ? '1' : '0');
}

// ── Pending image state ───────────────────────────────────────────────────────
let _pendingImageB64 = null;   // base64 string of staged image
let _pendingAudioB64 = null;   // base64 string of staged voice note
let _mediaRecorder   = null;
let _recordingChunks = [];
let _isRecording     = false;

// ── Attach image ──────────────────────────────────────────────────────────────
function scratchAttachImage(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        _pendingImageB64 = e.target.result; // data:image/...;base64,...
        _renderPendingPreview();
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    input.value = '';
}

function _renderPendingPreview() {
    const box = document.getElementById('scratch-pending-preview');
    if (!box) return;
    let html = '';
    if (_pendingImageB64) {
        html += `<div class="relative inline-block">
            <img src="${_pendingImageB64}" alt="preview"
                 class="max-h-40 rounded-xl border border-zinc-700 object-cover">
            <button onclick="window.scratchClearPendingImage()"
                class="absolute top-1 right-1 bg-zinc-900/80 text-zinc-300 hover:text-red-400 rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none">×</button>
        </div>`;
    }
    if (_pendingAudioB64) {
        html += `<div class="flex items-center gap-2 mt-1">
            <audio controls src="${_pendingAudioB64}" class="h-8 flex-1" style="height:36px;"></audio>
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

function scratchClearPendingImage() {
    _pendingImageB64 = null;
    _renderPendingPreview();
}

function scratchClearPendingAudio() {
    _pendingAudioB64 = null;
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
        _mediaRecorder = new MediaRecorder(stream);
        _mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) _recordingChunks.push(e.data);
        };
        _mediaRecorder.onstop = () => {
            const blob = new Blob(_recordingChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = (e) => {
                _pendingAudioB64 = e.target.result;
                _renderPendingPreview();
            };
            reader.readAsDataURL(blob);
            // Stop all tracks to release mic
            stream.getTracks().forEach(t => t.stop());
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
    const btn = document.getElementById('scratch-record-btn');
    const indicator = document.getElementById('scratch-recording-indicator');
    if (btn) {
        btn.textContent = _isRecording ? '⏹' : '🎙';
        btn.classList.toggle('scratch-action-btn--recording', _isRecording);
    }
    if (indicator) {
        indicator.classList.toggle('hidden', !_isRecording);
    }
}

// ── Save note ─────────────────────────────────────────────────────────────────
function scratchSave() {
    const textInput = document.getElementById('scratch-text-input');
    const text = textInput ? textInput.value.trim() : '';

    if (!text && !_pendingImageB64 && !_pendingAudioB64) return;

    const note = {
        id:    Date.now() + Math.random().toString(36).slice(2, 7),
        ts:    Date.now(),
        text:  text,
        image: _pendingImageB64 || null,
        audio: _pendingAudioB64 || null
    };

    const notes = getScratchNotes();
    notes.unshift(note); // newest first
    saveScratchNotes(notes);

    // Clear inputs
    if (textInput) textInput.value = '';
    _pendingImageB64 = null;
    _pendingAudioB64 = null;
    _renderPendingPreview();

    renderScratchList();
}

// ── Delete note ───────────────────────────────────────────────────────────────
function scratchDelete(id) {
    const notes = getScratchNotes().filter(n => n.id !== id);
    saveScratchNotes(notes);
    renderScratchList();
}

// ── Render list ───────────────────────────────────────────────────────────────
function renderScratchList() {
    const container = document.getElementById('scratch-notes-list');
    const countEl   = document.getElementById('scratch-count');
    if (!container) return;

    const notes = getScratchNotes();
    if (countEl) countEl.textContent = notes.length ? `(${notes.length})` : '';

    if (!notes.length) {
        container.innerHTML = '<div class="text-xs text-zinc-600 text-center py-3">No notes yet</div>';
        return;
    }

    container.innerHTML = notes.map(note => {
        const date = new Date(note.ts);
        const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        return `
        <div class="scratch-note-card">
            <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                    ${note.text ? `<div class="scratch-note-text">${_escapeHtml(note.text)}</div>` : ''}
                    ${note.image ? `
                    <div class="mt-1.5">
                        <img src="${note.image}" alt="note image"
                             class="scratch-note-image"
                             onclick="window.scratchOpenImage('${note.id}')">
                    </div>` : ''}
                    ${note.audio ? `
                    <div class="mt-1.5 flex items-center gap-2">
                        <span class="text-xs text-sky-400">🎙</span>
                        <audio controls src="${note.audio}" class="flex-1" style="height:32px; max-width:200px;"></audio>
                    </div>` : ''}
                    <div class="scratch-note-meta">${dateStr} · ${timeStr}</div>
                </div>
                <button onclick="window.scratchDelete('${note.id}')"
                    class="shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition text-sm"
                    title="Delete note">🗑</button>
            </div>
        </div>`;
    }).join('');
}

// ── Image lightbox ────────────────────────────────────────────────────────────
function scratchOpenImage(noteId) {
    const notes = getScratchNotes();
    const note = notes.find(n => n.id === noteId);
    if (!note || !note.image) return;

    // Simple overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
        <div style="position:relative;max-width:100%;max-height:100%;">
            <img src="${note.image}" style="max-width:100%;max-height:85vh;border-radius:12px;object-fit:contain;">
            <button onclick="this.closest('[style]').remove()"
                style="position:absolute;top:-12px;right:-12px;background:#3f3f46;color:#e4e4e7;border-radius:9999px;width:32px;height:32px;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;">×</button>
        </div>`;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
}

// ── Escape HTML for text display ──────────────────────────────────────────────
function _escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initScratchPad() {
    // Restore collapse state
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
