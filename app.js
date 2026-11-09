/* ==========================================================
   AR Art & Design Archive — app logic
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
  const BUILD = 'build 6';
  let lastLoadError = '';

  let itemsCache = null;
  let itemsCacheTime = 0;
  const ITEMS_CACHE_TTL = 30_000;

  const STORE_KEY = 'arArchive.items.v1';
  const DB_NAME = 'arArchiveFiles';
  const DB_STORE = 'models';
  const MAX_FILE_MB = CLOUD ? 50 : 60;

  /* ---------- Sample artworks (Illustration, Photography, Advertising Photography, Applied Typography) ---------- */
  const MS = 'https://modelviewer.dev/shared-assets/models/';
  const SAMPLE_ITEMS = [
    // --- Illustration ---
    {
      id: 'sample-il-1',
      title: 'Character Line & Form',
      description: 'Digital 2D illustration exploring silhouette, gesture, and linework.',
      student: 'Alya Putri',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#e07a5f',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-il-2',
      title: 'Expressive Creature',
      description: '3D character sculpture study based on initial illustration concept.',
      student: 'Rizky Pratama',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: MS + 'RobotExpressive.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-il-3',
      title: 'Editorial Visual Narrative',
      description: 'Editorial poster illustration exploring color harmony and rhythm.',
      student: 'Dimas Wicaksono',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#3d405b',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-il-4',
      title: 'Digital Creature Model',
      description: 'Three-dimensional interpretation of an illustrated mascot.',
      student: 'Siti Maharani',
      lecturer: 'Ary Ramadhan, S.Pd., M.Pd.T.',
      className: 'Illustration',
      classCode: 'IL101',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb',
      thumbnail: '',
      sample: true
    },

    // --- Photography ---
    {
      id: 'sample-ph-1',
      title: 'Monochrome Geometry',
      description: 'Architectural photography study focusing on high-contrast shadows.',
      student: 'Fajar Nugroho',
      lecturer: 'Siti Rahma, M.Sn.',
      className: 'Photography',
      classCode: 'PH101',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#2b2d42',
      thumbnail: '',
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
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-ph-3',
      title: 'Signal Lantern Artifact',
      description: '3D scan of an antique studio signal lantern light object.',
      student: 'Kevin Hartono',
      lecturer: 'Siti Rahma, M.Sn.',
      className: 'Photography',
      classCode: 'PH101',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Lantern/glTF-Binary/Lantern.glb',
      thumbnail: '',
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
      artColor: '#4a4e69',
      thumbnail: '',
      sample: true
    },

    // --- Advertising Photography ---
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
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-ap-2',
      title: 'Hydro Product Bottle',
      description: 'Commercial 3D packaging bottle model for print and web ad.',
      student: 'Citra Dewi',
      lecturer: 'Doni Prasetyo, M.Ds.',
      className: 'Advertising Photography',
      classCode: 'AP201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/WaterBottle/glTF-Binary/WaterBottle.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-ap-3',
      title: 'Retro Audio Campaign',
      description: 'Product placement setup featuring a retro sound boombox object.',
      student: 'Nadia Rahma',
      lecturer: 'Doni Prasetyo, M.Ds.',
      className: 'Advertising Photography',
      classCode: 'AP201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',
      thumbnail: '',
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
      thumbnail: '',
      sample: true
    },

    // --- Applied Typography ---
    {
      id: 'sample-at-1',
      title: 'Expressive Type Poster',
      description: 'Modular grid breakdown and expressive typographic scale.',
      student: 'Intan Permata',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#1d3557',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-2',
      title: 'Spatial Letterform Sculpture',
      description: '3D kinetic typographic object designed for spatial wayfinding.',
      student: 'Rafi Maulana',
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
      id: 'sample-at-3',
      title: 'Experimental Grid & Type',
      description: 'Editorial layout exploration focusing on asymmetrical typography.',
      student: 'Dewi Anggraini',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#457b9d',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-4',
      title: 'Mascot Mark in 3D',
      description: 'Brand typographic mascot translated into 3D volume.',
      student: 'Alya Putri',
      lecturer: 'Maya Anggraini, M.Ds.',
      className: 'Applied Typography',
      classCode: 'AT201',
      period: 'Odd 2026/2027',
      is2D: false,
      modelUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Duck/glTF-Binary/Duck.glb',
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
  const putModel = (id, blob) => idb('readwrite', s => s.put(blob, id));
  const getModel = id => idb('readonly', s => s.get(id));
  const deleteModel = id => idb('readwrite', s => s.delete(id));

  function sbHeaders(extra = {}) {
    const h = { apikey: CFG.SUPABASE_ANON_KEY, ...extra };
    if (CFG.SUPABASE_ANON_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + CFG.SUPABASE_ANON_KEY;
    return h;
  }

  const publicUrl = path => `${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`;

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
    let lastFocus = null;

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

      lastFocus = document.activeElement;
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
  }

  window.arArchive = {
    loadAll,
    getModel,
    isCloud: CLOUD
  };

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page === 'gallery') initGallery();
  });
})();