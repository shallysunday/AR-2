/* ==========================================================
   gallery.js — Three.js renderer for the procedural museum.
   ========================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bestPlan, walkRects, artSlots, groupByClass, DOOR_W, WALL_T, CORR_L } from './gallery-layout.js';

export class ArchitecturalGallery {
  constructor(containerEl, onSelectArtwork) {
    this.container = containerEl;
    this.onSelectArtwork = onSelectArtwork || null;
    this.onReady = null;                       // ★ NEW: fires once the world is built

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.classes = [];
    this.plan = null;
    this.walkRects = [];

    // Player / Camera State
    this.playerPos = [0, 0];
    this.playerYaw = 0;

    // Controls state
    this.isDragging = false;
    this.dragDistance = 0;
    this.previousMousePosition = { x: 0, y: 0 };
    this.keys = new Set();
    this.raycaster = null;
    this.pointer = null;

    this._running = true;
    this._controller = null;
    this._blobUrls = [];

    this.init();
  }

  async init() {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f4f6);
    this.scene.fog = new THREE.FogExp2(0xf4f4f6, 0.015);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1, 1000
    );

    // 3. Renderer setup with soft shadows
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // 5. Load data & build
    try {
      await this.loadDataAndBuild();
    } catch (e) {
      console.error('3D gallery build failed', e);
    }

    // 6. Events + loop
    window.addEventListener('resize', () => this.onWindowResize());
    this.setupControls();
    this.animate();
  }

  /* ---------- Data loading ---------- */
  async loadItems() {
    // Prefer the shared loader from app.js (works in both cloud + local mode)
    if (window.arArchive && typeof window.arArchive.loadAll === 'function') {
      try {
        const items = await window.arArchive.loadAll();

        // Local uploads have no modelUrl; pull the blob from IndexedDB
        for (const item of items) {
          if (!item.modelUrl && window.arArchive.getModel) {
            try {
              const blob = await window.arArchive.getModel(item.id);
              if (blob) {
                const url = URL.createObjectURL(blob);
                this._blobUrls.push(url);
                item.modelUrl = url;
              }
            } catch (e) {
              console.warn('Could not load model blob for', item.id, e);
            }
          }
        }
        return items;
      } catch (e) {
        console.error('arArchive.loadAll failed', e);
      }
    }

    // Fallback: localStorage only (local mode without app.js hooks)
    let items = [];
    try {
      const raw = localStorage.getItem('arArchive.items.v1');
      if (raw) items = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    if (items.length === 0) {
      items = [
        {
          title: 'Astronaut Study',
          student: 'Alya Putri',
          lecturer: 'Dr. Budi Santoso',
          className: 'Typography II',
          classCode: 'DK202',
          modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
        },
        {
          title: 'Expressive Robot',
          student: 'Rizky Pratama',
          lecturer: 'Maya Anggraini',
          className: 'Character Design I',
          classCode: 'DK115',
          modelUrl: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb'
        }
      ];
    }
    return items;
  }

  async loadDataAndBuild() {
    const items = await this.loadItems();
    this.classes = groupByClass(items);
    this.plan = bestPlan(this.classes.map(c => c.items.length));
    this.walkRects = walkRects(this.plan);
    this.buildMuseumGeometry();
    if (typeof this.onReady === 'function') this.onReady();
  }

  /* ---------- Geometry ---------- */
  buildMuseumGeometry() {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe5e5eb, roughness: 0.8 });
    const wallHeight = 5.0;

    this.plan.entries.forEach(e => {
      const { W, D, P, yaw } = e;
      const roomGroup = new THREE.Group();
      roomGroup.position.set(P[0], 0, P[1]);
      roomGroup.rotation.y = yaw;

      // Floor
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      roomGroup.add(floor);

      // Ceiling
      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), whiteMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = wallHeight;
      roomGroup.add(ceiling);

      // Walls (now with real doorway openings)
      this.buildWallsWithOpenings(roomGroup, e, wallHeight, whiteMat);

      // Class sign over entrance
      this.createRoomSign(roomGroup, W, D, wallHeight, this.classes[e.ci].name, this.classes[e.ci].code);

      // Pedestals + art
      const classData = this.classes[e.ci];
      const slots = artSlots(e, classData.items.length);
      classData.items.forEach((art, artIdx) => {
        const slot = slots[artIdx] || { x: 0, z: 0, yaw: 0 };
        this.createPedestalAndArtwork(roomGroup, slot, art);
      });

      this.scene.add(roomGroup);
    });
  }

  buildWallsWithOpenings(group, entry, H, mat) {
    const { W, D, exit } = entry;
    const halfW = W / 2, halfD = D / 2;
    const t = WALL_T;
    const doorH = 3.0;
    const doorW = DOOR_W;

    const addSeg = (x0, z0, x1, z1) => {
      const horizontal = Math.abs(z1 - z0) < 0.01;
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.01) return;
      const geo = horizontal
        ? new THREE.BoxGeometry(len, H, t)
        : new THREE.BoxGeometry(t, H, len);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    };

    const addWallWithDoor = (x0, z0, x1, z1, doorFrac) => {
      const total = Math.hypot(x1 - x0, z1 - z0);
      const dh = (doorW / 2) / total;

      const aFrac = Math.max(0, doorFrac - dh);
      const bFrac = Math.min(1, doorFrac + dh);

      addSeg(x0, z0, x0 + (x1 - x0) * aFrac, z0 + (z1 - z0) * aFrac);
      addSeg(x0 + (x1 - x0) * bFrac, z0 + (z1 - z0) * bFrac, x1, z1);

      // Lintel above the door
      const cx = x0 + (x1 - x0) * doorFrac;
      const cz = z0 + (z1 - z0) * doorFrac;
      const horizontal = Math.abs(z1 - z0) < 0.01;
      const geo = horizontal
        ? new THREE.BoxGeometry(doorW, H - doorH, t)
        : new THREE.BoxGeometry(t, H - doorH, doorW);
      const lintel = new THREE.Mesh(geo, mat);
      lintel.position.set(cx, doorH + (H - doorH) / 2, cz);
      lintel.castShadow = lintel.receiveShadow = true;
      group.add(lintel);
    };

    // South wall = entrance, always centred
    addWallWithDoor(-halfW, halfD, halfW, halfD, 0.5);

    // Exit wall
    if (exit.side === 'N') {
      addWallWithDoor(-halfW, -halfD, halfW, -halfD, 0.5 + exit.pos[0] / W);
    } else if (exit.side === 'W') {
      addWallWithDoor(-halfW, -halfD, -halfW, halfD, 0.5 + exit.pos[1] / D);
    } else {
      addWallWithDoor(halfW, -halfD, halfW, halfD, 0.5 + exit.pos[1] / D);
    }

    // Remaining walls solid
    if (exit.side !== 'N') addSeg(-halfW, -halfD, halfW, -halfD);
    if (exit.side !== 'W') addSeg(-halfW, -halfD, -halfW, halfD);
    if (exit.side !== 'E') addSeg(halfW, -halfD, halfW, halfD);
  }

  createRoomSign(group, W, D, H, className, classCode) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b1b1a';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${classCode}: ${className}`, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: texture });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), signMat);
    sign.position.set(0, H - 1.2, D / 2 - 0.04);
    group.add(sign);
  }

  createPedestalAndArtwork(group, slot, art) {
    const pedGroup = new THREE.Group();
    pedGroup.position.set(slot.x, 0, slot.z);
    pedGroup.rotation.y = slot.yaw;             // ★ NEW: face the room centre

    // Minimalist white pedestal block
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.1, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 })
    );
    pedestal.position.y = 0.55;
    pedestal.castShadow = pedestal.receiveShadow = true;
    pedGroup.add(pedestal);

    // Load 3D model
    const loader = new GLTFLoader();
    const url = art.modelUrl || 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';

    loader.load(url, gltf => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);

      // Normalise the model so it fits on the pedestal
      const box1 = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box1.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) model.scale.setScalar(1.0 / maxDim);

      // Sit it directly on top of the pedestal, centred
      const box2 = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      model.position.set(-center.x, 1.1 - box2.min.y, -center.z);

      model.traverse(n => { if (n.isMesh) n.castShadow = true; });
      pedGroup.add(model);
    }, undefined, err => {
      console.error('GLB failed', art.title, err);
      const fallback = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x1b1b1a })
      );
      fallback.position.y = 1.4;
      pedGroup.add(fallback);
    });

    pedGroup.userData = { art };
    group.add(pedGroup);
  }

  /* ---------- Navigation ---------- */
  jumpToClass(classIndex) {
    if (this.isTransitioning) return;
    const entry = this.plan.entries.find(e => e.ci === classIndex && e.role === 'main');
    if (!entry) return;

    this.isTransitioning = true;
    const startX = this.playerPos[0];
    const startZ = this.playerPos[1];
    const startYaw = this.playerYaw;
    const targetX = entry.P[0];
    const targetZ = entry.P[1];
    const targetYaw = entry.yaw;

    let dYaw = targetYaw - startYaw;
    while (dYaw > Math.PI) dYaw -= 2 * Math.PI;
    while (dYaw < -Math.PI) dYaw += 2 * Math.PI;

    const t0 = performance.now();
    const dur = 550;
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const k = t * t * (3 - 2 * t);
      this.playerPos[0] = startX + (targetX - startX) * k;
      this.playerPos[1] = startZ + (targetZ - startZ) * k;
      this.playerYaw    = startYaw + dYaw * k;
      if (t < 1) requestAnimationFrame(step);
      else this.isTransitioning = false;
    };
    requestAnimationFrame(step);
  }

  canWalk(x, z) {
    for (const r of this.walkRects) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
    }
    return false;
  }

  /* ---------- Controls ---------- */
  setupControls() {
    this._controller = new AbortController();
    const signal = this._controller.signal;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // Keyboard
    const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (moveKeys.includes(k)) {
        this.keys.add(k);
        e.preventDefault();
      }
    }, { signal });

    window.addEventListener('keyup', e => {
      this.keys.delete(e.key.toLowerCase());
    }, { signal });

    // Mouse look
    this.container.addEventListener('mousedown', e => {
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
      // Delay so the click handler still sees dragDistance > threshold
      setTimeout(() => { this.isDragging = false; }, 0);
    }, { signal });

    // Touch look (one finger)
    this.container.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
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

    window.addEventListener('touchend', () => {
      setTimeout(() => { this.isDragging = false; }, 0);
    }, { signal });

    window.addEventListener('touchcancel', () => {
      setTimeout(() => { this.isDragging = false; }, 0);
    }, { signal });

    // Click / tap = raycast against pedestals
    this.container.addEventListener('click', e => {
      if (this.dragDistance > 6) return;    // was a drag, not a click
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

  onWindowResize() {
    if (!this.renderer || !this.camera || !this.container) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));   // ★ NEW
  }

  /* ---------- Loop ---------- */
  animate() {
    if (!this._running || !this.camera || !this.renderer || !this.scene) return;
    requestAnimationFrame(() => this.animate());

    // Movement (WASD + arrows)
    const speed = 0.07;
    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);
    const fwd = [-sinY, -cosY];     // direction camera is facing
    const right = [cosY, -sinY];    // perpendicular

    let mx = 0, mz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup'))    { mx += fwd[0];   mz += fwd[1]; }
    if (this.keys.has('s') || this.keys.has('arrowdown'))  { mx -= fwd[0];   mz -= fwd[1]; }
    if (this.keys.has('a') || this.keys.has('arrowleft'))  { mx -= right[0]; mz -= right[1]; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { mx += right[0]; mz += right[1]; }

    if (mx || mz) {
      const len = Math.hypot(mx, mz);
      const nx = this.playerPos[0] + (mx / len) * speed;
      const nz = this.playerPos[1] + (mz / len) * speed;
      if (this.canWalk(nx, nz)) {
        this.playerPos[0] = nx; this.playerPos[1] = nz;
      } else if (this.canWalk(nx, this.playerPos[1])) {
        this.playerPos[0] = nx;
      } else if (this.canWalk(this.playerPos[0], nz)) {
        this.playerPos[1] = nz;
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

  resume() {
    if (this._running) return;
    this._running = true;
    this.animate();
  }

  /* ---------- Cleanup ---------- */
  dispose() {
    this._running = false;
    if (this._controller) { this._controller.abort(); this._controller = null; }

    // Free blob URLs created for local uploads
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
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.classes = [];
    this.plan = null;
    this.walkRects = [];
  }
}