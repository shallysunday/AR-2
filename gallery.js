/* ==========================================================
   gallery.js — Procedural architectural museum walkthrough.
   Fully optimized for fast website load and smooth mobile/desktop FPS.
   ========================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  bestPlan, walkRects, artSlots, groupByClass,
  worldOf, rot, DOOR_W, WALL_T, CORR_L
} from './gallery-layout.js';

const MAX_ARTWORKS_3D   = 80;
const CONCURRENT_MODELS = 3;
const PLAQUE_W = 1.1, PLAQUE_H = 0.72;

/* ----------------------------------------------------------
   Canvas textures
   ---------------------------------------------------------- */
function makeSignCanvas(classCode, className, isEntrance) {
  const W = 512, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1b1b1a';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#c8553d';
  ctx.font = 'bold 56px -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = isEntrance ? 'left' : 'right';
  ctx.fillText('→', isEntrance ? 24 : W - 24, H / 2 + 2);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${classCode}  ·  ${className.toUpperCase()}`, W / 2, H / 2 + 2);

  return c;
}

function makePlaqueCanvas(item) {
  const W = 384, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e7e5df';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

  ctx.fillStyle = '#c8553d';
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText((item.classCode || '').toUpperCase(), 18, 30);

  ctx.fillStyle = '#1b1b1a';
  ctx.font = 'bold 24px Georgia, serif';
  const title = clamp(ctx, item.title || 'Untitled', W - 36, 26);
  ctx.fillText(title, 18, 62);

  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.fillText(clamp(ctx, item.student || '', W - 36, 15), 18, 92);

  ctx.fillStyle = '#5d5d58';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.fillText(clamp(ctx, item.lecturer || '', W - 36, 13), 18, 112);

  ctx.strokeStyle = '#e7e5df';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, 128); ctx.lineTo(W - 18, 128); ctx.stroke();

  ctx.fillStyle = '#5d5d58';
  ctx.font = '12px -apple-system, sans-serif';
  const words = String(item.description || '').split(/\s+/);
  let line = '', y = 148;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > W - 36) { ctx.fillText(line, 18, y); line = w; y += 16; if (y > 190) break; }
    else line = test;
  }
  if (line && y <= 190) ctx.fillText(line, 18, y);

  ctx.fillStyle = '#1b1b1a';
  ctx.fillRect(0, H - 42, W, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TAP TO OPEN IN AR  →', W / 2, H - 16);

  return c;
}

function clamp(ctx, text, maxWidth, size) {
  text = String(text);
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) cut = cut.slice(0, -1);
  return cut + '…';
}

/* ----------------------------------------------------------
   Main class
   ---------------------------------------------------------- */
export class ArchitecturalGallery {
  constructor(containerEl, onSelectArtwork) {
    this.container = containerEl;
    this.onSelectArtwork = onSelectArtwork || null;
    this.onReady = null;
    this.onProgress = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.classes = [];
    this.plan = null;
    this.walkRects = [];

    this.playerPos = [0, 0];
    this.playerYaw = 0;

    this.isDragging = false;
    this.dragDistance = 0;
    this.previousMousePosition = { x: 0, y: 0 };
    this.keys = new Set();
    this.raycaster = null;
    this.pointer = null;
    this.joystick = { active: false, dx: 0, dy: 0 };

    this._running = true;
    this._controller = null;
    this._blobUrls = [];
    this.isTransitioning = false;
    this._generation = 0;
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f4f6);
    this.scene.fog = new THREE.FogExp2(0xf4f4f6, 0.006);

    this.camera = new THREE.PerspectiveCamera(
      60, this.container.clientWidth / this.container.clientHeight, 0.1, 1000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const key = new THREE.DirectionalLight(0xfff3e0, 1.2);
    key.position.set(24, 40, 22);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.camera.far = 300;
    this.scene.add(key);
    this.keyLight = key;

    try {
      await this.loadDataAndBuild();
    } catch (e) {
      console.error('3D gallery build failed', e);
    }

    window.addEventListener('resize', () => this.onWindowResize());
    this.setupControls();
    this.setupJoystick();
    this.animate();

    if (this.onReady) this.onReady();
  }

  /* --------------------------------------------------------
     Data
     -------------------------------------------------------- */
  async loadItems() {
    const loadPromise = (async () => {
      if (window.arArchive && typeof window.arArchive.loadAll === 'function') {
        let items = await window.arArchive.loadAll();
        if (items.length > MAX_ARTWORKS_3D) {
          console.warn(`3D view capped to ${MAX_ARTWORKS_3D} / ${items.length} artworks`);
          items = items.slice(0, MAX_ARTWORKS_3D);
        }

        const pending = items.filter(it => !it.modelUrl && window.arArchive.getModel);
        if (pending.length) {
          await Promise.all(pending.map(async it => {
            try {
              const blob = await window.arArchive.getModel(it.id);
              if (blob) {
                const url = URL.createObjectURL(blob);
                this._blobUrls.push(url);
                it.modelUrl = url;
              }
            } catch (e) { console.warn('blob load failed', it.id, e); }
          }));
        }
        return items;
      }

      try {
        const raw = localStorage.getItem('arArchive.items.v1');
        if (raw) return JSON.parse(raw);
      } catch { /* ignore */ }
      return [];
    })();

    const timeout = new Promise(res => setTimeout(() => res(null), 6000));
    const items = await Promise.race([loadPromise, timeout]);
    if (items === null) console.warn('Archive load timed out — samples only');

    if (!items || !items.length) {
      return [
        { title: 'Astronaut Study', student: 'Alya Putri', lecturer: 'Dr. Budi Santoso',
          className: 'Typography II', classCode: 'DK202',
          modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb' },
        { title: 'Expressive Robot', student: 'Rizky Pratama', lecturer: 'Maya Anggraini',
          className: 'Character Design I', classCode: 'DK115',
          modelUrl: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb' }
      ];
    }
    return items;
  }

  async loadDataAndBuild() {
    const t0 = performance.now();
    const items = await this.loadItems();
    console.log(`[gallery] items loaded: ${items.length} in ${(performance.now() - t0).toFixed(0)}ms`);

    this.classes = groupByClass(items);
    if (!this.classes.length) { this.plan = { entries: [], corridors: [] }; this.walkRects = []; return; }

    const t1 = performance.now();
    this.plan = bestPlan(this.classes.map(c => c.items.length));
    this.walkRects = walkRects(this.plan);
    console.log(`[gallery] layout: ${this.plan.entries.length} rooms in ${(performance.now() - t1).toFixed(0)}ms`);

    this.fitShadowCamera();

    const t2 = performance.now();
    await this.buildMuseumGeometry();
    console.log(`[gallery] geometry built in ${(performance.now() - t2).toFixed(0)}ms`);

    const r0 = this.plan.entries.find(e => e.role === 'main' && e.ci === 0);
    if (r0) {
      this.playerPos = [r0.P[0], r0.P[1] + r0.D / 2 - 2.5];
      this.playerYaw = r0.yaw + Math.PI;
    }

    console.log(`[gallery] TOTAL build: ${(performance.now() - t0).toFixed(0)}ms · meshes: ${this.countMeshes()}`);
  }

  fitShadowCamera() {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const e of this.plan.entries) {
      x0 = Math.min(x0, e.P[0] - e.W / 2);
      x1 = Math.max(x1, e.P[0] + e.W / 2);
      z0 = Math.min(z0, e.P[1] - e.D / 2);
      z1 = Math.max(z1, e.P[1] + e.D / 2);
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const span = Math.max(x1 - x0, z1 - z0) + 20;
    const cam = this.keyLight.shadow.camera;
    cam.left = -span / 2;
    cam.right = span / 2;
    cam.top = span / 2;
    cam.bottom = -span / 2;
    cam.updateProjectionMatrix();
    this.keyLight.position.set(cx + 24, 40, cz + 22);
    this.keyLight.target.position.set(cx, 0, cz);
    this.scene.add(this.keyLight.target);
  }

  countMeshes() {
    let n = 0;
    this.scene.traverse(o => { if (o.isMesh) n++; });
    return n;
  }

  /* --------------------------------------------------------
     Geometry — builds rooms then fire-and-forgets model loads
     -------------------------------------------------------- */
  async buildMuseumGeometry() {
    const H = 5.0;
    const total = this.plan.entries.length;

    const wallMat  = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xe9e7e2 });
    const ceilMat  = new THREE.MeshLambertMaterial({ color: 0xfbfaf7 });
    const pedMat   = new THREE.MeshLambertMaterial({ color: 0xfbfaf7 });
    const plaqueGeo = new THREE.PlaneGeometry(PLAQUE_W, PLAQUE_H);
    const signGeo   = new THREE.PlaneGeometry(3.2, 0.8);
    const pedGeo    = new THREE.BoxGeometry(1.2, 1.1, 1.2);

    const signTex  = new Map();
    const plaqueTex = new Map();
    const modelQueue = [];

    for (let i = 0; i < total; i++) {
      const entry = this.plan.entries[i];
      const cls = this.classes[entry.ci];
      if (!cls) continue;

      const room = new THREE.Group();
      room.position.set(entry.P[0], 0, entry.P[1]);
      room.rotation.y = entry.yaw;

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(entry.W, entry.D), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      room.add(floor);

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(entry.W, entry.D), ceilMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = H;
      room.add(ceiling);

      this.buildWalls(room, entry, H, wallMat);

      this.createSign(room, entry, cls.code, cls.name, true,  signGeo, signTex);
      this.createSign(room, entry, cls.code, cls.name, false, signGeo, signTex);

      const slots = artSlots(entry, cls.items.length);
      cls.items.forEach((art, idx) => {
        const slot = slots[idx];
        if (!slot) return;
        try {
          this.createPedestal(room, slot, art, pedGeo, pedMat, plaqueGeo, plaqueTex, modelQueue);
        } catch (e) {
          console.error('Pedestal failed for', art && art.title, e);
        }
      });

      // Optimize static museum room matrices (avoids recalculating every frame)[cite: 10]
      room.matrixAutoUpdate = false;
      room.updateMatrix();

      this.scene.add(room);

      if (this.onProgress) this.onProgress((i + 1) / (total + 1), `Building room ${i + 1} / ${total}…`);

      await new Promise(r => setTimeout(r, 0));
    }

    // Fire-and-forget model loading — never blocks the loading screen[cite: 10]
    if (modelQueue.length) {
      console.log(`[gallery] queuing ${modelQueue.length} models (loading in background)`);
      this._loadModelsInBackground(modelQueue);
    }

    if (this.onProgress) this.onProgress(1, 'Ready');
  }

  /* Background model loader — doesn't block onReady()[cite: 10] */
  _loadModelsInBackground(queue) {
    const gen = this._generation;
    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        if (this._generation !== gen) return;
        const task = queue[cursor++];

        let ok = false;
        try {
          ok = await Promise.race([
            this.loadModel(task.group, task.art),
            new Promise(resolve => setTimeout(() => resolve(false), 12000))
          ]);
        } catch (e) {
          console.warn('[gallery] model error:', task.art && task.art.title, e);
        }

        if (this._generation !== gen) return;
        if (!ok) this._addFallback(task.group);

        await new Promise(r => setTimeout(r, 0));
      }
    };

    const n = Math.min(CONCURRENT_MODELS, queue.length);
    for (let i = 0; i < n; i++) worker();
  }

  _addFallback(group) {
    if (group.userData._hasFallback) return;
    group.userData._hasFallback = true;
    const fallback = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      new THREE.MeshLambertMaterial({ color: 0x1b1b1a })
    );
    fallback.position.y = 1.5;
    fallback.castShadow = true;
    group.add(fallback);
  }

  buildWalls(group, entry, H, mat) {
    const { W, D, exit } = entry;
    const halfW = W / 2, halfD = D / 2;
    const t = WALL_T;
    const doorH = 3.0, doorW = DOOR_W;

    const seg = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.01) return;
      const horiz = Math.abs(z1 - z0) < 1e-4;
      const geo = horiz
        ? new THREE.BoxGeometry(len, H, t)
        : new THREE.BoxGeometry(t, H, len);
      const m = new THREE.Mesh(geo, mat);
      m.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
      m.castShadow = true;
      group.add(m);
    };

    const wallWithDoor = (x0, z0, x1, z1, doorFrac) => {
      const total = Math.hypot(x1 - x0, z1 - z0);
      const dh = (doorW / 2) / total;
      const aF = Math.max(0, doorFrac - dh);
      const bF = Math.min(1, doorFrac + dh);
      seg(x0, z0, x0 + (x1 - x0) * aF, z0 + (z1 - z0) * aF);
      seg(x0 + (x1 - x0) * bF, z0 + (z1 - z0) * bF, x1, z1);
      const cx = x0 + (x1 - x0) * doorFrac;
      const cz = z0 + (z1 - z0) * doorFrac;
      const horiz = Math.abs(z1 - z0) < 1e-4;
      const lGeo = horiz
        ? new THREE.BoxGeometry(doorW, H - doorH, t)
        : new THREE.BoxGeometry(t, H - doorH, doorW);
      const lintel = new THREE.Mesh(lGeo, mat);
      lintel.position.set(cx, doorH + (H - doorH) / 2, cz);
      lintel.castShadow = true;
      group.add(lintel);
    };

    wallWithDoor(-halfW, halfD, halfW, halfD, 0.5);

    if (exit.side === 'N')      wallWithDoor(-halfW, -halfD, halfW, -halfD, 0.5 + exit.pos[0] / W);
    else if (exit.side === 'W') wallWithDoor(-halfW, -halfD, -halfW, halfD, 0.5 + exit.pos[1] / D);
    else                        wallWithDoor(halfW, -halfD, halfW, halfD, 0.5 + exit.pos[1] / D);

    if (exit.side !== 'N') seg(-halfW, -halfD, halfW, -halfD);
    if (exit.side !== 'W') seg(-halfW, -halfD, -halfW, halfD);
    if (exit.side !== 'E') seg(halfW, -halfD, halfW, halfD);
  }

  createSign(group, entry, code, name, isEntrance, geo, cache) {
    const key = `${code}-${isEntrance ? 'in' : 'out'}`;
    if (!cache.has(key)) {
      const tex = new THREE.CanvasTexture(makeSignCanvas(code, name, isEntrance));
      tex.colorSpace = THREE.SRGBColorSpace;
      // Cap texture anisotropy to optimize mobile GPU bandwidth[cite: 10]
      tex.anisotropy = Math.min(4, this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 4);
      cache.set(key, tex);
    }
    const mat = new THREE.MeshBasicMaterial({ map: cache.get(key) });
    const sign = new THREE.Mesh(geo, mat);

    if (isEntrance) {
      sign.position.set(0, 3.65, entry.D / 2 - 0.08);
      sign.rotation.y = Math.PI;
    } else {
      const ex = entry.exit;
      if (ex.side === 'N') { sign.position.set(ex.pos[0], 3.65, -entry.D / 2 + 0.08); sign.rotation.y = 0; }
      else if (ex.side === 'W') { sign.position.set(-entry.W / 2 + 0.08, 3.65, ex.pos[1]); sign.rotation.y = Math.PI / 2; }
      else { sign.position.set(entry.W / 2 - 0.08, 3.65, ex.pos[1]); sign.rotation.y = -Math.PI / 2; }
    }
    group.add(sign);
  }

  createPedestal(group, slot, art, pedGeo, pedMat, plaqueGeo, plaqueCache, modelQueue) {
    const pedGroup = new THREE.Group();
    pedGroup.position.set(slot.x, 0, slot.z);
    pedGroup.rotation.y = slot.yaw;
    pedGroup.userData = { art };

    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = 0.55;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    pedGroup.add(pedestal);

    const key = art.id || art.title || Math.random().toString(36);
    if (!plaqueCache.has(key)) {
      const tex = new THREE.CanvasTexture(makePlaqueCanvas(art));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(4, this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 4);
      plaqueCache.set(key, tex);
    }
    const plaque = new THREE.Mesh(
      plaqueGeo,
      new THREE.MeshBasicMaterial({ map: plaqueCache.get(key) })
    );
    plaque.position.set(0, 0.65, 0.61);
    pedGroup.add(plaque);

    modelQueue.push({ group: pedGroup, art });
    group.add(pedGroup);
  }

  /* Resolves true on success, false on failure/timeout */
  loadModel(group, art) {
    const gen = this._generation;
    return new Promise(resolve => {
      const loader = new GLTFLoader();
      const url = art.modelUrl || 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';

      loader.load(url, gltf => {
        if (this._generation !== gen) { resolve(false); return; }
        try {
          const model = gltf.scene;
          model.updateMatrixWorld(true);

          const box1 = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3(); box1.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) model.scale.setScalar(1.0 / maxDim);

          const box2 = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3(); box2.getCenter(center);
          model.position.set(-center.x, 1.1 - box2.min.y, -center.z);

          model.traverse(n => { if (n.isMesh) n.castShadow = true; });
          group.add(model);
          resolve(true);
        } catch (e) {
          console.error('[gallery] post-process failed:', e);
          resolve(false);
        }
      }, undefined, () => resolve(false));
    });
  }

  /* --------------------------------------------------------
     Class-jump pathfinding
     -------------------------------------------------------- */
  computePath(fromIdx, toIdx) {
    const entries = this.plan.entries;
    if (fromIdx === toIdx) return [this.playerPos];

    const entranceOf = e => worldOf(e.P, e.yaw, [0, e.D / 2]);
    const exitOf = e => worldOf(e.P, e.yaw, e.exit.pos);
    const pts = [this.playerPos.slice()];

    if (fromIdx < toIdx) {
      pts.push(exitOf(entries[fromIdx]));
      for (let k = fromIdx; k < toIdx; k++) {
        pts.push(entranceOf(entries[k + 1]));
        if (k + 1 < toIdx) pts.push(exitOf(entries[k + 1]));
      }
      pts.push([entries[toIdx].P[0], entries[toIdx].P[1]]);
    } else {
      pts.push(entranceOf(entries[fromIdx]));
      for (let k = fromIdx - 1; k >= toIdx; k--) {
        pts.push(exitOf(entries[k]));
        if (k > toIdx) pts.push(entranceOf(entries[k]));
      }
      pts.push([entries[toIdx].P[0], entries[toIdx].P[1]]);
    }
    return pts;
  }

  get currentEntryIdx() {
    for (let i = 0; i < this.plan.entries.length; i++) {
      const e = this.plan.entries[i];
      const hw = e.W / 2, hd = e.D / 2;
      const dx = this.playerPos[0] - e.P[0], dz = this.playerPos[1] - e.P[1];
      const c = Math.cos(-e.yaw), s = Math.sin(-e.yaw);
      const lx = dx * c + dz * s, lz = -dx * s + dz * c;
      if (Math.abs(lx) <= hw + 1 && Math.abs(lz) <= hd + 1) return i;
    }
    return -1;
  }

  jumpToClass(classIndex) {
    if (this.isTransitioning) return;
    const targetIdx = this.plan.entries.findIndex(e => e.role === 'main' && e.ci === classIndex);
    if (targetIdx < 0) return;

    const fromIdx = this.currentEntryIdx;
    const waypoints = fromIdx >= 0 ? this.computePath(fromIdx, targetIdx)
      : [[this.playerPos[0], this.playerPos[1]],
         [this.plan.entries[targetIdx].P[0], this.plan.entries[targetIdx].P[1]]];
    if (waypoints.length < 2) return;

    const segLens = [];
    let totalLen = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const len = Math.hypot(waypoints[i][0] - waypoints[i - 1][0], waypoints[i][1] - waypoints[i - 1][1]);
      segLens.push(len); totalLen += len;
    }

    const startYaw = this.playerYaw;
    const targetYaw = this.plan.entries[targetIdx].yaw + Math.PI;
    let dYaw = targetYaw - startYaw;
    while (dYaw > Math.PI) dYaw -= 2 * Math.PI;
    while (dYaw < -Math.PI) dYaw += 2 * Math.PI;

    this.isTransitioning = true;
    this.keys.clear();
    this.joystick.dx = this.joystick.dy = 0;

    const duration = Math.min(3500, Math.max(900, totalLen * 45));
    const t0 = performance.now();

    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / duration);
      const eased = t * t * (3 - 2 * t);
      const targetDist = eased * totalLen;
      let acc = 0, segIdx = segLens.length - 1;
      for (let i = 0; i < segLens.length; i++) {
        if (acc + segLens[i] >= targetDist) { segIdx = i; break; }
        acc += segLens[i];
      }
      const segT = segLens[segIdx] > 0 ? (targetDist - acc) / segLens[segIdx] : 0;
      const p0 = waypoints[segIdx], p1 = waypoints[segIdx + 1] || p0;
      this.playerPos = [p0[0] + (p1[0] - p0[0]) * segT, p0[1] + (p1[1] - p0[1]) * segT];
      this.playerYaw = startYaw + dYaw * eased;
      if (t < 1) requestAnimationFrame(step);
      else this.isTransitioning = false;
    };
    requestAnimationFrame(step);
  }

  /* --------------------------------------------------------
     Seamless pre/post teleport
     -------------------------------------------------------- */
  checkLoopTeleport() {
    const entries = this.plan.entries;
    if (!entries.length) return;
    const pre  = entries.find(e => e.role === 'pre');
    const post = entries.find(e => e.role === 'post');
    if (!pre || !post) return;

    const inside = e => {
      const hw = e.W / 2, hd = e.D / 2;
      const dx = this.playerPos[0] - e.P[0], dz = this.playerPos[1] - e.P[1];
      const c = Math.cos(-e.yaw), s = Math.sin(-e.yaw);
      const lx = dx * c + dz * s, lz = -dx * s + dz * c;
      return Math.abs(lx) <= hw - 0.3 && Math.abs(lz) <= hd - 0.3;
    };

    if (inside(pre)) {
      const lastMain = entries.find(e => e.role === 'main' && e.ci === this.classes.length - 1);
      if (lastMain) this.teleportBetween(pre, lastMain);
    } else if (inside(post)) {
      const firstMain = entries.find(e => e.role === 'main' && e.ci === 0);
      if (firstMain) this.teleportBetween(post, firstMain);
    }
  }

  teleportBetween(fromE, toE) {
    const local = rot([this.playerPos[0] - fromE.P[0], this.playerPos[1] - fromE.P[1]], -fromE.yaw);
    const w = rot(local, toE.yaw);
    this.playerPos = [toE.P[0] + w[0], toE.P[1] + w[1]];
    this.playerYaw += (toE.yaw - fromE.yaw);
  }

  /* --------------------------------------------------------
     Controls
     -------------------------------------------------------- */
  setupControls() {
    this._controller = new AbortController();
    const signal = this._controller.signal;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (moveKeys.includes(k)) { this.keys.add(k); e.preventDefault(); }
    }, { signal });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()), { signal });

    this.container.addEventListener('mousedown', e => {
      if (this.isTransitioning) return;
      this.isDragging = true; this.dragDistance = 0;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }, { signal });
    window.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMousePosition.x;
      this.dragDistance += Math.abs(dx);
      this.playerYaw -= dx * 0.005;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }, { signal });
    window.addEventListener('mouseup', () => setTimeout(() => { this.isDragging = false; }, 0), { signal });

    this.container.addEventListener('touchstart', e => {
      if (this.isTransitioning || e.touches.length !== 1) return;
      this.isDragging = true; this.dragDistance = 0;
      this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { signal, passive: true });
    window.addEventListener('touchmove', e => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.previousMousePosition.x;
      this.dragDistance += Math.abs(dx);
      this.playerYaw -= dx * 0.005;
      this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { signal, passive: true });
    const endTouch = () => setTimeout(() => { this.isDragging = false; }, 0);
    window.addEventListener('touchend', endTouch, { signal });
    window.addEventListener('touchcancel', endTouch, { signal });

    this.container.addEventListener('click', e => {
      if (this.dragDistance > 6 || this.isTransitioning) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.scene.children, true);
      for (const hit of hits) {
        let node = hit.object;
        while (node) {
          if (node.userData && node.userData.art) {
            if (this.onSelectArtwork) this.onSelectArtwork(node.userData.art);
            return;
          }
          node = node.parent;
        }
        break;
      }
    }, { signal });
  }

  setupJoystick() {
    const joy = document.getElementById('joystick');
    const knob = joy && joy.querySelector('.joystick-knob');
    if (!joy || !knob) return;

    this._controller = this._controller || new AbortController();
    const signal = this._controller.signal;
    const maxR = 42;

    const update = e => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > maxR) { dx = dx / d * maxR; dy = dy / d * maxR; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joystick.dx = dx / maxR;
      this.joystick.dy = dy / maxR;
    };

    joy.addEventListener('pointerdown', e => {
      if (this.isTransitioning) return;
      e.preventDefault(); e.stopPropagation();
      this.joystick.active = true;
      joy.setPointerCapture(e.pointerId);
      update(e);
    }, { signal });
    joy.addEventListener('pointermove', e => {
      if (!this.joystick.active) return;
      e.preventDefault(); update(e);
    }, { signal });
    const end = () => {
      this.joystick.active = false;
      this.joystick.dx = this.joystick.dy = 0;
      knob.style.transform = 'translate(0, 0)';
    };
    joy.addEventListener('pointerup', end, { signal });
    joy.addEventListener('pointercancel', end, { signal });
  }

  /* --------------------------------------------------------
     Loop
     -------------------------------------------------------- */
  onWindowResize() {
    if (!this.renderer || !this.camera || !this.container) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  canWalk(x, z) {
    for (const r of this.walkRects) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
    return false;
  }

  animate() {
    if (!this._running || !this.renderer) return;
    requestAnimationFrame(() => this.animate());

    const sinY = Math.sin(this.playerYaw), cosY = Math.cos(this.playerYaw);
    const fwd = [-sinY, -cosY];
    const right = [cosY, -sinY];
    let mx = 0, mz = 0;

    if (!this.isTransitioning) {
      if (this.keys.has('w') || this.keys.has('arrowup'))    { mx += fwd[0];   mz += fwd[1]; }
      if (this.keys.has('s') || this.keys.has('arrowdown'))  { mx -= fwd[0];   mz -= fwd[1]; }
      if (this.keys.has('a') || this.keys.has('arrowleft'))  { mx -= right[0]; mz -= right[1]; }
      if (this.keys.has('d') || this.keys.has('arrowright')) { mx += right[0]; mz += right[1]; }
      if (this.joystick.dx || this.joystick.dy) {
        const jx = this.joystick.dx, jy = -this.joystick.dy;
        mx += fwd[0] * jy + right[0] * jx;
        mz += fwd[1] * jy + right[1] * jx;
      }
      if (mx || mz) {
        const len = Math.hypot(mx, mz);
        const speed = 0.08;
        const nx = this.playerPos[0] + (mx / len) * speed;
        const nz = this.playerPos[1] + (mz / len) * speed;
        if (this.canWalk(nx, nz)) this.playerPos = [nx, nz];
        else if (this.canWalk(nx, this.playerPos[1])) this.playerPos = [nx, this.playerPos[1]];
        else if (this.canWalk(this.playerPos[0], nz)) this.playerPos = [this.playerPos[0], nz];
        this.checkLoopTeleport();
      }
    }

    this.camera.position.set(this.playerPos[0], 1.7, this.playerPos[1]);
    this.camera.lookAt(
      this.camera.position.x + fwd[0],
      this.camera.position.y,
      this.camera.position.z + fwd[1]
    );

    this.renderer.render(this.scene, this.camera);
  }

  pause() { this._running = false; }
  resume() { if (this._running) return; this._running = true; this.animate(); }

  dispose() {
    this._generation++;
    this._running = false;
    if (this._controller) { this._controller.abort(); this._controller = null; }
    this._blobUrls.forEach(u => URL.revokeObjectURL(u));
    this._blobUrls = [];

    if (this.scene) {
      this.scene.traverse(o => {
        if (o.isMesh) {
          if (o.geometry) o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (!m) return;
            if (m.map) {
              m.map.dispose();
              m.map = null;
            }
            m.dispose();
          });
        }
      });
    }
    if (this.renderer) {
      this.renderer.dispose();
      const c = this.renderer.domElement;
      if (c && c.parentNode) c.parentNode.removeChild(c);
    }
    this.scene = this.camera = this.renderer = null;
  }
}