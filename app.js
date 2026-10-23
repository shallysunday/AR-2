/* ==========================================================
   AR Art & Design Archive — app logic
   ----------------------------------------------------------
   Two storage modes, chosen by config.js:

   CLOUD (Supabase URL + key set)
     - metadata  → Supabase table "artworks"
     - .glb + thumbnail → Supabase Storage bucket "artworks"
     Everyone sees the same archive; new uploads appear on all devices.

   LOCAL (config left empty)
     - metadata  → localStorage
     - .glb      → IndexedDB
     Only the current browser sees the uploads.
   ========================================================== */
(() => {
  'use strict';

  const CFG = Object.assign(
    { SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SHOW_SAMPLES: true },
    window.ARCHIVE_CONFIG || {}
  );
  const CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const SB_URL = (CFG.SUPABASE_URL || '').replace(/\/+$/, '');
  const BUCKET = 'artworks';
  const BUILD = 'build 4';
  let lastLoadError = '';

  const STORE_KEY = 'arArchive.items.v1';
  const DB_NAME = 'arArchiveFiles';
  const DB_STORE = 'models';
  const MAX_FILE_MB = CLOUD ? 50 : 60;

  /* ---------- Sample artworks ---------- */
  const MS = 'https://modelviewer.dev/shared-assets/models/';
  const SAMPLE_ITEMS = [
    {
      id: 'sample-astronaut',
      title: 'Astronaut Study',
      description: 'A figure study exploring volume and silhouette in zero gravity. Scanned from a clay maquette and cleaned up in post.',
      student: 'Alya Putri',
      lecturer: 'Dr. Budi Santoso',
      className: 'Typography II',
      classCode: 'DK202',
      period: 'Odd 2026/2027',
      modelUrl: MS + 'Astronaut.glb',
      thumbnail: MS + 'Astronaut.png',
      sample: true
    },
    {
      id: 'sample-robot',
      title: 'Expressive Robot',
      description: 'Character design project: a friendly service robot with exaggerated gestures and a limited colour palette.',
      student: 'Rizky Pratama',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Character Design I',
      classCode: 'DK115',
      period: 'Odd 2026/2027',
      modelUrl: MS + 'RobotExpressive.glb',
      thumbnail: MS + 'RobotExpressive.png',
      sample: true
    },
    {
      id: 'sample-horse',
      title: 'Horse in Motion',
      description: 'Sculptural study of movement, inspired by early motion photography and kinetic art.',
      student: 'Nadia Rahma',
      lecturer: 'Dr. Budi Santoso',
      className: 'Form & Space',
      classCode: 'DK108',
      period: 'Even 2025/2026',
      modelUrl: MS + 'Horse.glb',
      thumbnail: MS + 'Horse.png',
      sample: true
    },
    {
      id: 'sample-neil',
      title: 'Lunar Portrait',
      description: 'A commemorative portrait piece looking at how monuments translate into digital archives.',
      student: 'Dimas Wicaksono',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Digital Archive Studio',
      classCode: 'DK310',
      period: 'Odd 2025/2026',
      modelUrl: MS + 'NeilArmstrong.glb',
      thumbnail: MS + 'NeilArmstrong.png',
      sample: true
    }
  ].map((item, i) => ({ ...item, createdAt: Date.now() - (i + 1) * 86400000 }));

  /* ---------- Local storage helpers (LOCAL mode) ---------- */
  function loadLocalItems() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Could not read archive from localStorage', e);
    }
    const seed = CFG.SHOW_SAMPLES ? SAMPLE_ITEMS : [];
    try { saveLocalItems(seed); } catch (e) { /* ignore */ }
    return seed.slice();
  }

  function saveLocalItems(items) {
    localStorage.setItem(STORE_KEY, JSON.stringify(items)); // may throw on quota
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idb(mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode);
      const req = fn(tx.objectStore(DB_STORE));
      tx.oncomplete = () => { db.close(); resolve(req && req.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  const putModel = (id, blob) => idb('readwrite', s => s.put(blob, id));
  const getModel = id => idb('readonly', s => s.get(id));
  const deleteModel = id => idb('readwrite', s => s.delete(id));

  /* ---------- Supabase helpers (CLOUD mode) ---------- */
  function sbHeaders(extra = {}) {
    const h = { apikey: CFG.SUPABASE_ANON_KEY, ...extra };
    // Legacy anon keys are JWTs and may also be sent as a bearer token.
    // The newer "publishable" keys must only go in the apikey header.
    if (CFG.SUPABASE_ANON_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + CFG.SUPABASE_ANON_KEY;
    return h;
  }

  const publicUrl = path => `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  async function fetchRemoteItems() {
    const res = await fetch(`${SB_URL}/rest/v1/artworks?select=*&order=created_at.desc`, { headers: sbHeaders() });
    if (!res.ok) throw new Error(`Could not load the shared archive (${res.status})`);
    const rows = await res.json();
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      student: r.student,
      lecturer: r.lecturer,
      className: r.class_name,
      classCode: r.class_code,
      period: r.period,
      modelUrl: r.model_url,
      thumbnail: r.thumbnail_url,
      createdAt: Date.parse(r.created_at) || 0,
      remote: true
    }));
  }

  // XHR (not fetch) so we can show upload progress on slow mobile connections
  function xhrUpload(path, blob, contentType, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SB_URL}/storage/v1/object/${BUCKET}/${path}`);
      const headers = sbHeaders({ 'Content-Type': contentType, 'x-upsert': 'false', 'cache-control': 'max-age=31536000' });
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}). ${xhr.responseText || ''}`.slice(0, 200)));
      xhr.onerror = () => reject(new Error('Network error while uploading. Check your connection and try again.'));
      xhr.send(blob);
    });
  }

  /* ---------- Load everything the gallery should show ---------- */
  async function loadAll() {
    if (!CLOUD) return loadLocalItems();
    let list = [];
    try {
      list = await fetchRemoteItems();
    } catch (e) {
      console.error(e);
      lastLoadError = e.message || 'unknown error';
      toast('Could not reach the shared archive. Showing samples only.');
    }
    if (CFG.SHOW_SAMPLES) list = list.concat(SAMPLE_ITEMS);
    return list;
  }

  /* ---------- Small utilities ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    children.forEach(c => c && node.append(c));
    return node;
  }

  function toast(message) {
    let t = $('#toast');
    if (!t) {
      t = el('div', { id: 'toast', class: 'toast', role: 'status' });
      document.body.append(t);
    }
    t.textContent = message;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 3600);
  }

  const norm = s => (s || '').toString().toLowerCase().trim();
  const uniqueSorted = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const initials = s => (s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const newId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

  /* ==========================================================
     GALLERY PAGE
     ========================================================== */
  async function initGallery() {
    let items = [];
    const state = { q: '', code: '', period: '' };

    const grid = $('#gallery');
    const empty = $('#emptyState');
    const count = $('#resultCount');
    const searchInput = $('#searchInput');
    const classFilter = $('#classFilter');
    const periodFilter = $('#periodFilter');

    const sorted = () => items.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    function fillSelect(select, values, allLabel) {
      const current = select.value;
      select.replaceChildren(el('option', { value: '', text: allLabel }));
      values.forEach(v => select.append(el('option', { value: v, text: v })));
      select.value = values.includes(current) ? current : '';
    }

    function refreshFilterOptions() {
      fillSelect(classFilter, uniqueSorted(items.map(i => i.classCode)), 'All class codes');
      fillSelect(periodFilter, uniqueSorted(items.map(i => i.period)), 'All periods');
      state.code = classFilter.value;
      state.period = periodFilter.value;
    }

    function matches(item) {
      if (state.code && item.classCode !== state.code) return false;
      if (state.period && item.period !== state.period) return false;
      if (state.q) {
        const hay = [item.student, item.lecturer, item.title, item.className].map(norm).join(' | ');
        if (!hay.includes(norm(state.q))) return false;
      }
      return true;
    }

    function buildCard(item, index) {
      const thumb = el('div', { class: 'card-thumb' });
      thumb.append(el('div', { class: 'placeholder', 'aria-hidden': 'true', text: initials(item.title) }));
      if (item.thumbnail) {
        const img = el('img', { src: item.thumbnail, alt: `Preview of ${item.title}`, loading: 'lazy' });
        img.addEventListener('error', () => img.remove());
        thumb.append(img);
      }
      thumb.append(el('span', { class: 'badge-ar', text: '3D · AR' }));

      const body = el('div', { class: 'card-body' },
        el('span', { class: 'card-code', text: item.classCode }),
        el('h3', { class: 'card-title', text: item.title }),
        (() => { const p = el('p', { class: 'card-meta' }); p.append(el('strong', { text: item.student })); return p; })(),
        el('p', { class: 'card-meta', text: item.lecturer })
      );

      const card = el('article', {
        class: 'card', tabindex: '0', role: 'button',
        'aria-label': `Open ${item.title} by ${item.student}`,
        'data-id': item.id
      }, thumb, body);
      card.style.animationDelay = `${Math.min(index, 12) * 40}ms`;

      const open = () => openDetail(item.id);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      });
      return card;
    }

    function render() {
      const list = sorted().filter(matches);
      grid.replaceChildren(...list.map(buildCard));
      empty.hidden = list.length > 0;
      const total = items.length;
      const source = !CLOUD
        ? ' · THIS DEVICE ONLY (config.js has no Supabase keys)'
        : lastLoadError
          ? ` · SHARED ARCHIVE ERROR: ${lastLoadError}`
          : ' · shared archive connected';
      count.textContent = (list.length === total
        ? `${total} artwork${total === 1 ? '' : 's'}`
        : `${list.length} of ${total} artworks`) + source;
    }

    /* ----- Events ----- */
    searchInput.addEventListener('input', () => { state.q = searchInput.value; render(); });
    classFilter.addEventListener('change', () => { state.code = classFilter.value; render(); });
    periodFilter.addEventListener('change', () => { state.period = periodFilter.value; render(); });
    $('#resetFilters').addEventListener('click', () => {
      searchInput.value = ''; classFilter.value = ''; periodFilter.value = '';
      state.q = state.code = state.period = '';
      render();
    });

    /* ----- Detail view ----- */
    const modal = $('#detailModal');
    const host = $('#viewerHost');
    const deleteBtn = $('#deleteBtn');
    let activeBlobUrl = null;
    let lastFocus = null;
    let currentId = null;

    async function openDetail(id) {
      const item = items.find(i => i.id === id);
      if (!item) return;

      let src = item.modelUrl;

      if (!src) {
        try {
          const blob = await getModel(item.id);
          if (!blob) throw new Error('Model file missing');
          activeBlobUrl = URL.createObjectURL(blob);
          src = activeBlobUrl;
        } catch (e) {
          console.error(e);
          toast('Could not load this model file from the browser.');
          return;
        }
      }

      // Scene Viewer (Android) needs a public https URL, so blob: URLs skip it.
      const arModes = src.startsWith('blob:') ? 'webxr quick-look' : 'scene-viewer webxr quick-look';

      currentId = id;
      lastFocus = document.activeElement;

      $('#detailClass').textContent = item.className;
      $('#detailTitle').textContent = item.title;
      $('#detailDesc').textContent = item.description || 'No description provided.';
      $('#detailStudent').textContent = item.student;
      $('#detailLecturer').textContent = item.lecturer;
      $('#detailCode').textContent = item.classCode;
      $('#detailPeriod').textContent = item.period;
      // Only locally stored uploads can be deleted from the page
      deleteBtn.hidden = !!(item.sample || item.remote);

      host.replaceChildren();
      const loading = el('div', { class: 'viewer-loading', text: 'Loading 3D model…' });
      const mv = document.createElement('model-viewer');
      mv.setAttribute('src', src);
      mv.setAttribute('alt', `3D model: ${item.title} by ${item.student}`);
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('touch-action', 'pan-y');
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('shadow-intensity', '1');
      mv.setAttribute('environment-image', 'neutral');
      mv.setAttribute('exposure', '1');
      mv.setAttribute('ar', '');
      mv.setAttribute('ar-modes', arModes);
      mv.setAttribute('ar-scale', 'auto');
      if (item.thumbnail) mv.setAttribute('poster', item.thumbnail);

      const arBtn = el('button', { slot: 'ar-button', class: 'btn-ar', type: 'button', text: 'View in AR' });
      mv.append(arBtn);

      mv.addEventListener('load', () => loading.classList.add('done'));
      mv.addEventListener('error', () => { loading.textContent = 'Sorry, this model could not be loaded.'; });

      host.append(mv, loading);

      modal.hidden = false;
      document.body.classList.add('modal-open');
      $('.modal-close', modal).focus();
    }

    function closeDetail() {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      host.replaceChildren();
      if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); activeBlobUrl = null; }
      currentId = null;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDetail(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeDetail(); });

    deleteBtn.addEventListener('click', async () => {
      const item = items.find(i => i.id === currentId);
      if (!item || item.sample || item.remote) return;
      if (!confirm(`Delete “${item.title}” from the archive? This can't be undone.`)) return;
      items = items.filter(i => i.id !== item.id);
      try { saveLocalItems(items.filter(i => !i.sample || CFG.SHOW_SAMPLES)); await deleteModel(item.id); } catch (e) { console.warn(e); }
      closeDetail();
      refreshFilterOptions();
      render();
      toast('Artwork deleted');
    });

    /* ----- Init ----- */
    count.textContent = 'Loading archive…';
    items = await loadAll();
    refreshFilterOptions();
    render();

    const params = new URLSearchParams(location.search);
    const added = params.get('added');
    if (added) {
      toast(added === 'shared' ? 'Saved to the SHARED archive ✓'
        : added === 'local' ? 'Saved on THIS DEVICE only (shared mode is off)'
        : 'Added to the archive (old upload page: not saved to Supabase)');
      history.replaceState(null, '', location.pathname);
    }
  }

  /* ==========================================================
     UPLOAD PAGE
     ========================================================== */
  function initUpload() {
    const form = $('#uploadForm');
    const fileInput = $('#modelFile');
    const previewBox = $('#previewBox');
    const viewer = $('#previewViewer');
    const errorBox = $('#formError');
    const submitBtn = $('#submitBtn');
    const modeNote = $('#modeNote');

    let previewUrl = null;
    let modelReady = false;

    if (modeNote) {
      modeNote.textContent = `${BUILD} · ` + (CLOUD
        ? 'Shared archive: your upload will be visible on every device.'
        : 'This-device mode: uploads are only visible in this browser until the shared archive is set up.');
    }

    // Suggest periods already used in the archive
    const dl = $('#periodSuggestions');
    loadAll().then(list => {
      uniqueSorted(list.map(i => i.period)).forEach(p => dl.append(el('option', { value: p })));
    }).catch(() => {});

    function showError(msg) {
      errorBox.textContent = msg;
      errorBox.hidden = !msg;
      if (msg) errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    fileInput.addEventListener('change', () => {
      showError('');
      modelReady = false;
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      const file = fileInput.files[0];
      if (!file) { previewBox.hidden = true; return; }

      if (!/\.glb$/i.test(file.name)) {
        fileInput.value = ''; previewBox.hidden = true;
        showError('Please choose a .glb file (export as GLB from Scaniverse).');
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        fileInput.value = ''; previewBox.hidden = true;
        showError(`That file is larger than ${MAX_FILE_MB} MB. Try exporting at a lower quality.`);
        return;
      }
      previewUrl = URL.createObjectURL(file);
      viewer.setAttribute('src', previewUrl);
      previewBox.hidden = false;
    });

    viewer.addEventListener('load', () => { modelReady = true; });
    viewer.addEventListener('error', () => {
      modelReady = false;
      showError('This file could not be read as a valid .glb model.');
    });

    const waitForModel = (timeout = 8000) => new Promise(resolve => {
      const start = Date.now();
      (function check() {
        if (modelReady || Date.now() - start > timeout) return resolve(modelReady);
        setTimeout(check, 100);
      })();
    });

    // Capture the preview canvas and shrink it to a small JPEG for the card
    async function captureThumbnail() {
      try {
        if (!(await waitForModel())) return '';
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const dataUrl = await viewer.toDataURL('image/jpeg', 0.85);
        const img = await new Promise((res, rej) => {
          const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
        });
        const max = 560;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ece8de';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.75);
      } catch (e) {
        console.warn('Thumbnail capture failed', e);
        return '';
      }
    }

    async function saveToCloud(file, fields, thumbnail) {
      const id = newId();
      const modelPath = `models/${id}.glb`;
      const thumbPath = `thumbs/${id}.jpg`;

      await xhrUpload(modelPath, file, 'model/gltf-binary', p => {
        submitBtn.textContent = `Uploading ${Math.round(p * 100)}%`;
      });

      let thumbnailUrl = '';
      if (thumbnail) {
        try {
          submitBtn.textContent = 'Saving thumbnail…';
          const thumbBlob = await (await fetch(thumbnail)).blob();
          await xhrUpload(thumbPath, thumbBlob, 'image/jpeg');
          thumbnailUrl = publicUrl(thumbPath);
        } catch (e) {
          console.warn('Thumbnail upload failed, continuing without it', e);
        }
      }

      submitBtn.textContent = 'Publishing…';
      const res = await fetch(`${SB_URL}/rest/v1/artworks`, {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({
          id,
          title: fields.title,
          description: fields.description,
          student: fields.student,
          lecturer: fields.lecturer,
          class_name: fields.className,
          class_code: fields.classCode,
          period: fields.period,
          model_url: publicUrl(modelPath),
          thumbnail_url: thumbnailUrl
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Could not save the artwork details (${res.status}). ${txt}`.slice(0, 220));
      }

      // Confirm the row really exists in Supabase before reporting success
      const check = await fetch(`${SB_URL}/rest/v1/artworks?id=eq.${id}&select=id`, { headers: sbHeaders() });
      const rows = check.ok ? await check.json() : [];
      if (!rows.length) {
        throw new Error('The artwork was sent but could not be read back from Supabase. Check the "public read artworks" policy.');
      }
    }

    async function saveLocally(file, fields, thumbnail) {
      const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await putModel(id, file);
      const items = loadLocalItems();
      items.push({ id, ...fields, thumbnail, fileName: file.name, createdAt: Date.now() });
      try {
        saveLocalItems(items);
      } catch (quotaErr) {
        await deleteModel(id).catch(() => {});
        throw new Error('Browser storage is full. Delete some uploaded artworks and try again.');
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      showError('');

      let firstBad = null;
      form.querySelectorAll('[required]').forEach(field => {
        const bad = field.type === 'file' ? !field.files.length : !field.value.trim();
        field.classList.toggle('input-invalid', bad);
        if (bad && !firstBad) firstBad = field;
      });
      if (firstBad) {
        firstBad.focus();
        showError('Please fill in all required fields and choose a .glb file.');
        return;
      }

      const file = fileInput.files[0];
      const fd = new FormData(form);
      const fields = {
        title: fd.get('title').trim(),
        description: fd.get('description').trim(),
        student: fd.get('student').trim(),
        lecturer: fd.get('lecturer').trim(),
        className: fd.get('className').trim(),
        classCode: fd.get('classCode').trim().toUpperCase(),
        period: fd.get('period').trim()
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Preparing…';

      try {
        const thumbnail = await captureThumbnail();
        if (CLOUD) await saveToCloud(file, fields, thumbnail);
        else await saveLocally(file, fields, thumbnail);
        location.href = `index.html?added=${CLOUD ? 'shared' : 'local'}`;
      } catch (err) {
        console.error(err);
        showError(err.message || 'Something went wrong while saving. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save to archive';
      }
    });

    form.addEventListener('input', e => e.target.classList.remove('input-invalid'));
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const tag = $('.site-footer p');
    if (tag) tag.append(` (${BUILD}, ${CLOUD ? 'shared' : 'local'} mode)`);
    const page = document.body.dataset.page;
    if (page === 'gallery') initGallery();
    if (page === 'upload') initUpload();
  });
})();