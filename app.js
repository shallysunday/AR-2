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