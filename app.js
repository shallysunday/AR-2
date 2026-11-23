/* ==========================================================
   AR Art & Design Archive — app logic & database schema
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
  const BUILD = 'build 8';
  let lastLoadError = '';

  let itemsCache = null;
  let itemsCacheTime = 0;
  const ITEMS_CACHE_TTL = 30_000;

  const STORE_KEY = 'arArchive.items.v1';
  const DB_NAME = 'arArchiveFiles';
  const DB_STORE = 'models';

  /* ---------- Sample artworks database ---------- */
  const SAMPLE_ITEMS = [
    // --- Illustration (2D Framed Wall Artworks) ---
    {
      id: 'sample-il-1',
      title: 'Hemat Energi',
      description: 'Selamatkan bumi!',
      student: 'M. Daffa Ardhana',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#e07a5f',
      thumbnail: 'images/IL1.webp',
      sample: true
    },
    {
      id: 'sample-il-2',
      title: 'Penyu',
      description: 'Upaya pelestarian penyu di Indonesia.',
      student: 'Farah Dina Aulia',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#81b29a',
      thumbnail: 'images/IL2.webp',
      sample: true
    },
    {
      id: 'sample-il-3',
      title: 'Wardah',
      description: 'Beauty in Every Shade.',
      student: 'Nopal',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#3d405b',
      thumbnail: 'images/IL3.webp',
      sample: true
    },
    {
      id: 'sample-il-4',
      title: 'Harlette',
      description: 'All skin type, for everyone.',
      student: 'Natasya',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#f2cc8f',
      thumbnail: 'images/IL4.webp',
      sample: true
    },
    {
      id: 'sample-il-5',
      title: 'Wounded Shadow',
      description: 'Graphic story pacing and panel composition exploring urban myth.',
      student: 'Diva Nurul Hasanah',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#f2cc8f',
      thumbnail: 'images/IL5.webp',
      sample: true
    },

    // --- Photography (2D Framed Wall Artworks) ---
    {
      id: 'sample-ph-1',
      title: 'In Motion',
      description: 'Cool car in motion.',
      student: 'Fajar Nugroho',
      lecturer: 'Siti Rahma, M.Sn.',
      className: 'Photography',
      classCode: 'PH101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#c32222',
      thumbnail: 'images/PH1.webp',
      sample: true
    },
    {
      id: 'sample-ph-2',
      title: 'Urban Twilight Light',
      description: 'Long-exposure urban photography capturing artificial light tracks.',
      student: 'Nabila Zahra',
      lecturer: 'Siti Rahma, M.Sn.',
      className: 'Photography',
      classCode: 'PH101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#8d99ae',
      thumbnail: 'images/PH2.webp',
      sample: true
    },
    {
      id: 'sample-ph-3',
      title: 'Street Documentary Series',
      description: 'Candid portraiture capture of daily life in historic city alleyways.',
      student: 'Kevin Hartono',
      lecturer: 'Siti Rahma, M.Sn.',
      className: 'Photography',
      classCode: 'PH101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#4a4e69',
      thumbnail: 'images/PH3.webp',
      sample: true
    },
    {
      id: 'sample-ph-4',
      title: 'Minimalist Portraiture',
      description: 'Studio lighting exploration emphasizing facial contour and tone.',
      student: 'Laras Ayu',
      lecturer: 'Siti Rahma, M.Sn.',
      className: 'Photography',
      classCode: 'PH101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#6c5ce7',
      thumbnail: 'images/PH4.webp',
      sample: true
    },
    {
      id: 'sample-ph-5',
      title: 'Broken Reflection',
      description: 'Reflection of broken tower.',
      student: 'Laras Ayu',
      lecturer: 'Siti Rahma, M.Sn.',
      className: 'Photography',
      classCode: 'PH101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#6c5ce7',
      thumbnail: 'images/PH5.webp',
      sample: true
    },

    // --- Advertising Photography (2D Framed Wall Artworks) ---
    {
      id: 'sample-ap-1',
      title: 'Commercial Beverage Splash',
      description: 'High-speed action photo staging for commercial beverage ad.',
      student: 'Bayu Aditya',
      lecturer: 'Doni Prasetyo, M.Ds.',
      className: 'Advertising Photography',
      classCode: 'AP201',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#f4a261',
      thumbnail: 'images/AP1.webp',
      sample: true
    },
    {
      id: 'sample-ap-2',
      title: 'Cosmetics Staging & Reflection',
      description: 'Luxury perfume product lighting with mirror reflection and soft gradients.',
      student: 'Citra Dewi',
      lecturer: 'Doni Prasetyo, M.Ds.',
      className: 'Advertising Photography',
      classCode: 'AP201',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#e76f51',
      thumbnail: 'images/AP2.webp',
      sample: true
    },
    {
      id: 'sample-ap-3',
      title: 'Retro Apparel Campaign',
      description: 'Commercial fashion lookbook staging with vintage studio props.',
      student: 'Nadia Rahma',
      lecturer: 'Doni Prasetyo, M.Ds.',
      className: 'Advertising Photography',
      classCode: 'AP201',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#2a9d8f',
      thumbnail: 'images/AP3.webp',
      sample: true
    },
    {
      id: 'sample-ap-4',
      title: 'Macro Product Lighting',
      description: 'Precision studio macro lighting for luxury watch campaign.',
      student: 'Bagas Firmansyah',
      lecturer: 'Doni Prasetyo, M.Ds.',
      className: 'Advertising Photography',
      classCode: 'AP201',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#264653',
      thumbnail: 'images/AP4.webp',
      sample: true
    },

    // --- Applied Typography (3D Pedestal GLB Models) ---
    {
      id: 'sample-at-1',
      title: 'Packaging Label Study',
      description: 'A 3D packaging and typography label study on a water bottle object.',
      student: 'Nabila Zahra',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/WaterBottle/glTF-Binary/WaterBottle.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-2',
      title: 'Sound Object Lettering',
      description: 'Lettering and surface graphics on a retro audio boombox model.',
      student: 'Kevin Hartono',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-3',
      title: 'Spatial Letterform Form',
      description: 'Visual communication and volumetric type on organic fruit form.',
      student: 'Laras Ayu',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Avocado/glTF-Binary/Avocado.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-4',
      title: 'Signal Lantern Wayfinding',
      description: 'Type and light as wayfinding object in three-dimensional space.',
      student: 'Bayu Aditya',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Lantern/glTF-Binary/Lantern.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-5',
      title: '3D Typographic Mascot Mark',
      description: 'A mascot mark explored as a 3D volumetric sculpture.',
      student: 'Citra Dewi',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Duck/glTF-Binary/Duck.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-6',
      title: 'Test 001',
      description: 'Testing file',
      student: 'Anis',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: '3d/Test2.glb',
      thumbnail: '',
      sample: true
    }
  ].map((item, i) => ({ ...item, createdAt: Date.now() - (i + 1) * 86400000 }));

  function loadLocalItems() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const userItems = parsed.filter(item => !item.sample);
          const refreshed = CFG.SHOW_SAMPLES
            ? userItems.concat(SAMPLE_ITEMS)
            : userItems;
          try { saveLocalItems(refreshed); } catch (e) { /* ignore */ }
          return refreshed;
        }
      }
    } catch (e) {
      console.warn('Could not read archive from localStorage', e);
    }
    const seed = CFG.SHOW_SAMPLES ? SAMPLE_ITEMS : [];
    try { saveLocalItems(seed); } catch (e) { /* ignore */ }
    return seed.slice();
  }

  function saveLocalItems(items) {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
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

  const getModel = id => idb('readonly', s => s.get(id));
  const putModel = (id, blob) => idb('readwrite', s => s.put(blob, id));
  const deleteModel = id => idb('readwrite', s => s.delete(id));
  const publicUrl = path => `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  const newId = () => (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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

  function sbHeaders(extra = {}) {
    const h = { apikey: CFG.SUPABASE_ANON_KEY, ...extra };
    if (CFG.SUPABASE_ANON_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + CFG.SUPABASE_ANON_KEY;
    return h;
  }

  async function fetchRemoteItems() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/artworks?select=*&order=created_at.desc`,
        { headers: sbHeaders(), signal: controller.signal }
      );
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
        is2D: r.is_2d || false,
        createdAt: Date.parse(r.created_at) || 0,
        remote: true
      }));
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error('The shared archive took too long to respond.');
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function loadAll(forceFresh = false) {
    if (!forceFresh && itemsCache && Date.now() - itemsCacheTime < ITEMS_CACHE_TTL) {
      return itemsCache;
    }
    let list;
    if (!CLOUD) {
      list = loadLocalItems();
    } else {
      try {
        list = await fetchRemoteItems();
        lastLoadError = '';
      } catch (e) {
        console.error(e);
        lastLoadError = e.message || 'unknown error';
        toast('Could not reach the shared archive. Showing samples only.');
        list = [];
      }
      if (CFG.SHOW_SAMPLES) list = list.concat(SAMPLE_ITEMS);
    }
    itemsCache = list;
    itemsCacheTime = Date.now();
    return list;
  }

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

    /** Automatically inspect items database to build dynamic class code options */
    function refreshFilterOptions() {
      const classMap = new Map();
      items.forEach(i => {
        if (i.classCode && !classMap.has(i.classCode)) {
          classMap.set(i.classCode, i.className || i.classCode);
        }
      });

      const sortedCodes = [...classMap.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const currentCode = classFilter.value;
      classFilter.replaceChildren(el('option', { value: '', text: 'All classes' }));
      sortedCodes.forEach(code => {
        const label = `${code} — ${classMap.get(code)}`;
        classFilter.append(el('option', { value: code, text: label }));
      });
      classFilter.value = sortedCodes.includes(currentCode) ? currentCode : '';

      fillSelect(periodFilter, uniqueSorted(items.map(i => i.period)), 'All periods');
      state.code = classFilter.value;
      state.period = periodFilter.value;
    }

    function matches(item) {
      if (state.code && item.classCode !== state.code) return false;
      if (state.period && item.period !== state.period) return false;
      if (state.q) {
        const hay = [item.student, item.lecturer, item.title, item.className, item.classCode].map(norm).join(' | ');
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
      thumb.append(el('span', { class: 'badge-ar', text: item.is2D ? '2D · FRAME' : '3D · AR' }));

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
        ? ' · THIS DEVICE ONLY'
        : lastLoadError
          ? ` · ERROR: ${lastLoadError}`
          : ' · shared archive connected';
      count.textContent = (list.length === total
        ? `${total} artwork${total === 1 ? '' : 's'}`
        : `${list.length} of ${total} artworks`) + source;
    }

    searchInput.addEventListener('input', () => { state.q = searchInput.value; render(); });
    classFilter.addEventListener('change', () => { state.code = classFilter.value; render(); });
    periodFilter.addEventListener('change', () => { state.period = periodFilter.value; render(); });
    $('#resetFilters').addEventListener('click', () => {
      searchInput.value = ''; classFilter.value = ''; periodFilter.value = '';
      state.q = state.code = state.period = '';
      render();
    });

    const modal = $('#detailModal');
    const host = $('#viewerHost');
    const deleteBtn = $('#deleteBtn');
    let activeBlobUrl = null;

    async function openDetail(id) {
      const item = items.find(i => i.id === id);
      if (!item) return;

      let src = item.modelUrl;

      if (!src && !item.is2D) {
        try {
          const blob = await getModel(item.id);
          if (!blob) throw new Error('Model file missing');
          activeBlobUrl = URL.createObjectURL(blob);
          src = activeBlobUrl;
        } catch (e) {
          console.error(e);
          toast('Could not load this file.');
          return;
        }
      }

      $('#detailClass').textContent = item.className;
      $('#detailTitle').textContent = item.title;
      $('#detailDesc').textContent = item.description || 'No description provided.';
      $('#detailStudent').textContent = item.student;
      $('#detailLecturer').textContent = item.lecturer;
      $('#detailCode').textContent = item.classCode;
      $('#detailPeriod').textContent = item.period;
      deleteBtn.hidden = !!(item.sample || item.remote);

      host.replaceChildren();
      const loading = el('div', { class: 'viewer-loading', text: 'Loading artwork…' });

      if (src) {
        const mv = document.createElement('model-viewer');
        mv.setAttribute('src', src);
        mv.setAttribute('alt', `3D model: ${item.title}`);
        mv.setAttribute('camera-controls', '');
        mv.setAttribute('touch-action', 'pan-y');
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('shadow-intensity', '1');
        mv.setAttribute('environment-image', 'neutral');
        mv.setAttribute('ar', '');
        mv.setAttribute('ar-modes', 'webxr quick-look');

        const arBtn = el('button', { slot: 'ar-button', class: 'btn-ar', type: 'button', text: 'View in AR' });
        mv.append(arBtn);
        mv.addEventListener('load', () => loading.classList.add('done'));
        host.append(mv, loading);
      } else {
        const frameImg = el('div', { class: 'viewer-2d-display' },
          el('img', { src: item.thumbnail || '', alt: item.title })
        );
        loading.classList.add('done');
        host.append(frameImg);
      }

      modal.hidden = false;
      document.body.classList.add('modal-open');
      $('.modal-close', modal).focus();
    }

    window.openArchiveDetail = id => {
      if (modal.hidden) openDetail(id);
    };

    function closeDetail() {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      host.replaceChildren();
      if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); activeBlobUrl = null; }
    }

    modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDetail(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeDetail(); });

    count.textContent = 'Loading archive…';
    items = await loadAll();
    refreshFilterOptions();
    render();

    const params = new URLSearchParams(location.search);
    if (params.get('added')) {
      toast('Artwork saved to the archive! ✓');
      history.replaceState(null, '', location.pathname);
    }
  }

  /* ==========================================================
     UPLOAD / SUBMIT PAGE
     ========================================================== */
  function initUpload() {
    const form = $('#uploadForm');
    if (!form) return;

    const fileInput = $('#modelFile');
    const previewBox = $('#previewBox');
    const viewer = $('#previewViewer');
    const errorBox = $('#formError');
    const submitBtn = $('#submitBtn');
    const modeNote = $('#modeNote');

    // Dynamic Class & Lecturer controls
    const classSelect = $('#className');
    const classCodeRow = $('#classCodeRow');
    const classCodeSelect = $('#classCode');
    const lecturerRow = $('#lecturerRow');
    const lecturerInput = $('#lecturer');

    /* ==========================================================
       CLASS & LECTURER CONFIGURATION
       Reads from window.ARCHIVE_CONFIG.CLASS_CATALOG (in config.js)
       with fallback defaults below:
       ========================================================== */
    const catalog = (CFG && CFG.CLASS_CATALOG) || {
      'Ilustrasi Desain': {
        'IL101': 'Dosen A',
        'IL102': 'Dosen B',
        'IL103': 'Dosen C'
      },
      'Fotografi Iklan': {
        'AP201': 'Dosen D',
        'AP202': 'Dosen E',
        'AP203': 'Dosen F'
      },
      'Tipografi Aplikatif': {
        'AT201': 'Dosen G',
        'AT202': 'Dosen H',
        'AT203': 'Dosen I'
      },
      'Advertising Photography': {
        'AP201': 'Dosen J',
        'AP202': 'Dosen K',
        'AP203': 'Dosen L'
      }
    };

    // When a Class is picked, show Class Code options
    classSelect.addEventListener('change', () => {
      const selectedClass = classSelect.value;
      classCodeSelect.innerHTML = '<option value="">Select Class Code…</option>';
      lecturerInput.value = '';
      lecturerRow.hidden = true;

      if (selectedClass && catalog[selectedClass]) {
        const codes = catalog[selectedClass];
        Object.entries(codes).forEach(([code, lecturerName]) => {
          const opt = document.createElement('option');
          opt.value = code;
          opt.textContent = `${code} (${lecturerName})`;
          classCodeSelect.appendChild(opt);
        });
        classCodeRow.hidden = false;
        classCodeSelect.required = true;
      } else {
        classCodeRow.hidden = true;
        classCodeSelect.required = false;
      }
    });

    // When Class Code is picked, auto-assign Lecturer
    classCodeSelect.addEventListener('change', () => {
      const selectedClass = classSelect.value;
      const selectedCode = classCodeSelect.value;
      if (selectedClass && selectedCode && catalog[selectedClass] && catalog[selectedClass][selectedCode]) {
        lecturerInput.value = catalog[selectedClass][selectedCode];
        lecturerRow.hidden = false;
      } else {
        lecturerInput.value = '';
        lecturerRow.hidden = true;
      }
    });

    let previewUrl = null;
    let modelReady = false;

    if (modeNote) {
      modeNote.textContent = CLOUD
        ? 'Shared archive: your artwork will be stored in Supabase and visible on all devices.'
        : 'This-device mode: artworks are stored locally in your browser.';
    }

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
        showError('Please choose a .glb file (export as GLB from Scaniverse or Blender).');
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        fileInput.value = ''; previewBox.hidden = true;
        showError(`That file is larger than ${MAX_FILE_MB} MB. Please use a smaller model.`);
        return;
      }
      previewUrl = URL.createObjectURL(file);
      viewer.setAttribute('src', previewUrl);
      previewBox.hidden = false;
    });

    window.addEventListener('beforeunload', () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
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
        ctx.fillStyle = '#1e1e1e';
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
        submitBtn.textContent = `Uploading model ${Math.round(p * 100)}%…`;
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
      const studentDisplayName = fields.nim ? `${fields.student} (${fields.nim})` : fields.student;

      const res = await fetch(`${SB_URL}/rest/v1/artworks`, {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({
          id,
          title: fields.title,
          description: fields.description,
          student: studentDisplayName,
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
        throw new Error(`Could not save artwork details (${res.status}): ${txt}`);
      }
    }

    async function saveLocally(file, fields, thumbnail) {
      const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await putModel(id, file);
      const studentDisplayName = fields.nim ? `${fields.student} (${fields.nim})` : fields.student;
      const items = loadLocalItems();
      items.unshift({
        id,
        title: fields.title,
        description: fields.description,
        student: studentDisplayName,
        studentName: fields.student,
        nim: fields.nim,
        lecturer: fields.lecturer,
        className: fields.className,
        classCode: fields.classCode,
        period: fields.period,
        thumbnail,
        fileName: file.name,
        createdAt: Date.now()
      });
      try {
        saveLocalItems(items);
      } catch (quotaErr) {
        await deleteModel(id).catch(() => {});
        throw new Error('Browser storage is full. Please delete some local artworks.');
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
        description: (fd.get('description') || '').trim(),
        student: fd.get('student').trim(),
        nim: (fd.get('nim') || '').trim(),
        period: fd.get('period').trim(),
        className: fd.get('className').trim(),
        classCode: (fd.get('classCode') || '').trim().toUpperCase(),
        lecturer: (fd.get('lecturer') || '').trim()
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing…';

      try {
        const thumbnail = await captureThumbnail();
        if (CLOUD) {
          await saveToCloud(file, fields, thumbnail);
        } else {
          await saveLocally(file, fields, thumbnail);
        }
        location.href = 'index.html?added=1';
      } catch (err) {
        console.error(err);
        showError(err.message || 'Something went wrong while saving. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save to archive';
      }
    });

    form.addEventListener('input', e => e.target.classList.remove('input-invalid'));
    form.addEventListener('change', e => e.target.classList.remove('input-invalid'));
  }

  window.arArchive = {
    loadAll,
    getModel,
    isCloud: CLOUD
  };

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'gallery') initGallery();
    if (page === 'upload') initUpload();
  });

  /* Accordion card interactivity and "+ See More" filter connector */
  document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.accordion-card');

    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });

      card.addEventListener('click', (e) => {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        // If clicking "+ See More", set class code filter and scroll to archive grid
        if (e.target.closest('.btn-more')) {
          const code = card.dataset.classCode;
          const select = document.getElementById('classFilter');
          if (select && code) {
            select.value = code;
            select.dispatchEvent(new Event('change'));
            const target = document.getElementById('grid-view-container');
            if (target) target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  });

})();