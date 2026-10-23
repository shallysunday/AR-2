/* ==========================================================
   gallery.js — Procedural architectural museum walkthrough.

   Reads artworks from app.js (window.arArchive.loadAll) which
   works in both cloud + local mode. Renders one white room per
   classCode with doorways, class signs over every door, a
   pedestal + info plaque per artwork, first-person walking,
   a touch joystick, and a smooth waypoint-based class-jump
   flight that follows the corridors instead of cutting through
   walls. Also handles the pre/post seamless-loop teleport.
   ========================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  bestPlan, walkRects, artSlots, groupByClass,
  worldOf, rot, DOOR_W, WALL_T, CORR_L
} from './gallery-layout.js';

/* ----------------------------------------------------------
   Canvas texture helpers
   ---------------------------------------------------------- */
function makeSignCanvas(classCode, className, isEntrance) {
  const W = 512, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Dark plate — pops against white walls
  ctx.fillStyle = '#1b1b1a';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // Terracotta arrow
  ctx.fillStyle = '#c8553d';
  ctx.font = 'bold 56px -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = isEntrance ? 'left' : 'right';
  ctx.fillText('→', isEntrance ? 24 : W - 24, H / 2 + 2);

  // Main label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  const label = `${classCode}  ·  ${className.toUpperCase()}`;
  ctx.fillText(label, W / 2, H / 2 + 2);

  return c;
}

function makePlaqueCanvas(item) {
  const W = 384, H = 256
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Card
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#e7e5df';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Class code
  ctx.fillStyle = '#c8553d';
  ctx.font = 'bold 18px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText((item.classCode || '').toUpperCase(), 28, 46);

  // Title (may wrap 2 lines)
  ctx.fillStyle = '#1b1b1a';
  ctx.font = 'bold 34px Georgia, serif';
  const titleLines = wrapText(ctx, item.title || 'Untitled', W - 56, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, 28, 92 + i * 40));

  let y = 92 + titleLines.length * 40;

  // Student + lecturer
  ctx.fillStyle = '#1b1b1a';
  ctx.font = 'bold 20px -apple-system, sans-serif';
  ctx.fillText(item.student || '', 28, y + 14);
  y += 34;
  ctx.fillStyle = '#5d5d58';
  ctx.font = '16px -apple-system, sans-serif';
  ctx.fillText(item.lecturer || '', 28, y + 10);
  y += 30;

  // Divider
  ctx.strokeStyle = '#e7e5df';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(28, y);
  ctx.lineTo(W - 28, y);
  ctx.stroke();
  y += 16;

  // Description (2 lines max)
  ctx.fillStyle = '#5d5d58';
  ctx.font = '15px -apple-system, sans-serif';
  const descLines = wrapText(ctx, item.description || '', W - 56, 2);
  descLines.forEach((line, i) => ctx.fillText(line, 28, y + i * 20));

  // CTA band
  ctx.fillStyle = '#1b1b1a';
  ctx.fillRect(0, H - 56, W, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TAP TO OPEN IN AR VIEWER  →', W / 2, H - 22);

  return c;
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.map((l, i) => {
    if (i === maxLines - 1 && lines.length === maxLines) {
      // Add ellipsis if there's more text than fits
      const rem = words.slice(words.indexOf(l.split(' ').pop()) + 1);
      if (rem.length) return l.replace(/\s*\S*$/, '') + '…';
    }
    return l;
  });
}

/* ----------------------------------------------------------
   Main class
   ---------------------------------------------------------- */
export class ArchitecturalGallery {
  constructor(containerEl, onSelectArtwork) {
    this.container = containerEl;
    this.onSelectArtwork = onSelectArtwork || null;
    this.onReady = null;

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
  }

  async init() {
    /* Scene */
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f4f6);
    this.scene.fog = new THREE.FogExp2(0xf4f4f6, 0.008);

    /* Camera */
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1, 1000
    );

    /* Renderer — ACES tone mapping for the "physical model" look */
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    /* Lighting — soft studio */
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcccccc, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const key = new THREE.DirectionalLight(0xfff6e8, 1.35);
    key.position.set(24, 40, 22);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.camera.left = -60;
    key.shadow.camera.right = 60;
    key.shadow.camera.top = 60;
    key.shadow.camera.bottom = -60;
    key.shadow.camera.far = 200;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.25);
    fill.position.set(-30, 20, -20);
    this.scene.add(fill);

    /* Build */
    try {
      await this.loadDataAndBuild();
    } catch (e) {
      console.error('3D gallery build failed', e);
    }

    /* Events + loop */
    window.addEventListener('resize', () => this.onWindowResize());
    this.setupControls();
    this.setupJoystick();
    this.animate();

    try {
      await this.loadDataAndBuild();
    } catch (e) {
      console.error('3D gallery build failed', e);
      // ★ NEW: always fire onReady so the overlay hides
      if (this.onError) this.onError(e);
      if (this.onReady) this.onReady(e);
    }

    window.addEventListener('resize', () => this.onWindowResize());
    this.setupControls();
    this.setupJoystick();
    this.animate();
  }

  /* --------------------------------------------------------
     Data
     -------------------------------------------------------- */
  async loadItems() {
    const loadPromise = (async () => {
      if (window.arArchive && typeof window.arArchive.loadAll === 'function') {
        const items = await window.arArchive.loadAll();

        // ★ CHANGED: parallel IndexedDB lookups instead of one-by-one
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
            } catch (e) {
              console.warn('Could not load model blob for', it.id, e);
            }
          }));
        }
        return items;
      }
      // Fallback: localStorage
      try {
        const raw = localStorage.getItem('arArchive.items.v1');
        if (raw) return JSON.parse(raw);
      } catch { /* ignore */ }
      return [];
    })();

    const timeoutPromise = new Promise(res => setTimeout(() => res(null), 6000));
    const items = await Promise.race([loadPromise, timeoutPromise]);

    if (items === null) {
      console.warn('Archive load timed out — using samples only');
    }

    const finalItems = items || [];
    if (finalItems.length === 0) {
      return [
        { title: 'Astronaut Study', student: 'Alya Putri', lecturer: 'Dr. Budi Santoso',
          className: 'Typography II', classCode: 'DK202',
          modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb' },
        { title: 'Expressive Robot', student: 'Rizky Pratama', lecturer: 'Maya Anggraini',
          className: 'Character Design I', classCode: 'DK115',
          modelUrl: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb' }
      ];
    }
    return finalItems;
  }

  async loadDataAndBuild() {
    const items = await this.loadItems();
    this.classes = groupByClass(items);

    if (this.classes.length === 0) {
      this.plan = { entries: [], corridors: [] };
      this.walkRects = [];
      if (this.onReady) this.onReady();
      return;
    }

    this.plan = bestPlan(this.classes.map(c => c.items.length));
    this.walkRects = walkRects(this.plan);
    this.buildMuseumGeometry();

    // Place the player at the entrance of R0
    const r0 = this.plan.entries.find(e => e.role === 'main' && e.ci === 0);
    if (r0) {
      this.playerPos = [r0.P[0], r0.P[1] + r0.D / 2 - 2.5];
      this.playerYaw = r0.yaw + Math.PI;   // face into the room
    }

    if (this.onReady) this.onReady();
  }

  /* --------------------------------------------------------
     Geometry
     -------------------------------------------------------- */
  buildMuseumGeometry() {
    const wallMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, metalness: 0.0 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.95 });
    const ceilMat  = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 1.0 });
    const H = 5.0;

    // ★ NEW: texture caches — signTextures are shared between pre/post copies of the same class
    const signTextures = new Map();      // `${code}-${isEntrance}`
    const plaqueTextures = new Map();    // item.id
    const getSignTex = (code, name, isEntrance) => {
      const key = `${code}-${isEntrance ? 'in' : 'out'}`;
      if (!signTextures.has(key)) {
        const tex = new THREE.CanvasTexture(makeSignCanvas(code, name, isEntrance));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 2;
        signTextures.set(key, tex);
      }
      return signTextures.get(key);
    };
    const getPlaqueTex = item => {
      const key = item.id || item.title || Math.random();
      if (!plaqueTextures.has(key)) {
        const tex = new THREE.CanvasTexture(makePlaqueCanvas(item));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 2;
        plaqueTextures.set(key, tex);
      }
      return plaqueTextures.get(key);
    };

    this.plan.entries.forEach(entry => {
      const { W, D, P, yaw } = entry;
      const room = new THREE.Group();
      room.position.set(P[0], 0, P[1]);
      room.rotation.y = yaw;

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      room.add(floor);

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = H;
      room.add(ceiling);

      this.buildWallsWithOpenings(room, entry, H, wallMat);

      const cls = this.classes[entry.ci];
      if (cls) {
        this.createDoorSign(room, entry, H, cls.code, cls.name, true, getSignTex);
        this.createDoorSign(room, entry, H, cls.code, cls.name, false, getSignTex);

        const slots = artSlots(entry, cls.items.length);
        cls.items.forEach((art, i) => {
          const slot = slots[i];
          if (!slot) return;
          try {
            this.createPedestalAndArtwork(room, slot, art, getPlaqueTex);
          } catch (err) {
            // ★ NEW: one bad artwork never kills the whole build
            console.error('Pedestal for', art && art.title, 'failed:', err);
          }
        });
      }

      this.scene.add(room);
    });
  }

  /* Walls with doorway holes + thin architectural door frames */
  buildWallsWithOpenings(group, entry, H, mat) {
    const { W, D, exit } = entry;
    const halfW = W / 2, halfD = D / 2;
    const t = WALL_T;
    const doorH = 3.0;
    const doorW = DOOR_W;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0xc9c5bb, roughness: 0.9 });
    const frameT = 0.12;
    const frameDepth = t + 0.08;

    /* A segment of plain wall */
    const addWallSeg = (x0, z0, x1, z1) => {
      const horizontal = Math.abs(z1 - z0) < 1e-4;
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1e-3) return;
      const geo = horizontal
        ? new THREE.BoxGeometry(len, H, t)
        : new THREE.BoxGeometry(t, H, len);
      const m = new THREE.Mesh(geo, mat);
      m.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    };

    /* Wall with a door hole + frame */
    const addWallWithDoor = (x0, z0, x1, z1, doorFrac) => {
      const total = Math.hypot(x1 - x0, z1 - z0);
      const dh = (doorW / 2) / total;
      const aF = Math.max(0, doorFrac - dh);
      const bF = Math.min(1, doorFrac + dh);

      addWallSeg(x0, z0, x0 + (x1 - x0) * aF, z0 + (z1 - z0) * aF);
      addWallSeg(x0 + (x1 - x0) * bF, z0 + (z1 - z0) * bF, x1, z1);

      // Lintel above the doorway
      const cx = x0 + (x1 - x0) * doorFrac;
      const cz = z0 + (z1 - z0) * doorFrac;
      const horizontal = Math.abs(z1 - z0) < 1e-4;
      const lintelGeo = horizontal
        ? new THREE.BoxGeometry(doorW, H - doorH, t)
        : new THREE.BoxGeometry(t, H - doorH, doorW);
      const lintel = new THREE.Mesh(lintelGeo, mat);
      lintel.position.set(cx, doorH + (H - doorH) / 2, cz);
      lintel.castShadow = lintel.receiveShadow = true;
      group.add(lintel);

      // Thin frame: left post, right post, top bar
      const pA = [x0 + (x1 - x0) * aF, z0 + (z1 - z0) * aF];
      const pB = [x0 + (x1 - x0) * bF, z0 + (z1 - z0) * bF];
      const mkFrame = (px, pz, h, offAxis) => {
        const g = horizontal
          ? new THREE.BoxGeometry(frameT, h, frameDepth)
          : new THREE.BoxGeometry(frameDepth, h, frameT);
        const m = new THREE.Mesh(g, frameMat);
        m.position.set(px + (offAxis ? 0 : 0), h / 2, pz);
        m.castShadow = m.receiveShadow = true;
        group.add(m);
      };
      mkFrame(pA[0], pA[1], doorH);
      mkFrame(pB[0], pB[1], doorH);

      // Top frame bar
      const topBar = new THREE.Mesh(
        horizontal
          ? new THREE.BoxGeometry(doorW + frameT * 2, frameT, frameDepth)
          : new THREE.BoxGeometry(frameDepth, frameT, doorW + frameT * 2),
        frameMat
      );
      topBar.position.set(cx, doorH, cz);
      topBar.castShadow = topBar.receiveShadow = true;
      group.add(topBar);
    };

    // South wall — always has the entrance door (centred)
    addWallWithDoor(-halfW, halfD, halfW, halfD, 0.5);

    // Exit wall
    if (exit.side === 'N') {
      addWallWithDoor(-halfW, -halfD, halfW, -halfD, 0.5 + exit.pos[0] / W);
    } else if (exit.side === 'W') {
      addWallWithDoor(-halfW, -halfD, -halfW, halfD, 0.5 + exit.pos[1] / D);
    } else {
      addWallWithDoor(halfW, -halfD, halfW, halfD, 0.5 + exit.pos[1] / D);
    }

    // Solid remaining walls
    if (exit.side !== 'N') addWallSeg(-halfW, -halfD, halfW, -halfD);
    if (exit.side !== 'W') addWallSeg(-halfW, -halfD, -halfW, halfD);
    if (exit.side !== 'E') addWallSeg(halfW, -halfD, halfW, halfD);
  }

  /* Floating sign box over an entrance or exit door */
  createDoorSign(group, entry, H, classCode, className, isEntrance, getSignTex) {
    const tex = getSignTex ? getSignTex(classCode, className, isEntrance)
                           : (() => {
                               const t = new THREE.CanvasTexture(makeSignCanvas(classCode, className, isEntrance));
                               t.colorSpace = THREE.SRGBColorSpace;
                               return t;
                             })();
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.05), mat);

    const y = 3.65;
    if (isEntrance) {
      box.position.set(0, y, entry.D / 2 - 0.12);
      box.rotation.y = Math.PI;
    } else {
      const ex = entry.exit;
      if (ex.side === 'N') { box.position.set(ex.pos[0], y, -entry.D / 2 + 0.12); box.rotation.y = 0; }
      else if (ex.side === 'W') { box.position.set(-entry.W / 2 + 0.12, y, ex.pos[1]); box.rotation.y = Math.PI / 2; }
      else { box.position.set(entry.W / 2 - 0.12, y, ex.pos[1]); box.rotation.y = -Math.PI / 2; }
    }
    group.add(box);
  }

  /* Pedestal + artwork + info plaque, all clickable as one group */
  createPedestalAndArtwork(group, slot, art, getPlaqueTex) {
    const pedGroup = new THREE.Group();
    pedGroup.position.set(slot.x, 0, slot.z);
    pedGroup.rotation.y = slot.yaw;
    pedGroup.userData = { art };

    const pedMat = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 0.8 });
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.2), pedMat);
    pedestal.position.y = 0.55;
    pedestal.castShadow = pedestal.receiveShadow = true;
    pedGroup.add(pedestal);

    // ★ CHANGED: reuse cached plaque texture
    const plaqueTex = getPlaqueTex
      ? getPlaqueTex(art)
      : (() => { const t = new THREE.CanvasTexture(makePlaqueCanvas(art)); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.72, 0.04),
      new THREE.MeshBasicMaterial({ map: plaqueTex })
    );
    plaque.position.set(0, 0.65, 0.63);
    pedGroup.add(plaque);

    const loader = new GLTFLoader();
    const url = art.modelUrl || 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';
    loader.load(url, gltf => {
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
      pedGroup.add(model);
    }, undefined, err => {
      console.error('GLB failed', art.title, err);
      const fallback = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x1b1b1a })
      );
      fallback.position.y = 1.5;
      pedGroup.add(fallback);
    });

    group.add(pedGroup);
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
      const dx = this.playerPos[0] - e.P[0];
      const dz = this.playerPos[1] - e.P[1];
      const c = Math.cos(-e.yaw), s = Math.sin(-e.yaw);
      const lx = dx * c + dz * s;
      const lz = -dx * s + dz * c;
      if (Math.abs(lx) <= hw + 1 && Math.abs(lz) <= hd + 1) return i;
    }
    return -1;
  }

  /* --------------------------------------------------------
     Smooth waypoint flight (used by the class-jump dropdown)
     -------------------------------------------------------- */
  jumpToClass(classIndex) {
    if (this.isTransitioning) return;
    const targetIdx = this.plan.entries.findIndex(
      e => e.role === 'main' && e.ci === classIndex
    );
    if (targetIdx < 0) return;

    const fromIdx = this.currentEntryIdx;
    const waypoints = fromIdx >= 0
      ? this.computePath(fromIdx, targetIdx)
      : [[this.playerPos[0], this.playerPos[1]],
         [this.plan.entries[targetIdx].P[0], this.plan.entries[targetIdx].P[1]]];

    if (waypoints.length < 2) return;

    /* Segment lengths for arc-length parametrisation */
    const segLens = [];
    let totalLen = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i][0] - waypoints[i - 1][0];
      const dz = waypoints[i][1] - waypoints[i - 1][1];
      const len = Math.hypot(dx, dz);
      segLens.push(len);
      totalLen += len;
    }

    const startYaw = this.playerYaw;
    const targetYaw = this.plan.entries[targetIdx].yaw + Math.PI;
    let dYaw = targetYaw - startYaw;
    while (dYaw >  Math.PI) dYaw -= 2 * Math.PI;
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
      const p0 = waypoints[segIdx];
      const p1 = waypoints[segIdx + 1] || p0;
      const px = p0[0] + (p1[0] - p0[0]) * segT;
      const pz = p0[1] + (p1[1] - p0[1]) * segT;

      this.playerPos = [px, pz];
      this.playerYaw = startYaw + dYaw * eased;

      if (t < 1) requestAnimationFrame(step);
      else this.isTransitioning = false;
    };
    requestAnimationFrame(step);
  }

  /* --------------------------------------------------------
     Seamless pre/post loop
     -------------------------------------------------------- */
  checkLoopTeleport() {
    const entries = this.plan.entries;
    if (!entries.length) return;
    const pre  = entries.find(e => e.role === 'pre');
    const post = entries.find(e => e.role === 'post');
    if (!pre || !post) return;

    const inside = e => {
      const hw = e.W / 2, hd = e.D / 2;
      const dx = this.playerPos[0] - e.P[0];
      const dz = this.playerPos[1] - e.P[1];
      const c = Math.cos(-e.yaw), s = Math.sin(-e.yaw);
      const lx = dx * c + dz * s;
      const lz = -dx * s + dz * c;
      return Math.abs(lx) <= hw - 0.3 && Math.abs(lz) <= hd - 0.3;
    };

    if (inside(pre)) {
      const lastMain = entries.find(
        e => e.role === 'main' && e.ci === this.classes.length - 1
      );
      if (lastMain) this.teleportBetween(pre, lastMain);
    } else if (inside(post)) {
      const firstMain = entries.find(e => e.role === 'main' && e.ci === 0);
      if (firstMain) this.teleportBetween(post, firstMain);
    }
  }

  teleportBetween(fromE, toE) {
    const local = rot(
      [this.playerPos[0] - fromE.P[0], this.playerPos[1] - fromE.P[1]],
      -fromE.yaw
    );
    const w = rot(local, toE.yaw);
    this.playerPos = [toE.P[0] + w[0], toE.P[1] + w[1]];
    this.playerYaw = this.playerYaw + (toE.yaw - fromE.yaw);
  }

  /* --------------------------------------------------------
     Controls
     -------------------------------------------------------- */
  setupControls() {
    this._controller = new AbortController();
    const signal = this._controller.signal;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    /* Keyboard */
    const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (moveKeys.includes(k)) { this.keys.add(k); e.preventDefault(); }
    }, { signal });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.key.toLowerCase());
    }, { signal });

    /* Mouse look */
    this.container.addEventListener('mousedown', e => {
      if (this.isTransitioning) return;
      this.isDragging = true;
      this.dragDistance = 0;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }, { signal });
    window.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMousePosition.x;
      this.dragDistance += Math.abs(dx);
      this.playerYaw -= dx * 0.005;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }, { signal });
    window.addEventListener('mouseup', () => {
      setTimeout(() => { this.isDragging = false; }, 0);
    }, { signal });

    /* Touch look */
    this.container.addEventListener('touchstart', e => {
      if (this.isTransitioning || e.touches.length !== 1) return;
      this.isDragging = true;
      this.dragDistance = 0;
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

    /* Click = raycast against pedestal groups */
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
        break;   // only inspect the closest hit
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
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
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
      e.preventDefault();
      update(e);
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
     Resize + loop
     -------------------------------------------------------- */
  onWindowResize() {
    if (!this.renderer || !this.camera || !this.container) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  canWalk(x, z) {
    for (const r of this.walkRects) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
    }
    return false;
  }

  animate() {
    if (!this._running || !this.renderer) return;
    requestAnimationFrame(() => this.animate());

    /* Movement input */
    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);
    const fwd = [-sinY, -cosY];
    const right = [cosY, -sinY];
    let mx = 0, mz = 0;

    if (!this.isTransitioning) {
      if (this.keys.has('w') || this.keys.has('arrowup'))    { mx += fwd[0];   mz += fwd[1]; }
      if (this.keys.has('s') || this.keys.has('arrowdown'))  { mx -= fwd[0];   mz -= fwd[1]; }
      if (this.keys.has('a') || this.keys.has('arrowleft'))  { mx -= right[0]; mz -= right[1]; }
      if (this.keys.has('d') || this.keys.has('arrowright')) { mx += right[0]; mz += right[1]; }

      /* Joystick: up = forward */
      if (this.joystick.dx || this.joystick.dy) {
        const jx = this.joystick.dx;
        const jy = -this.joystick.dy;
        mx += fwd[0] * jy + right[0] * jx;
        mz += fwd[1] * jy + right[1] * jx;
      }

      if (mx || mz) {
        const len = Math.hypot(mx, mz);
        const speed = 0.08;
        const nx = this.playerPos[0] + (mx / len) * speed;
        const nz = this.playerPos[1] + (mz / len) * speed;
        if (this.canWalk(nx, nz)) {
          this.playerPos = [nx, nz];
        } else if (this.canWalk(nx, this.playerPos[1])) {
          this.playerPos = [nx, this.playerPos[1]];
        } else if (this.canWalk(this.playerPos[0], nz)) {
          this.playerPos = [this.playerPos[0], nz];
        }
        this.checkLoopTeleport();
      }
    }

    /* Camera */
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
            if (m.map) m.map.dispose();
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