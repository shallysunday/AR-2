import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  bestPlan, walkRects, artSlots, groupByClass,
  worldOf, rot, DOOR_W, WALL_T, CORR_L
} from './gallery-layout.js';

const MAX_ARTWORKS_3D = 80;
const CONCURRENT_MODELS = 3;
const PLAQUE_W = 1.1, PLAQUE_H = 0.72;

function makeSignCanvas(classCode, className, isEntrance) {
  const W = 512, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
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
  ctx.fillText(`${classCode} · ${className.toUpperCase()}`, W / 2, H / 2 + 2);

  return c;
}

function makePlaqueCanvas(item) {
  const W = 384, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
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
  ctx.fillText(clamp(ctx, item.title || 'Untitled', W - 36), 18, 62);

  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.fillText(clamp(ctx, item.student || '', W - 36), 18, 92);

  ctx.fillStyle = '#5d5d58';
  ctx.font = '13px -apple-system, sans-serif';
  ctx.fillText(clamp(ctx, item.lecturer || '', W - 36), 18, 112);

  ctx.strokeStyle = '#e7e5df';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, 128);
  ctx.lineTo(W - 18, 128);
  ctx.stroke();

  ctx.fillStyle = '#5d5d58';
  ctx.font = '12px -apple-system, sans-serif';

  const words = String(item.description || '').split(/\s+/);
  let line = '', y = 148;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;

    if (ctx.measureText(test).width > W - 36) {
      if (line) ctx.fillText(line, 18, y);
      line = word;
      y += 16;
      if (y > 190) break;
    } else {
      line = test;
    }
  }

  if (line && y <= 190) ctx.fillText(line, 18, y);

  ctx.fillStyle = '#1b1b1a';
  ctx.fillRect(0, H - 42, W, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TAP TO OPEN IN AR →', W / 2, H - 16);

  return c;
}

function clamp(ctx, text, maxWidth) {
  text = String(text);
  if (ctx.measureText(text).width <= maxWidth) return text;

  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut + '…';
}

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
    this.playerPitch = 0; // Vertical look angle in radians.

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
    this._resizeHandler = null;
    this._visibilityHandler = null;
    this._resizeObserver = null;
    this._pageHidden = document.hidden;
    this._lastPixelRatio = 0;
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f4f6);
    this.scene.fog = new THREE.FogExp2(0xf4f4f6, 0.006);

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(
      60, width / height, 0.1, 1000
    );

    const isSmallScreen = window.matchMedia('(max-width: 767px)').matches;
    this._isSmallScreen = isSmallScreen;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSmallScreen && window.devicePixelRatio <= 1.5,
      powerPreference: isSmallScreen ? 'low-power' : 'high-performance',
      alpha: false,
      stencil: false
    });

    this._lastPixelRatio = Math.min(
      window.devicePixelRatio || 1,
      isSmallScreen ? 1.25 : 1.5
    );

    this.renderer.setPixelRatio(this._lastPixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !isSmallScreen;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 0.55));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const key = new THREE.DirectionalLight(0xfff3e0, 1.2);
    key.position.set(24, 40, 22);
    key.castShadow = !isSmallScreen;
    key.shadow.mapSize.set(
      isSmallScreen ? 512 : 1024,
      isSmallScreen ? 512 : 1024
    );
    key.shadow.bias = -0.0005;
    key.shadow.camera.far = 300;

    this.scene.add(key);
    this.keyLight = key;

    try {
      await this.loadDataAndBuild();
    } catch (error) {
      console.error('3D gallery build failed', error);
      throw error; // Let index.html display the real failure instead of hiding it.
    }

    this._resizeHandler = () => this.onWindowResize();
    window.addEventListener('resize', this._resizeHandler, {
      passive: true
    });

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(this._resizeHandler);
      this._resizeObserver.observe(this.container);
    }

    this._visibilityHandler = () => {
      this._pageHidden = document.hidden;
      if (!this._pageHidden && this._running) this.animate();
    };

    document.addEventListener(
      'visibilitychange',
      this._visibilityHandler
    );

    this.setupControls();
    this.setupJoystick();
    this.animate();

    if (this.onReady) this.onReady();
  }

  async loadItems() {
    const loadPromise = (async () => {
      if (
        window.arArchive &&
        typeof window.arArchive.loadAll === 'function'
      ) {
        let items = await window.arArchive.loadAll();

        if (items.length > MAX_ARTWORKS_3D) {
          console.warn(
            `3D view capped to ${MAX_ARTWORKS_3D} / ${items.length} artworks`
          );
          items = items.slice(0, MAX_ARTWORKS_3D);
        }

        const pending = items.filter(
          item => !item.modelUrl && window.arArchive.getModel
        );

        await Promise.all(pending.map(async item => {
          try {
            const blob = await window.arArchive.getModel(item.id);

            if (blob) {
              const url = URL.createObjectURL(blob);
              this._blobUrls.push(url);
              item.modelUrl = url;
            }
          } catch (error) {
            console.warn('Blob load failed', item.id, error);
          }
        }));

        return items;
      }

      try {
        const raw = localStorage.getItem('arArchive.items.v1');
        if (raw) return JSON.parse(raw);
      } catch {
        // Ignore unavailable or invalid local storage.
      }

      return [];
    })();

    const timeout = new Promise(resolve =>
      setTimeout(() => resolve(null), 6000)
    );

    const items = await Promise.race([loadPromise, timeout]);

    if (!items || !items.length) {
      return [
        {
          title: 'Astronaut Study',
          student: 'Alya Putri',
          lecturer: 'Dr. Budi Santoso',
          className: 'Typography II',
          classCode: 'DK202',
          modelUrl:
            'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
        },
        {
          title: 'Expressive Robot',
          student: 'Rizky Pratama',
          lecturer: 'Maya Anggraini',
          className: 'Character Design I',
          classCode: 'DK115',
          modelUrl:
            'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb'
        }
      ];
    }

    return items;
  }

  async loadDataAndBuild() {
    const start = performance.now();
    const items = await this.loadItems();

    console.log(
      `[gallery] items loaded: ${items.length} in ` +
      `${(performance.now() - start).toFixed(0)}ms`
    );

    this.classes = groupByClass(items);

    if (!this.classes.length) {
      this.plan = { entries: [], corridors: [] };
      this.walkRects = [];
      return;
    }

    this.plan = bestPlan(this.classes.map(c => c.items.length));
    this.walkRects = walkRects(this.plan);

    this.fitShadowCamera();
    await this.buildMuseumGeometry();

    const startRoom = this.plan.entries.find(
      entry => entry.role === 'main' && entry.ci === 0
    );

    if (startRoom) {
      this.playerPos = [
        startRoom.P[0],
        startRoom.P[1] + startRoom.D / 2 - 2.5
      ];
      this.playerYaw = startRoom.yaw + Math.PI;
    }

    console.log(
      `[gallery] build complete in ` +
      `${(performance.now() - start).toFixed(0)}ms; ` +
      `meshes: ${this.countMeshes()}`
    );
  }

  fitShadowCamera() {
    let x0 = Infinity, x1 = -Infinity;
    let z0 = Infinity, z1 = -Infinity;

    for (const entry of this.plan.entries) {
      x0 = Math.min(x0, entry.P[0] - entry.W / 2);
      x1 = Math.max(x1, entry.P[0] + entry.W / 2);
      z0 = Math.min(z0, entry.P[1] - entry.D / 2);
      z1 = Math.max(z1, entry.P[1] + entry.D / 2);
    }

    if (!Number.isFinite(x0)) return;

    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const span = Math.max(x1 - x0, z1 - z0) + 20;
    const camera = this.keyLight.shadow.camera;

    camera.left = -span / 2;
    camera.right = span / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();

    this.keyLight.position.set(cx + 24, 40, cz + 22);
    this.keyLight.target.position.set(cx, 0, cz);
    this.scene.add(this.keyLight.target);
  }

  countMeshes() {
    let count = 0;
    this.scene.traverse(object => {
      if (object.isMesh) count++;
    });
    return count;
  }

  async buildMuseumGeometry() {
    const H = 8;
    const total = this.plan.entries.length;

    const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xe9e7e2 });
    const ceilMat = new THREE.MeshLambertMaterial({ color: 0xfbfaf7 });
    const pedestalMat = new THREE.MeshLambertMaterial({ color: 0xfbfaf7 });

    const floorGeo = new THREE.PlaneGeometry(1, 1);
    const ceilingGeo = new THREE.PlaneGeometry(1, 1);
    const plaqueGeo = new THREE.PlaneGeometry(PLAQUE_W, PLAQUE_H);
    const signGeo = new THREE.PlaneGeometry(3.2, 0.8);
    const pedestalGeo = new THREE.BoxGeometry(1.2, 1.1, 1.2);

    const signTextures = new Map();
    const plaqueTextures = new Map();
    const modelQueue = [];

    for (let i = 0; i < total; i++) {
      const entry = this.plan.entries[i];
      const cls = this.classes[entry.ci];
      if (!cls) continue;

      const room = new THREE.Group();
      room.position.set(entry.P[0], 0, entry.P[1]);
      room.rotation.y = entry.yaw;

      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.scale.set(entry.W, entry.D, 1);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      room.add(floor);

      const ceiling = new THREE.Mesh(ceilingGeo, ceilMat);
      ceiling.scale.set(entry.W, entry.D, 1);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = H;
      room.add(ceiling);

      this.buildWalls(room, entry, H, wallMat);

      this.createSign(
        room, entry, cls.code, cls.name, true, signGeo, signTextures
      );

      this.createSign(
        room, entry, cls.code, cls.name, false, signGeo, signTextures
      );

      const slots = artSlots(entry, cls.items.length);

      cls.items.forEach((art, index) => {
        const slot = slots[index];
        if (!slot) return;

        this.createPedestal(
          room, slot, art, pedestalGeo, pedestalMat,
          plaqueGeo, plaqueTextures, modelQueue
        );
      });

      this.scene.add(room);

      if (this.onProgress) {
        this.onProgress(
          (i + 1) / (total + 1),
          `Building room ${i + 1} / ${total}…`
        );
      }

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (modelQueue.length) {
      this._loadModelsInBackground(modelQueue);
    }

    if (this.onProgress) this.onProgress(1, 'Ready');
  }

  _loadModelsInBackground(queue) {
    const generation = this._generation;
    let cursor = 0;

    const worker = async () => {
      while (cursor < queue.length) {
        if (this._generation !== generation) return;

        const task = queue[cursor++];
        let success = false;

        try {
          success = await Promise.race([
            this.loadModel(task.group, task.art),
            new Promise(resolve =>
              setTimeout(() => resolve(false), 12000)
            )
          ]);
        } catch (error) {
          console.warn('[gallery] model error', error);
        }

        if (this._generation !== generation) return;
        if (!success) this._addFallback(task.group);

        await new Promise(resolve => setTimeout(resolve, 0));
      }
    };

    for (
      let i = 0;
      i < Math.min(CONCURRENT_MODELS, queue.length);
      i++
    ) {
      worker();
    }
  }

  _addFallback(group) {
    if (group.userData._hasFallback) return;
    group.userData._hasFallback = true;

    const fallback = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0x1b1b1a })
    );

    fallback.position.y = 1.5;
    group.add(fallback);
  }

  buildWalls(group, entry, height, material) {
    const { W, D, exit } = entry;
    const halfW = W / 2;
    const halfD = D / 2;
    const thickness = WALL_T;
    const doorHeight = 3;
    const doorWidth = DOOR_W;

    const segment = (x0, z0, x1, z1) => {
      const length = Math.hypot(x1 - x0, z1 - z0);
      if (length < 0.01) return;

      const horizontal = Math.abs(z1 - z0) < 1e-4;
      const geometry = horizontal
        ? new THREE.BoxGeometry(length, height, thickness)
        : new THREE.BoxGeometry(thickness, height, length);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        (x0 + x1) / 2,
        height / 2,
        (z0 + z1) / 2
      );
      mesh.castShadow = true;
      group.add(mesh);
    };

    const wallWithDoor = (x0, z0, x1, z1, doorFraction) => {
      const length = Math.hypot(x1 - x0, z1 - z0);
      const doorHalfFraction = (doorWidth / 2) / length;

      const a = Math.max(0, doorFraction - doorHalfFraction);
      const b = Math.min(1, doorFraction + doorHalfFraction);

      segment(
        x0, z0,
        x0 + (x1 - x0) * a,
        z0 + (z1 - z0) * a
      );

      segment(
        x0 + (x1 - x0) * b,
        z0 + (z1 - z0) * b,
        x1, z1
      );

      const cx = x0 + (x1 - x0) * doorFraction;
      const cz = z0 + (z1 - z0) * doorFraction;
      const horizontal = Math.abs(z1 - z0) < 1e-4;

      const geometry = horizontal
        ? new THREE.BoxGeometry(
            doorWidth, height - doorHeight, thickness
          )
        : new THREE.BoxGeometry(
            thickness, height - doorHeight, doorWidth
          );

      const lintel = new THREE.Mesh(geometry, material);
      lintel.position.set(
        cx,
        doorHeight + (height - doorHeight) / 2,
        cz
      );
      lintel.castShadow = true;
      group.add(lintel);
    };

    wallWithDoor(-halfW, halfD, halfW, halfD, 0.5);

    if (exit.side === 'N') {
      wallWithDoor(
        -halfW, -halfD, halfW, -halfD,
        0.5 + exit.pos[0] / W
      );
    } else if (exit.side === 'W') {
      wallWithDoor(
        -halfW, -halfD, -halfW, halfD,
        0.5 + exit.pos[1] / D
      );
    } else {
      wallWithDoor(
        halfW, -halfD, halfW, halfD,
        0.5 + exit.pos[1] / D
      );
    }

    if (exit.side !== 'N') {
      segment(-halfW, -halfD, halfW, -halfD);
    }

    if (exit.side !== 'W') {
      segment(-halfW, -halfD, -halfW, halfD);
    }

    if (exit.side !== 'E') {
      segment(halfW, -halfD, halfW, halfD);
    }
  }

  createSign(group, entry, code, name, isEntrance, geometry, cache) {
    const key = `${code}-${isEntrance ? 'in' : 'out'}`;

    if (!cache.has(key)) {
      const texture = new THREE.CanvasTexture(
        makeSignCanvas(code, name, isEntrance)
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 2;
      cache.set(key, texture);
    }

    const material = new THREE.MeshBasicMaterial({
      map: cache.get(key)
    });

    const sign = new THREE.Mesh(geometry, material);

    if (isEntrance) {
      sign.position.set(0, 3.65, entry.D / 2 - 0.08);
      sign.rotation.y = Math.PI;
    } else {
      const exit = entry.exit;

      if (exit.side === 'N') {
        sign.position.set(
          exit.pos[0], 3.65, -entry.D / 2 + 0.08
        );
        sign.rotation.y = 0;
      } else if (exit.side === 'W') {
        sign.position.set(
          -entry.W / 2 + 0.08, 3.65, exit.pos[1]
        );
        sign.rotation.y = Math.PI / 2;
      } else {
        sign.position.set(
          entry.W / 2 - 0.08, 3.65, exit.pos[1]
        );
        sign.rotation.y = -Math.PI / 2;
      }
    }

    group.add(sign);
  }

  createPedestal(
    group, slot, art, pedestalGeometry, pedestalMaterial,
    plaqueGeometry, plaqueCache, modelQueue
  ) {
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(slot.x, 0, slot.z);
    pedestalGroup.rotation.y = slot.yaw;
    pedestalGroup.userData = { art };

    const pedestal = new THREE.Mesh(
      pedestalGeometry, pedestalMaterial
    );
    pedestal.position.y = 0.55;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    pedestalGroup.add(pedestal);

    const key = art.id || art.title || Math.random().toString(36);

    if (!plaqueCache.has(key)) {
      const texture = new THREE.CanvasTexture(makePlaqueCanvas(art));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 2;
      plaqueCache.set(key, texture);
    }

    const plaque = new THREE.Mesh(
      plaqueGeometry,
      new THREE.MeshBasicMaterial({ map: plaqueCache.get(key) })
    );

    plaque.position.set(0, 0.65, 0.61);
    pedestalGroup.add(plaque);

    modelQueue.push({ group: pedestalGroup, art });
    group.add(pedestalGroup);
  }

  loadModel(group, art) {
    const generation = this._generation;

    return new Promise(resolve => {
      const loader = new GLTFLoader();
      const url = art.modelUrl ||
        'https://modelviewer.dev/shared-assets/models/Astronaut.glb';

      loader.load(
        url,
        gltf => {
          if (this._generation !== generation) {
            resolve(false);
            return;
          }

          try {
            const model = gltf.scene;
            model.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);

            const maxDimension = Math.max(size.x, size.y, size.z);

            if (maxDimension > 0) {
              model.scale.setScalar(1 / maxDimension);
            }

            const scaledBox = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            scaledBox.getCenter(center);

            model.position.set(
              -center.x,
              1.1 - scaledBox.min.y,
              -center.z
            );

            model.traverse(object => {
              if (object.isMesh) object.castShadow = true;
            });

            group.add(model);
            resolve(true);
          } catch (error) {
            console.error('[gallery] model processing failed', error);
            resolve(false);
          }
        },
        undefined,
        () => resolve(false)
      );
    });
  }

  computePath(fromIndex, toIndex) {
    const entries = this.plan.entries;
    if (fromIndex === toIndex) return [this.playerPos];

    const entranceOf = entry =>
      worldOf(entry.P, entry.yaw, [0, entry.D / 2]);

    const exitOf = entry =>
      worldOf(entry.P, entry.yaw, entry.exit.pos);

    const points = [this.playerPos.slice()];

    if (fromIndex < toIndex) {
      points.push(exitOf(entries[fromIndex]));

      for (let k = fromIndex; k < toIndex; k++) {
        points.push(entranceOf(entries[k + 1]));

        if (k + 1 < toIndex) {
          points.push(exitOf(entries[k + 1]));
        }
      }

      points.push([
        entries[toIndex].P[0],
        entries[toIndex].P[1]
      ]);
    } else {
      points.push(entranceOf(entries[fromIndex]));

      for (let k = fromIndex - 1; k >= toIndex; k--) {
        points.push(exitOf(entries[k]));

        if (k > toIndex) {
          points.push(entranceOf(entries[k]));
        }
      }

      points.push([
        entries[toIndex].P[0],
        entries[toIndex].P[1]
      ]);
    }

    return points;
  }

  get currentEntryIdx() {
    for (let i = 0; i < this.plan.entries.length; i++) {
      const entry = this.plan.entries[i];
      const halfW = entry.W / 2;
      const halfD = entry.D / 2;
      const dx = this.playerPos[0] - entry.P[0];
      const dz = this.playerPos[1] - entry.P[1];
      const c = Math.cos(-entry.yaw);
      const s = Math.sin(-entry.yaw);
      const lx = dx * c + dz * s;
      const lz = -dx * s + dz * c;

      if (
        Math.abs(lx) <= halfW + 1 &&
        Math.abs(lz) <= halfD + 1
      ) {
        return i;
      }
    }

    return -1;
  }

  jumpToClass(classIndex) {
    if (this.isTransitioning) return;

    const targetIndex = this.plan.entries.findIndex(
      entry => entry.role === 'main' && entry.ci === classIndex
    );

    if (targetIndex < 0) return;

    const fromIndex = this.currentEntryIdx;
    const waypoints = fromIndex >= 0
      ? this.computePath(fromIndex, targetIndex)
      : [
          [this.playerPos[0], this.playerPos[1]],
          [
            this.plan.entries[targetIndex].P[0],
            this.plan.entries[targetIndex].P[1]
          ]
        ];

    if (waypoints.length < 2) return;

    const lengths = [];
    let totalLength = 0;

    for (let i = 1; i < waypoints.length; i++) {
      const length = Math.hypot(
        waypoints[i][0] - waypoints[i - 1][0],
        waypoints[i][1] - waypoints[i - 1][1]
      );
      lengths.push(length);
      totalLength += length;
    }

    const startYaw = this.playerYaw;
    const targetYaw = this.plan.entries[targetIndex].yaw + Math.PI;
    let yawDelta = targetYaw - startYaw;

    while (yawDelta > Math.PI) yawDelta -= 2 * Math.PI;
    while (yawDelta < -Math.PI) yawDelta += 2 * Math.PI;

    this.isTransitioning = true;
    this.keys.clear();
    this.joystick.dx = this.joystick.dy = 0;

    const duration = Math.min(3500, Math.max(900, totalLength * 45));
    const startTime = performance.now();

    const step = () => {
      const t = Math.min(1, (performance.now() - startTime) / duration);
      const eased = t * t * (3 - 2 * t);
      const targetDistance = eased * totalLength;

      let accumulated = 0;
      let segmentIndex = lengths.length - 1;

      for (let i = 0; i < lengths.length; i++) {
        if (accumulated + lengths[i] >= targetDistance) {
          segmentIndex = i;
          break;
        }
        accumulated += lengths[i];
      }

      const segmentT = lengths[segmentIndex] > 0
        ? (targetDistance - accumulated) / lengths[segmentIndex]
        : 0;

      const p0 = waypoints[segmentIndex];
      const p1 = waypoints[segmentIndex + 1] || p0;

      this.playerPos = [
        p0[0] + (p1[0] - p0[0]) * segmentT,
        p0[1] + (p1[1] - p0[1]) * segmentT
      ];

      this.playerYaw = startYaw + yawDelta * eased;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.isTransitioning = false;
      }
    };

    requestAnimationFrame(step);
  }

  checkLoopTeleport() {
    const entries = this.plan.entries;
    if (!entries.length) return;

    const pre = entries.find(entry => entry.role === 'pre');
    const post = entries.find(entry => entry.role === 'post');
    if (!pre || !post) return;

    const inside = entry => {
      const halfW = entry.W / 2;
      const halfD = entry.D / 2;
      const dx = this.playerPos[0] - entry.P[0];
      const dz = this.playerPos[1] - entry.P[1];
      const c = Math.cos(-entry.yaw);
      const s = Math.sin(-entry.yaw);
      const lx = dx * c + dz * s;
      const lz = -dx * s + dz * c;

      return (
        Math.abs(lx) <= halfW - 0.3 &&
        Math.abs(lz) <= halfD - 0.3
      );
    };

    if (inside(pre)) {
      const lastMain = entries.find(
        entry => entry.role === 'main' &&
          entry.ci === this.classes.length - 1
      );
      if (lastMain) this.teleportBetween(pre, lastMain);
    } else if (inside(post)) {
      const firstMain = entries.find(
        entry => entry.role === 'main' && entry.ci === 0
      );
      if (firstMain) this.teleportBetween(post, firstMain);
    }
  }

  teleportBetween(fromEntry, toEntry) {
    const local = rot(
      [
        this.playerPos[0] - fromEntry.P[0],
        this.playerPos[1] - fromEntry.P[1]
      ],
      -fromEntry.yaw
    );

    const world = rot(local, toEntry.yaw);

    this.playerPos = [
      toEntry.P[0] + world[0],
      toEntry.P[1] + world[1]
    ];

    this.playerYaw += toEntry.yaw - fromEntry.yaw;
  }

  setupControls() {
    this._controller = new AbortController();
    const signal = this._controller.signal;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    const moveKeys = [
      'w', 'a', 's', 'd',
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright'
    ];

    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();

      if (moveKeys.includes(key)) {
        this.keys.add(key);
        event.preventDefault();
      }
    }, { signal });

    window.addEventListener('keyup', event => {
      this.keys.delete(event.key.toLowerCase());
    }, { signal });

    this.container.addEventListener('mousedown', event => {
      if (this.isTransitioning) return;

      this.isDragging = true;
      this.dragDistance = 0;
      this.previousMousePosition = {
        x: event.clientX,
        y: event.clientY
      };
    }, { signal });

    window.addEventListener('mousemove', event => {
      if (!this.isDragging) return;

      const dx = event.clientX - this.previousMousePosition.x;
      const dy = event.clientY - this.previousMousePosition.y;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      this.playerYaw -= dx * 0.005;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - dy * 0.005,
        -1.35,
        1.35
      );

      this.previousMousePosition = {
        x: event.clientX,
        y: event.clientY
      };
    }, { signal });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    }, { signal });

    this.container.addEventListener('touchstart', event => {
      if (this.isTransitioning || event.touches.length !== 1) return;

      this.isDragging = true;
      this.dragDistance = 0;
      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }, { signal, passive: true });

    window.addEventListener('touchmove', event => {
      if (!this.isDragging || event.touches.length !== 1) return;

      const dx = event.touches[0].clientX -
        this.previousMousePosition.x;
      const dy = event.touches[0].clientY -
        this.previousMousePosition.y;

      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      this.playerYaw -= dx * 0.005;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - dy * 0.005,
        -1.35,
        1.35
      );

      this.previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }, { signal, passive: true });

    const endTouch = () => {
      this.isDragging = false;
    };

    window.addEventListener('touchend', endTouch, { signal });
    window.addEventListener('touchcancel', endTouch, { signal });

    this.container.addEventListener('click', event => {
      if (this.dragDistance > 6 || this.isTransitioning) return;

      const rect = this.renderer.domElement.getBoundingClientRect();

      this.pointer.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

      this.pointer.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.pointer, this.camera);

      const hits = this.raycaster.intersectObjects(
        this.scene.children, true
      );

      for (const hit of hits) {
        let node = hit.object;

        while (node) {
          if (node.userData && node.userData.art) {
            if (this.onSelectArtwork) {
              this.onSelectArtwork(node.userData.art);
            }
            return;
          }

          node = node.parent;
        }

        break;
      }
    }, { signal });
  }

  setupJoystick() {
    const joystick = document.getElementById('joystick');
    const knob = joystick &&
      joystick.querySelector('.joystick-knob');

    if (!joystick || !knob) return;

    this._controller = this._controller || new AbortController();
    const signal = this._controller.signal;
    const maxRadius = 42;

    const update = event => {
      const rect = joystick.getBoundingClientRect();

      let dx = event.clientX - (rect.left + rect.width / 2);
      let dy = event.clientY - (rect.top + rect.height / 2);

      const distance = Math.hypot(dx, dy);

      if (distance > maxRadius) {
        dx = dx / distance * maxRadius;
        dy = dy / distance * maxRadius;
      }

      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joystick.dx = dx / maxRadius;
      this.joystick.dy = dy / maxRadius;
    };

    joystick.addEventListener('pointerdown', event => {
      if (this.isTransitioning) return;

      event.preventDefault();
      event.stopPropagation();

      this.joystick.active = true;
      joystick.setPointerCapture(event.pointerId);
      update(event);
    }, { signal });

    joystick.addEventListener('pointermove', event => {
      if (!this.joystick.active) return;
      event.preventDefault();
      update(event);
    }, { signal });

    const end = () => {
      this.joystick.active = false;
      this.joystick.dx = this.joystick.dy = 0;
      knob.style.transform = 'translate(0, 0)';
    };

    joystick.addEventListener('pointerup', end, { signal });
    joystick.addEventListener('pointercancel', end, { signal });
  }

  onWindowResize() {
    if (!this.renderer || !this.camera || !this.container) return;

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);

    const ratio = Math.min(
      window.devicePixelRatio || 1,
      this._isSmallScreen ? 1.25 : 1.5
    );

    if (ratio !== this._lastPixelRatio) {
      this.renderer.setPixelRatio(ratio);
      this._lastPixelRatio = ratio;
    }
  }

  canWalk(x, z) {
    for (const rect of this.walkRects) {
      if (
        x >= rect.x0 && x <= rect.x1 &&
        z >= rect.z0 && z <= rect.z1
      ) {
        return true;
      }
    }

    return false;
  }

  animate() {
    if (!this._running || !this.renderer || this._pageHidden) return;

    requestAnimationFrame(() => this.animate());

    const sinYaw = Math.sin(this.playerYaw);
    const cosYaw = Math.cos(this.playerYaw);

    const forward = [-sinYaw, -cosYaw];
    const right = [cosYaw, -sinYaw];

    let mx = 0, mz = 0;

    if (!this.isTransitioning) {
      if (this.keys.has('w') || this.keys.has('arrowup')) {
        mx += forward[0];
        mz += forward[1];
      }

      if (this.keys.has('s') || this.keys.has('arrowdown')) {
        mx -= forward[0];
        mz -= forward[1];
      }

      if (this.keys.has('a') || this.keys.has('arrowleft')) {
        mx -= right[0];
        mz -= right[1];
      }

      if (this.keys.has('d') || this.keys.has('arrowright')) {
        mx += right[0];
        mz += right[1];
      }

      if (this.joystick.dx || this.joystick.dy) {
        const jx = this.joystick.dx;
        const jy = -this.joystick.dy;

        mx += forward[0] * jy + right[0] * jx;
        mz += forward[1] * jy + right[1] * jx;
      }

      if (mx || mz) {
        const length = Math.hypot(mx, mz);
        const speed = 0.08;

        const nx = this.playerPos[0] + mx / length * speed;
        const nz = this.playerPos[1] + mz / length * speed;

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

    this.camera.position.set(
      this.playerPos[0], 1.7, this.playerPos[1]
    );

    const pitchCos = Math.cos(this.playerPitch);
    const pitchSin = Math.sin(this.playerPitch);
    this.camera.lookAt(
      this.camera.position.x + forward[0] * pitchCos,
      this.camera.position.y + pitchSin,
      this.camera.position.z + forward[1] * pitchCos
    );

    this.renderer.render(this.scene, this.camera);
  }

  pause() {
    this._running = false;
  }

  resume() {
    if (this._running) return;

    this._running = true;

    if (!this._pageHidden) this.animate();
  }

  dispose() {
    this._generation++;
    this._running = false;

    if (this._controller) {
      this._controller.abort();
      this._controller = null;
    }

    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }

    if (this._visibilityHandler) {
      document.removeEventListener(
        'visibilitychange', this._visibilityHandler
      );
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    this._resizeHandler = null;
    this._visibilityHandler = null;

    this._blobUrls.forEach(url => URL.revokeObjectURL(url));
    this._blobUrls = [];

    if (this.scene) {
      this.scene.traverse(object => {
        if (!object.isMesh) return;

        if (object.geometry) object.geometry.dispose();

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach(material => {
          if (!material) return;
          if (material.map) material.map.dispose();
          material.dispose();
        });
      });
    }

    if (this.renderer) {
      this.renderer.dispose();

      const canvas = this.renderer.domElement;
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }
}