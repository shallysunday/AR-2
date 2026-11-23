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
      title: 'Wardah',
      description: 'Beauty in Every Shade.\nOleh:\nNaufal Septian\n24027031',
      student: 'Naufal Septian',
      lecturer: 'Aditya Hanum Widarsa S.Ds., M.Sn.',
      className: 'Illustration',
      classCode: 'Wed, 09.41',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#e07a5f',
      thumbnail: 'images/IL1.webp',
      sample: true
    },
    {
      id: 'sample-il-2',
      title: 'Harlette',
      description: 'All skin type, for everyone.\nOleh:\nNatasya\n24027094',
      student: 'Natasya',
      lecturer: 'Aditya Hanum Widarsa S.Ds., M.Sn.',
      className: 'Illustration',
      classCode: 'Wed, 09.41',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#81b29a',
      thumbnail: 'images/IL2.webp',
      sample: true
    },
    {
      id: 'sample-il-3',
      title: 'Penyu',
      description: 'Upaya pelestarian penyu di Indonesia.\nOleh:\nFarah Dina Aulia\n23027019',
      student: 'Farah Dina Aulia',
      lecturer: 'Riri Trinanda S.Pd., M.Sn.',
      className: 'Illustration',
      classCode: 'Thu, 07.51',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#3d405b',
      thumbnail: 'images/IL3.webp',
      sample: true
    },
    {
      id: 'sample-il-4',
      title: 'Hemat Energi',
      description: 'Selamatkan bumi!\nOleh:\nDaffa Ardhana\n23027027',
      student: 'Daffa Ardhana',
      lecturer: 'Riri Trinanda S.Pd., M.Sn.',
      className: 'Illustration',
      classCode: 'Thu, 07.51',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#f2cc8f',
      thumbnail: 'images/IL4.webp',
      sample: true
    },
    {
      id: 'sample-il-5',
      title: 'Wounded Shadow',
      description: 'Graphic story pacing and panel composition exploring urban myth.\nOleh:\nDiva Nurul Hasanah\n24027034',
      student: 'Diva Nurul Hasanah',
      lecturer: 'Riri Trinanda S.Pd., M.Sn.',
      className: 'Illustration',
      classCode: 'Thu, 07.51',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#f2cc8f',
      thumbnail: 'images/IL5.webp',
      sample: true
    },

    // --- Photography (2D Framed Wall Artworks) ---
    {
      id: 'sample-ph-1',
      title: 'Photography Assigment',
      description: 'Oleh:\nHana Riandra\n24027080',
      student: 'Hana Riandra',
      lecturer: 'Fauzan Aulia S.Ds., M.Sn.',
      className: 'Photography',
      classCode: 'Wed, 13.20',
      period: 'Odd 2025/2026',
      is2D: true,
      artColor: '#c32222',
      thumbnail: 'images/F_1.jpg',
      sample: true
    },
    {
      id: 'sample-ph-2',
      title: 'Photography Assigment',
      description: 'Oleh:\nMuhammad Rhaziq\n2402708',
      student: 'Muhammad Rhaziq',
      lecturer: 'Fauzan Aulia S.Ds., M.Sn.',
      className: 'Photography',
      classCode: 'Wed, 13.20',
      period: 'Odd 2025/2026',
      is2D: true,
      artColor: '#8d99ae',
      thumbnail: 'images/F_2.jpg',
      sample: true
    },
    {
      id: 'sample-ph-3a',
      title: 'Photography Assigment',
      description: 'Oleh:\nAdel Badilah Pratiwi\n24027155',
      student: 'Adel Badilah Pratiwi',
      lecturer: 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.',
      className: 'Photography',
      classCode: 'Mon, 07.51',
      period: 'Odd 2025/2026',
      is2D: true,
      artColor: '#4a4e69',
      thumbnail: 'images/F_3a.jpg',
      sample: true
    },
    {
      id: 'sample-ph-3b',
      title: 'Photography Assigment',
      description: 'Oleh:\nAdel Badilah Pratiwi\n24027155',
      student: 'Adel Badilah Pratiwi',
      lecturer: 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.',
      className: 'Photography',
      classCode: 'Mon, 07.51',
      period: 'Odd 2025/2026',
      is2D: true,
      artColor: '#4a4e69',
      thumbnail: 'images/F_3b.jpg',
      sample: true
    },
    {
      id: 'sample-ph-4',
      title: 'Photography Assigment',
      description: 'Oleh:\nSawwalina Fitri\n24027197',
      student: 'Sawwalina Fitri',
      lecturer: 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.',
      className: 'Photography',
      classCode: 'Mon, 07.51',
      period: 'Odd 2025/2026',
      is2D: true,
      artColor: '#6c5ce7',
      thumbnail: 'images/F_4.jpg',
      sample: true
    },
    {
      id: 'sample-ph-5a',
      title: 'Photography Assigment',
      description: 'Oleh:\nShabrina Qolby\n24027198',
      student: 'Shabrina Qolby',
      lecturer: 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.',
      className: 'Photography',
      classCode: 'Mon, 07.51',
      period: 'Odd 2025/2026',
      is2D: true,
      artColor: '#e75c5c',
      thumbnail: 'images/F_5a.jpeg',
      sample: true
    },
    {
      id: 'sample-ph-5b',
      title: 'Photography Assigment',
      description: 'Oleh:\nShabrina Qolby\n24027198',
      student: 'Shabrina Qolby',
      lecturer: 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.',
      className: 'Photography',
      classCode: 'Mon, 07.51',
      period: 'Odd 2025/2026',
      is2D: true,
      artColor: '#5cbde7',
      thumbnail: 'images/F_5b.jpeg',
      sample: true
    },
    {
      id: 'sample-ph-5c',
      title: 'Photography Assigment',
      description: 'Oleh:\nShabrina Qolby\n24027198',
      student: 'Shabrina Qolby',
      lecturer: 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.',
      className: 'Photography',
      classCode: 'Mon, 07.51',
      period: 'Odd 2025/2026',
      is2D: true,
      artColor: '#e7755c',
      thumbnail: 'images/F_5c.jpeg',
      sample: true
    },

    // --- Advertising Photography (2D Framed Wall Artworks) ---
    {
      id: 'sample-ap-1',
      title: 'Samba Karambie',
      description: 'Makanan Khas Lima Puluh Kota. \nAnggota:\n1. Suci Dwi Novita 24027050\n2. Muhammad Zacky 24027186\n3. Rahmi Ikhsani Disti 24027042',
      student: 'Kelompok 1 ',
      lecturer: 'Fauzan Aulia S.Ds., M.Sn.',
      className: 'Advertising Photography',
      classCode: 'Wed, 13.20',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#a8c25b',
      thumbnail: 'images/FI_A.png',
      sample: true
    },
    {
      id: 'sample-ap-2',
      title: 'Karak Kaliang',
      description: 'Makanan Khas Payakumbuh.\nAnggota:\n1. Hanna Riandra 24027018\n2. Rozan Rizandi 24027047',
      student: 'Kelompok 2',
      lecturer: 'Fauzan Aulia S.Ds., M.Sn.',
      className: 'Advertising Photography',
      classCode: 'Wed, 13.20',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#c8753e',
      thumbnail: 'images/FI_B.png',
      sample: true
    },
    {
      id: 'sample-ap-3',
      title: 'Rakik Pensi',
      description: 'Makanan Khas Maninjau. \n1. Andini Siregar 24027065\n2. Nafisah Putri 24027029\n3. Verona Del Qurama 24027108',
      student: 'Kelompok 3',
      lecturer: 'Fauzan Aulia S.Ds., M.Sn.',
      className: 'Advertising Photography',
      classCode: 'Wed, 13.20',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#f7eeaf',
      thumbnail: 'images/FI_C.png',
      sample: true
    },
    {
      id: 'sample-ap-4',
      title: 'Ladu Arai',
      description: 'Makanan Khas Pariaman. \nAnggota :\n1. Dindatul Afizah 24027013\n2. Syifwa Hafifa Salsabila 24027137\n3. Aqilah Qurrata Ayuni 24027066',
      student: 'Kelompok 4',
      lecturer: 'Fauzan Aulia S.Ds., M.Sn.',
      className: 'Advertising Photography',
      classCode: 'Wed, 13.20',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#a4bd98',
      thumbnail: 'images/FI_D.jpeg',
      sample: true
    },
    {
      id: 'sample-ap-5',
      title: 'Kue Talam',
      description: 'Makanan Khas Batu Sangkar. \nAnggota:\n 1. Muhammad Iqbal 24027035\n2. Muhammad Rhaziq 24027087\n 3. Willyam Zukhri Vanora 24027110',
      student: 'Kelompok 5',
      lecturer: 'Fauzan Aulia S.Ds., M.Sn.',
      className: 'Advertising Photography',
      classCode: 'Wed, 13.20',
      period: 'Odd 2026/2027',
      is2D: true,
      artColor: '#264653',
      thumbnail: 'images/FI_E.png',
      sample: true
    },

    // --- Applied Typography (3D Pedestal GLB Models) ---
    {
      id: 'sample-at-1',
      title: 'B for Burung',
      description: 'Oleh:\nAbdillah\n24027001',
      student: 'Abdillah',
      lecturer: 'Hendra afriwan, S.Sn, M.Sn',
      className: 'Applied Typography',
      classCode: 'Tue, 13.20',
      period: 'Odd 2025/2026',
      is2D: false,
      modelUrl: '3d/TA_1.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-2',
      title: 'D for Delima',
      description: 'Oleh:\nNajla Azizah\n24027030',
      student: 'Najla Azizah',
      lecturer: 'Arif Budiman, M.Kom',
      className: 'Applied Typography',
      classCode: 'Mon, 07.51',
      period: 'Odd 2025/2026',
      is2D: false,
      modelUrl: '3d/TA_2.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-3',
      title: 'K for Kawah',
      description: 'Oleh:\nRahmi Ikhsani Disti\n24027042',
      student: 'Rahmi Ikhsani Disti',
      lecturer: 'Hendra afriwan, S.Sn, M.Sn',
      className: 'Applied Typography',
      classCode: 'Tue, 13.20',
      period: 'Odd 2025/2026',
      is2D: false,
      modelUrl: '3d/TA_3.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-4',
      title: 'K for Kupu-Kupu',
      description: 'Oleh:\nTrisna Suhanta\n24027197',
      student: 'Trisna Suhanta',
      lecturer: 'Arif Budiman, M.Kom.',
      className: 'Applied Typography',
      classCode: 'Mon, 07.51',
      period: 'Odd 2025/2026',
      is2D: false,
      modelUrl: '3d/TA_4.glb',
      thumbnail: '',
      sample: true
    },
    {
      id: 'sample-at-5',
      title: 'N for Naga',
      description: 'Oleh:\nAdito Neta Pratama\n24027116',
      student: 'Adito Neta Pratama',
      lecturer: 'Arif Budiman, M.Kom.',
      className: 'Applied Typography',
      classCode: 'Tue, 7.51',
      period: 'Odd 2025/2026',
      is2D: false,
      modelUrl: '3d/TA_5.glb',
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

    /** Automatically inspect items database to build dynamic class name options */
    function refreshFilterOptions() {
      const classNames = uniqueSorted(items.map(i => i.className).filter(Boolean));

      const currentClass = classFilter.value;
      classFilter.replaceChildren(el('option', { value: '', text: 'All classes' }));
      classNames.forEach(name => {
        classFilter.append(el('option', { value: name, text: name }));
      });
      classFilter.value = classNames.includes(currentClass) ? currentClass : '';

      fillSelect(periodFilter, uniqueSorted(items.map(i => i.period)), 'All periods');
      state.className = classFilter.value;
      state.period = periodFilter.value;
    }

    function matches(item) {
      if (state.className && item.className !== state.className) return false;
      if (state.period && item.period !== state.period) return false;
      if (state.q) {
        const hay = [item.student, item.lecturer, item.title, item.className, item.classCode].map(norm).join(' | ');
        if (!hay.includes(norm(state.q))) return false;
      }
      return true;
    }

    function buildCard(item, index) {
      const thumb = el('div', { class: 'card-thumb' });
      const placeholder = el('div', { class: 'placeholder', 'aria-hidden': 'true', text: initials(item.title) });

      if (item.thumbnail) {
        const img = el('img', { src: item.thumbnail, alt: `Preview of ${item.title}`, loading: 'lazy' });
        img.addEventListener('error', () => {
          img.remove();
          if (!thumb.contains(placeholder)) thumb.prepend(placeholder);
        });
        thumb.append(img);
      } else {
        thumb.append(placeholder);
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
    classFilter.addEventListener('change', () => { state.className = classFilter.value; render(); });
    periodFilter.addEventListener('change', () => { state.period = periodFilter.value; render(); });
    $('#resetFilters').addEventListener('click', () => {
      searchInput.value = ''; classFilter.value = ''; periodFilter.value = '';
      state.q = state.className = state.period = '';
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
      const viewerHint = $('#viewerHint');

      if (src) {
        if (viewerHint) viewerHint.textContent = 'Drag to rotate · Pinch to zoom · AR on Android needs Google Play Services for AR and the Google app';
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
        if (viewerHint) viewerHint.textContent = 'Click artwork image to view in fullscreen with zoom and pan';
        const frameImg = el('div', { class: 'viewer-2d-display', title: 'Click to expand fullscreen' },
          el('img', { src: item.thumbnail || '', alt: item.title })
        );
        frameImg.addEventListener('click', () => {
          if (item.thumbnail) openLightbox(item.thumbnail, item.title);
        });
        loading.classList.add('done');
        host.append(frameImg);
      }

      modal.hidden = false;
      document.body.classList.add('modal-open');
      $('.modal-close', modal).focus();
    }

    /* ==========================================================
       FULLSCREEN 2D IMAGE LIGHTBOX (Zoom & Pan)
       ========================================================== */
    const lightbox = $('#lightboxModal');
    const lightboxImg = $('#lightboxImg');
    const lightboxStage = $('#lightboxStage');
    const lightboxCloseBtn = $('#lightboxCloseBtn');
    const lightboxZoomVal = $('#lightboxZoomVal');
    const lightboxZoomIn = $('#lightboxZoomIn');
    const lightboxZoomOut = $('#lightboxZoomOut');
    const lightboxReset = $('#lightboxReset');

    let lbScale = 1;
    let lbTranslateX = 0;
    let lbTranslateY = 0;
    let lbIsDragging = false;
    let lbStartX = 0;
    let lbStartY = 0;
    let lbTouchDist = 0;

    function applyLightboxTransform() {
      if (!lightboxImg) return;
      lightboxImg.style.transform = `translate(${lbTranslateX}px, ${lbTranslateY}px) scale(${lbScale})`;
      if (lightboxZoomVal) lightboxZoomVal.textContent = `${Math.round(lbScale * 100)}%`;
    }

    function setLightboxZoom(newScale, centerX, centerY) {
      const clamped = Math.min(6, Math.max(0.5, newScale));
      if (centerX !== undefined && centerY !== undefined) {
        const factor = clamped / lbScale;
        lbTranslateX = centerX - factor * (centerX - lbTranslateX);
        lbTranslateY = centerY - factor * (centerY - lbTranslateY);
      }
      lbScale = clamped;
      applyLightboxTransform();
    }

    function resetLightboxZoom() {
      lbScale = 1;
      lbTranslateX = 0;
      lbTranslateY = 0;
      applyLightboxTransform();
    }

    function openLightbox(src, title) {
      if (!lightbox || !lightboxImg) return;
      lightboxImg.src = src;
      lightboxImg.alt = title || 'Artwork image';
      resetLightboxZoom();
      lightbox.hidden = false;
      document.body.classList.add('modal-open');
      if (lightboxCloseBtn) lightboxCloseBtn.focus();
    }

    function closeLightbox() {
      if (!lightbox || lightbox.hidden) return;
      lightbox.hidden = true;
      resetLightboxZoom();
      // Keep modal-open if detail modal is still open
      if (modal && !modal.hidden) {
        document.body.classList.add('modal-open');
      } else {
        document.body.classList.remove('modal-open');
      }
    }

    if (lightbox) {
      if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
      const backdrop = $('.lightbox-backdrop', lightbox);
      if (backdrop) backdrop.addEventListener('click', closeLightbox);

      if (lightboxZoomIn) {
        lightboxZoomIn.addEventListener('click', () => setLightboxZoom(lbScale + 0.35));
      }
      if (lightboxZoomOut) {
        lightboxZoomOut.addEventListener('click', () => setLightboxZoom(lbScale - 0.35));
      }
      if (lightboxReset) {
        lightboxReset.addEventListener('click', resetLightboxZoom);
      }

      // Mouse wheel zoom
      lightboxStage.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        const rect = lightboxStage.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        setLightboxZoom(lbScale + delta, cx, cy);
      }, { passive: false });

      // Drag / pan
      lightboxStage.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        lbIsDragging = true;
        lbStartX = e.clientX - lbTranslateX;
        lbStartY = e.clientY - lbTranslateY;
        lightboxStage.classList.add('dragging');
      });

      window.addEventListener('mousemove', e => {
        if (!lbIsDragging) return;
        lbTranslateX = e.clientX - lbStartX;
        lbTranslateY = e.clientY - lbStartY;
        applyLightboxTransform();
      });

      window.addEventListener('mouseup', () => {
        if (lbIsDragging) {
          lbIsDragging = false;
          lightboxStage.classList.remove('dragging');
        }
      });

      // Touch events (Pinch-to-zoom & touch drag)
      lightboxStage.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
          lbIsDragging = true;
          lbStartX = e.touches[0].clientX - lbTranslateX;
          lbStartY = e.touches[0].clientY - lbTranslateY;
        } else if (e.touches.length === 2) {
          lbIsDragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lbTouchDist = Math.hypot(dx, dy);
        }
      }, { passive: true });

      lightboxStage.addEventListener('touchmove', e => {
        if (e.touches.length === 1 && lbIsDragging) {
          lbTranslateX = e.touches[0].clientX - lbStartX;
          lbTranslateY = e.touches[0].clientY - lbStartY;
          applyLightboxTransform();
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          if (lbTouchDist > 0) {
            const scaleFactor = dist / lbTouchDist;
            setLightboxZoom(lbScale * scaleFactor);
          }
          lbTouchDist = dist;
        }
      }, { passive: true });

      lightboxStage.addEventListener('touchend', e => {
        if (e.touches.length === 0) {
          lbIsDragging = false;
          lbTouchDist = 0;
        }
      });
    }

    window.openArchiveDetail = id => {
      if (modal.hidden) openDetail(id);
    };

    function closeDetail() {
      closeLightbox();
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      host.replaceChildren();
      if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); activeBlobUrl = null; }
    }

    modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeDetail(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (lightbox && !lightbox.hidden) {
          closeLightbox();
        } else if (!modal.hidden) {
          closeDetail();
        }
      }
    });

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
    const previewImage = $('#previewImage');
    const fileLabel = $('#fileLabel');
    const fileHelp = $('#fileHelp');
    const previewLabel = $('#previewLabel');
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
      'Illustration': {
        'Wed, 09.41': 'Aditya Hanum Widarsa S.Ds., M.Sn.',
        'Thu, 07.51': 'Riri Trinanda S.Pd., M.Sn.'
      },
      'Photography': {
        'Wed, 13.20': 'Fauzan Aulia S.Ds., M.Sn.',
        'Mon, 07.51': 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.'
      },
      'Advertising Photography': {
        'Wed, 13.20': 'Fauzan Aulia S.Ds., M.Sn.'
      },
      'Applied Typography': {
        'Tue, 13.20': 'Hendra afriwan, S.Sn, M.Sn',
        'Mon, 07.51': 'Arif Budiman, M.Kom',
        'Tue, 7.51': 'Arif Budiman, M.Kom.'
      },
      // Aliases for localized names if present
      'Ilustrasi Desain': {
        'Wed, 09.41': 'Aditya Hanum Widarsa S.Ds., M.Sn.',
        'Thu, 07.51': 'Riri Trinanda S.Pd., M.Sn.'
      },
      'Fotografi Iklan': {
        'Wed, 13.20': 'Fauzan Aulia S.Ds., M.Sn.',
        'Mon, 07.51': 'Rifqy Aulia Zaim, S.Pd., M.Pd.T.'
      },
      'Tipografi Aplikatif': {
        'Tue, 13.20': 'Hendra afriwan, S.Sn, M.Sn',
        'Mon, 07.51': 'Arif Budiman, M.Kom',
        'Tue, 7.51': 'Arif Budiman, M.Kom.'
      }
    };

    const isTipografi = cls => {
      const c = (cls || '').trim().toLowerCase();
      return c === 'tipografi aplikatif' || c === 'applied typography';
    };

    function updateFileAcceptance() {
      const cls = classSelect.value;
      const requires3D = isTipografi(cls);

      if (requires3D) {
        fileInput.accept = '.glb,model/gltf-binary';
        if (fileLabel) fileLabel.innerHTML = '3D Model File (.glb) <span class="req">*</span>';
        if (fileHelp) fileHelp.innerHTML = 'Choose a <strong>.glb</strong> file (exported from Scaniverse or Blender). Maximum file size: <strong>50 MB</strong>.';
        if (previewLabel) previewLabel.textContent = 'Preview — rotate it to choose the thumbnail angle';
      } else {
        fileInput.accept = '.png,.jpg,.jpeg,image/png,image/jpeg';
        if (fileLabel) fileLabel.innerHTML = 'Artwork Image (PNG / JPEG) <span class="req">*</span>';
        if (fileHelp) fileHelp.innerHTML = 'Choose a <strong>PNG or JPEG</strong> image file. Maximum file size: <strong>5 MB</strong>.';
        if (previewLabel) previewLabel.textContent = 'Artwork Image Preview';
      }
    }

    function checkFormValidity() {
      const requiredInputs = Array.from(form.querySelectorAll('[required]'));
      const allFilled = requiredInputs.every(field => {
        if (field.type === 'file') {
          return field.files && field.files.length > 0;
        }
        return field.value && field.value.trim().length > 0;
      });
      submitBtn.disabled = !allFilled;
    }

    // Initialize file acceptance based on initial selection (or default)
    updateFileAcceptance();
    checkFormValidity();

    // When a Class is picked, show Class Code options and update file acceptance
    classSelect.addEventListener('change', () => {
      const selectedClass = classSelect.value;
      updateFileAcceptance();

      // Clear file input if format requirement changes
      if (fileInput.files.length > 0) {
        fileInput.value = '';
        if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
        if (previewBox) previewBox.hidden = true;
        if (viewer) viewer.hidden = true;
        if (previewImage) previewImage.hidden = true;
      }

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
      checkFormValidity();
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
      checkFormValidity();
    });

    let previewUrl = null;
    let modelReady = false;
    let image2DDataUrl = null;

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
      image2DDataUrl = null;
      if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
      const file = fileInput.files[0];
      if (!file) {
        previewBox.hidden = true;
        checkFormValidity();
        return;
      }

      const requires3D = isTipografi(classSelect.value);

      if (requires3D) {
        if (!/\.glb$/i.test(file.name)) {
          fileInput.value = ''; previewBox.hidden = true;
          showError('Please choose a .glb file (export as GLB from Scaniverse or Blender).');
          checkFormValidity();
          return;
        }
        if (file.size > 50 * 1024 * 1024) {
          fileInput.value = ''; previewBox.hidden = true;
          showError('That file is larger than 50 MB. Please use a smaller model.');
          checkFormValidity();
          return;
        }
        previewUrl = URL.createObjectURL(file);
        viewer.setAttribute('src', previewUrl);
        viewer.hidden = false;
        if (previewImage) previewImage.hidden = true;
        previewBox.hidden = false;
      } else {
        if (!/\.(png|jpe?g)$/i.test(file.name)) {
          fileInput.value = ''; previewBox.hidden = true;
          showError('Please choose a PNG or JPEG image file.');
          checkFormValidity();
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          fileInput.value = ''; previewBox.hidden = true;
          showError('That image is larger than 5 MB. Please compress or choose a smaller image.');
          checkFormValidity();
          return;
        }
        previewUrl = URL.createObjectURL(file);
        if (previewImage) {
          previewImage.src = previewUrl;
          previewImage.hidden = false;
        }
        viewer.hidden = true;
        previewBox.hidden = false;

        // Read image to dataURL for thumbnail generation
        const reader = new FileReader();
        reader.onload = ev => { image2DDataUrl = ev.target.result; };
        reader.readAsDataURL(file);
      }

      checkFormValidity();
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

    async function captureThumbnail(is2D, file) {
      if (is2D) {
        if (image2DDataUrl) return image2DDataUrl;
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
      }
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

    async function saveToCloud(file, fields, thumbnail, is2D) {
      const id = newId();
      let modelPath = '';
      let thumbPath = `thumbs/${id}.jpg`;
      const ext = file.name.split('.').pop().toLowerCase();

      if (is2D) {
        const imgPath = `images/${id}.${ext === 'png' ? 'png' : 'jpg'}`;
        await xhrUpload(imgPath, file, file.type || (ext === 'png' ? 'image/png' : 'image/jpeg'), p => {
          submitBtn.textContent = `Uploading artwork ${Math.round(p * 100)}%…`;
        });
        thumbPath = imgPath;
      } else {
        modelPath = `models/${id}.glb`;
        await xhrUpload(modelPath, file, 'model/gltf-binary', p => {
          submitBtn.textContent = `Uploading model ${Math.round(p * 100)}%…`;
        });
      }

      let thumbnailUrl = '';
      if (is2D) {
        thumbnailUrl = publicUrl(thumbPath);
      } else if (thumbnail) {
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

      const payload = {
        id,
        title: fields.title,
        description: fields.description,
        student: studentDisplayName,
        lecturer: fields.lecturer,
        class_name: fields.className,
        class_code: fields.classCode,
        period: fields.period,
        model_url: is2D ? '' : publicUrl(modelPath),
        thumbnail_url: thumbnailUrl
      };
      if (is2D) {
        payload.is_2d = true;
      }

      const res = await fetch(`${SB_URL}/rest/v1/artworks`, {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Could not save artwork details (${res.status}): ${txt}`);
      }
    }

    async function saveLocally(file, fields, thumbnail, is2D) {
      const id = 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      if (!is2D) {
        await putModel(id, file);
      }
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
        is2D: !!is2D,
        createdAt: Date.now()
      });
      try {
        saveLocalItems(items);
      } catch (quotaErr) {
        if (!is2D) await deleteModel(id).catch(() => {});
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
        showError('Please fill in all required fields and choose a valid file.');
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

      const is2D = !isTipografi(fields.className);

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing…';

      try {
        const thumbnail = await captureThumbnail(is2D, file);
        if (CLOUD) {
          await saveToCloud(file, fields, thumbnail, is2D);
        } else {
          await saveLocally(file, fields, thumbnail, is2D);
        }
        location.href = 'index.html?added=1';
      } catch (err) {
        console.error(err);
        showError(err.message || 'Something went wrong while saving. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save to archive';
      }
    });

    form.addEventListener('input', e => {
      e.target.classList.remove('input-invalid');
      checkFormValidity();
    });
    form.addEventListener('change', e => {
      e.target.classList.remove('input-invalid');
      checkFormValidity();
    });
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