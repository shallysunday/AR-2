import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  bestPlan, walkRects, artSlots, groupByClass,
  worldOf, rot, DOOR_W, WALL_T, CORR_L
} from './gallery-layout.js';

const MAX_ARTWORKS_3D = 80;
const CONCURRENT_MODELS = 3;
const PLAQUE_W = 1.1, PLAQUE_H = 0.72;
const TALL_WALL_H = 40; // Very very tall wall

// Pastel wall background colors per class
const CLASS_PASTEL_COLORS = {
  'IL101': '#F8C8DC', // Illustration: Soft pastel pink/coral
  'PH101': '#B5EAD7', // Photography: Soft pastel mint teal
  'AP201': '#FFE5B4', // Advertising Photography: Soft pastel amber/cream
  'AT201': '#DCD6F7'  // Applied Typography: Soft pastel lavender
};

function makeSignCanvas(classCode, className) {
  const W = 512, H = 160;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.clearRect(0, 0, W, H);

  // Clear readable pill background badge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(8, 8, W - 16, H - 16, 20);
  else ctx.rect(8, 8, W - 16, H - 16);
  ctx.fill();
  ctx.strokeStyle = '#1b1b1a';
  ctx.lineWidth = 4;
  ctx.stroke();

  const ink = '#1b1b1a';
  const cx = 64;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Up arrow
  ctx.beginPath();
  ctx.moveTo(cx, 115);
  ctx.lineTo(cx, 48);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 18, 66);
  ctx.lineTo(cx, 42);
  ctx.lineTo(cx + 18, 66);
  ctx.stroke();

  // Text
  const textX = 115;
  const textMaxW = W - textX - 24;
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';

  ctx.font = 'bold 22px -apple-system, sans-serif';
  ctx.fillText((classCode || '').toUpperCase(), textX, 58);

  ctx.font = 'bold 28px -apple-system, sans-serif';
  ctx.fillText(clamp(ctx, (className || '').toUpperCase(), textMaxW), textX, 104);

  return c;
}

function make2DArtworkCanvas(item) {
  const W = 512, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const bg = item.artColor || '#2b2d42';
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, bg);
  g.addColorStop(1, '#1a1a24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.42, 130, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(clamp(ctx, item.title || 'Untitled', W - 60), W / 2, H * 0.42);

  ctx.font = '20px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillText(clamp(ctx, item.student || '', W - 60), W / 2, H * 0.42 + 45);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.fillText((item.className || '').toUpperCase(), W / 2, H - 45);

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
  ctx.moveTo(18, 128); ctx.lineTo(W - 18, 128);
  ctx.stroke();

  ctx.fillStyle = '#5d5d58';
  ctx.font = '12px -apple-system, sans-serif';
  const words = String(item.description || '').split(/\s+/);
  let line = '', y = 148;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > W - 36) {
      if (line) ctx.fillText(line, 18, y);
      line = word; y += 16;
      if (y > 190) break;
    } else line = test;
  }
  if (line && y <= 190) ctx.fillText(line, 18, y);

  ctx.fillStyle = '#1b1b1a';
  ctx.fillRect(0, H - 42, W, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TAP TO INSPECT ARTWORK →', W / 2, H - 16);

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

function makeWallGradientTexture(pastelHex = '#B5EAD7') {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Linear gradient: bottom pastel color fading up into pure transparent white
  const g = ctx.createLinearGradient(0, 512, 0, 0);
  g.addColorStop(0, pastelHex);
  g.addColorStop(0.35, pastelHex);
  g.addColorStop(0.85, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 512);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeFloorGridTexture(maxAnisotropy) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f5f5f7';
  ctx.fillRect(0, 0, S, S);

  ctx.strokeStyle = 'rgba(180, 180, 190, 0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, S, S);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAnisotropy || 1;
  return t;
}

function makeBlobTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');

  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.20)');
  g.addColorStop(0.5, 'rgba(0, 0, 0, 0.06)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
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
    this.playerPitch = 0;

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
    
    // Pure White Void Environment to Infinity
    this.scene.background = new THREE.Color(0xffffff);
    this.scene.fog = new THREE.FogExp2(0xffffff, 0.005);

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

    const isSmallScreen = window.matchMedia('(max-width: 767px)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmallScreen ? 1.25 : 1.5));
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xe2ded8, 0.9));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    await this.loadDataAndBuild();

    this.setupControls();
    this.setupJoystick();
    this.animate();

    if (this.onReady) this.onReady();
  }

  async loadItems() {
    if (window.arArchive && typeof window.arArchive.loadAll === 'function') {
      let items = await window.arArchive.loadAll();
      if (items.length > MAX_ARTWORKS_3D) items = items.slice(0, MAX_ARTWORKS_3D);
      return items;
    }
    return [];
  }

  async loadDataAndBuild() {
    const items = await this.loadItems();
    this.classes = groupByClass(items);

    if (!this.classes.length) return;

    this.plan = bestPlan(this.classes.map(c => c.items.length));
    this.walkRects = walkRects(this.plan);

    await this.buildMuseumGeometry();

    const startRoom = this.plan.entries.find(e => e.role === 'main' && e.ci === 0);
    if (startRoom) {
      this.playerPos = [startRoom.P[0], startRoom.P[1] + startRoom.D / 2 - 2.5];
      this.playerYaw = startRoom.yaw + Math.PI;
    }
  }

  async buildMuseumGeometry() {
    const H = TALL_WALL_H;
    const total = this.plan.entries.length;
    const entries = this.plan.entries;

    const floorMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: makeFloorGridTexture(Math.min(4, this.renderer.capabilities.getMaxAnisotropy()))
    });
    const pedestalMat = new THREE.MeshLambertMaterial({ color: 0xfbfaf7 });

    this._blob = {
      geo: new THREE.PlaneGeometry(3, 3),
      mat: new THREE.MeshBasicMaterial({
        map: makeBlobTexture(), transparent: true, depthWrite: false
      })
    };

    const plaqueGeo = new THREE.PlaneGeometry(PLAQUE_W, PLAQUE_H);
    const signGeo = new THREE.PlaneGeometry(2.4, 0.75);
    const pedestalGeo = new THREE.BoxGeometry(1.2, 1.1, 1.2);

    const signTextures = new Map();
    const plaqueTextures = new Map();
    const wallMaterials = new Map();
    const modelQueue = [];

    // Build Rooms
    for (let i = 0; i < total; i++) {
      const entry = entries[i];
      const cls = this.classes[entry.ci];
      if (!cls) continue;

      const room = new THREE.Group();
      room.position.set(entry.P[0], 0, entry.P[1]);
      room.rotation.y = entry.yaw;

      // Floor
      const floorGeo = new THREE.PlaneGeometry(entry.W, entry.D);
      const floorUV = floorGeo.attributes.uv;
      for (let u = 0; u < floorUV.count; u++) {
        floorUV.setXY(u, floorUV.getX(u) * entry.W / 2, floorUV.getY(u) * entry.D / 2);
      }
      floorUV.needsUpdate = true;
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      room.add(floor);

      // Unique pastel gradient per class
      const pastelHex = CLASS_PASTEL_COLORS[cls.code] || '#B5EAD7';
      if (!wallMaterials.has(cls.code)) {
        wallMaterials.set(cls.code, new THREE.MeshLambertMaterial({
          map: makeWallGradientTexture(pastelHex),
          transparent: true,
          side: THREE.DoubleSide
        }));
      }
      const wallMat = wallMaterials.get(cls.code);

      // Build Tall Walls (NO Ceiling!)
      this.buildWalls(room, entry, H, wallMat);

      // Floating Hanging Light in room center
      this.createFloatingLighting(room, entry.W, entry.D);

      // Signs next to doors
      this.createSign(room, entry, cls.code, cls.name, true, signGeo, signTextures);

      // Artworks
      const slots = artSlots(entry, cls.items);
      cls.items.forEach((art, idx) => {
        const slot = slots[idx];
        if (!slot) return;

        if (slot.is2D) {
          this.createWallFramedArtwork(room, slot, art, plaqueGeo, plaqueTextures);
        } else {
          this.createPedestal(room, slot, art, pedestalGeo, pedestalMat, plaqueGeo, plaqueTextures, modelQueue);
        }
      });

      this.scene.add(room);
    }

    // Build Short Connecting Corridors between classes
    this.buildCorridors(this.plan.corridors, H, wallMaterials.values().next().value || new THREE.MeshLambertMaterial(), floorMat);

    if (modelQueue.length) this._loadModelsInBackground(modelQueue);
  }

  createFloatingLighting(room, W, D) {
    const lightGroup = new THREE.Group();
    lightGroup.position.set(0, 5.5, 0); // Suspended floating in center

    const ringGeo = new THREE.TorusGeometry(1.8, 0.08, 16, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xfff5ea, emissiveIntensity: 2.2, roughness: 0.1
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    lightGroup.add(ring);

    const coreGeo = new THREE.SphereGeometry(0.35, 24, 24);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0dd, emissiveIntensity: 2.5 });
    lightGroup.add(new THREE.Mesh(coreGeo, coreMat));

    const pointLight = new THREE.PointLight(0xfff5ea, 80, Math.max(W, D) * 2.5, 1.5);
    lightGroup.add(pointLight);

    room.add(lightGroup);
  }

  buildCorridors(corridors, height, wallMat, floorMat) {
    corridors.forEach(corr => {
      if (!corr.len || corr.closed) return;

      const group = new THREE.Group();
      const angle = Math.atan2(corr.d[0], corr.d[1]);
      group.position.set(corr.E[0], 0, corr.E[1]);
      group.rotation.y = angle;

      // Hallway Floor
      const floorGeo = new THREE.PlaneGeometry(DOOR_W, corr.len);
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(0, 0, corr.len / 2);
      group.add(floorMesh);

      // Hallway Left & Right Walls
      const lWallGeo = new THREE.BoxGeometry(WALL_T, height, corr.len);
      this._mapWallV(lWallGeo, height / 2, height);
      const lWall = new THREE.Mesh(lWallGeo, wallMat);
      lWall.position.set(-DOOR_W / 2 - WALL_T / 2, height / 2, corr.len / 2);
      group.add(lWall);

      const rWallGeo = new THREE.BoxGeometry(WALL_T, height, corr.len);
      this._mapWallV(rWallGeo, height / 2, height);
      const rWall = new THREE.Mesh(rWallGeo, wallMat);
      rWall.position.set(DOOR_W / 2 + WALL_T / 2, height / 2, corr.len / 2);
      group.add(rWall);

      this.scene.add(group);
    });
  }

  _mapWallV(geometry, yCenter, totalHeight) {
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setY(i, THREE.MathUtils.clamp((pos.getY(i) + yCenter) / totalHeight, 0, 1));
    }
    uv.needsUpdate = true;
  }

  buildWalls(group, entry, height, material) {
    const { W, D, exit } = entry;
    const halfW = W / 2, halfD = D / 2;
    const thickness = WALL_T;
    const doorHeight = 5, doorWidth = DOOR_W;

    const segment = (x0, z0, x1, z1) => {
      const length = Math.hypot(x1 - x0, z1 - z0);
      if (length < 0.01) return;
      const horizontal = Math.abs(z1 - z0) < 1e-4;
      const geometry = horizontal
        ? new THREE.BoxGeometry(length, height, thickness)
        : new THREE.BoxGeometry(thickness, height, length);

      this._mapWallV(geometry, height / 2, height);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((x0 + x1) / 2, height / 2, (z0 + z1) / 2);
      group.add(mesh);
    };

    const wallWithDoor = (x0, z0, x1, z1, doorFraction) => {
      const length = Math.hypot(x1 - x0, z1 - z0);
      if (length < 0.3) return;
      const horizontal = Math.abs(z1 - z0) < 1e-4;
      const archWidth = Math.min(doorWidth, length * 0.6, doorHeight * 1.8);
      const halfArch = archWidth / 2;

      if (length < archWidth + 0.2) { segment(x0, z0, x1, z1); return; }

      const minFrac = (halfArch + 0.05) / length;
      const maxFrac = 1 - (halfArch + 0.05) / length;
      const frac = Math.max(minFrac, Math.min(maxFrac, doorFraction));
      const wallCx = (x0 + x1) / 2, wallCz = (z0 + z1) / 2;
      const rawOffset = (frac - 0.5) * length;
      const doorOffset = horizontal ? rawOffset : -rawOffset;
      const springY = doorHeight - halfArch;
      const leftX = doorOffset - halfArch, rightX = doorOffset + halfArch;

      const shape = new THREE.Shape();
      shape.moveTo(-length / 2, 0);
      shape.lineTo(leftX, 0);
      shape.lineTo(leftX, springY);
      shape.absarc(doorOffset, springY, halfArch, Math.PI, 0, true);
      shape.lineTo(rightX, 0);
      shape.lineTo(length / 2, 0);
      shape.lineTo(length / 2, height);
      shape.lineTo(-length / 2, height);
      shape.closePath();

      const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
      geometry.translate(0, 0, -thickness / 2);
      if (!horizontal) geometry.rotateY(Math.PI / 2);

      this._mapWallV(geometry, 0, height);
      const wall = new THREE.Mesh(geometry, material);
      wall.position.set(wallCx, 0, wallCz);
      group.add(wall);
    };

    wallWithDoor(-halfW, halfD, halfW, halfD, 0.5);

    if (exit.side === 'N') wallWithDoor(-halfW, -halfD, halfW, -halfD, 0.5 + exit.pos[0] / W);
    else if (exit.side === 'W') wallWithDoor(-halfW, -halfD, -halfW, halfD, 0.5 + exit.pos[1] / D);
    else wallWithDoor(halfW, -halfD, halfW, halfD, 0.5 + exit.pos[1] / D);

    if (exit.side !== 'N') segment(-halfW, -halfD, halfW, -halfD);
    if (exit.side !== 'W') segment(-halfW, -halfD, -halfW, halfD);
    if (exit.side !== 'E') segment(halfW, -halfD, halfW, halfD);
  }

  createSign(group, entry, code, name, isEntrance, geometry, cache) {
    if (!cache.has(code)) {
      const texture = new THREE.CanvasTexture(makeSignCanvas(code, name));
      texture.colorSpace = THREE.SRGBColorSpace;
      cache.set(code, texture);
    }

    const sign = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: cache.get(code), transparent: true }));
    const wallInset = WALL_T / 2 + 0.04;
    const signY = 3.2; // Next to/above door archway

    if (isEntrance) {
      sign.position.set(DOOR_W / 2 + 1.4, signY, entry.D / 2 - wallInset);
      sign.rotation.y = Math.PI;
    } else {
      sign.position.set(entry.exit.pos[0] + DOOR_W / 2 + 1.4, signY, -entry.D / 2 + wallInset);
      sign.rotation.y = 0;
    }
    group.add(sign);
  }

  // 2D Artwork hung on wall in White Frame
  createWallFramedArtwork(group, slot, art, plaqueGeometry, plaqueCache) {
    const artGroup = new THREE.Group();
    artGroup.position.set(slot.x, 2.1, slot.z);
    artGroup.rotation.y = slot.yaw;
    artGroup.userData = { art };

    const frameW = 1.7, frameH = 2.1, frameD = 0.08, borderT = 0.12;

    // 1. White Frame
    const frameGeo = new THREE.BoxGeometry(frameW, frameH, frameD);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    artGroup.add(frameMesh);

    // 2. Artwork Surface
    const canvasGeo = new THREE.PlaneGeometry(frameW - borderT * 2, frameH - borderT * 2);
    const canvasTex = art.thumbnail
      ? new THREE.TextureLoader().load(art.thumbnail)
      : new THREE.CanvasTexture(make2DArtworkCanvas(art));
    canvasTex.colorSpace = THREE.SRGBColorSpace;

    const canvasMesh = new THREE.Mesh(canvasGeo, new THREE.MeshBasicMaterial({ map: canvasTex }));
    canvasMesh.position.z = frameD / 2 + 0.005;
    artGroup.add(canvasMesh);

    // 3. Wall Plaque next to frame
    const key = art.id || art.title || Math.random().toString(36);
    if (!plaqueCache.has(key)) {
      const texture = new THREE.CanvasTexture(makePlaqueCanvas(art));
      texture.colorSpace = THREE.SRGBColorSpace;
      plaqueCache.set(key, texture);
    }
    const plaque = new THREE.Mesh(plaqueGeometry, new THREE.MeshBasicMaterial({ map: plaqueCache.get(key) }));
    plaque.position.set(frameW / 2 + 0.75, -0.4, 0.02);
    artGroup.add(plaque);

    group.add(artGroup);
  }

  // 3D Artwork on Pedestal
  createPedestal(group, slot, art, pedestalGeometry, pedestalMaterial, plaqueGeometry, plaqueCache, modelQueue) {
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(slot.x, 0, slot.z);
    pedestalGroup.rotation.y = slot.yaw;
    pedestalGroup.userData = { art };

    const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
    pedestal.position.y = 0.55;
    pedestalGroup.add(pedestal);

    const blob = new THREE.Mesh(this._blob.geo, this._blob.mat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    blob.raycast = () => {};
    pedestalGroup.add(blob);

    const key = art.id || art.title || Math.random().toString(36);
    if (!plaqueCache.has(key)) {
      const texture = new THREE.CanvasTexture(makePlaqueCanvas(art));
      texture.colorSpace = THREE.SRGBColorSpace;
      plaqueCache.set(key, texture);
    }
    const plaque = new THREE.Mesh(plaqueGeometry, new THREE.MeshBasicMaterial({ map: plaqueCache.get(key) }));
    plaque.position.set(0, 0.65, 0.61);
    pedestalGroup.add(plaque);

    modelQueue.push({ group: pedestalGroup, art });
    group.add(pedestalGroup);
  }

  loadModel(group, art) {
    const generation = this._generation;
    return new Promise(resolve => {
      const loader = new GLTFLoader();
      const url = art.modelUrl || 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';

      loader.load(url, gltf => {
        if (this._generation !== generation) return resolve(false);
        try {
          const model = gltf.scene;
          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) model.scale.setScalar(1 / maxDim);
          const scaledBox = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          scaledBox.getCenter(center);
          model.position.set(-center.x, 1.1 - scaledBox.min.y, -center.z);
          group.add(model);
          resolve(true);
        } catch { resolve(false); }
      }, undefined, () => resolve(false));
    });
  }

  _loadModelsInBackground(queue) {
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const task = queue[cursor++];
        await this.loadModel(task.group, task.art);
        await new Promise(r => setTimeout(r, 0));
      }
    };
    for (let i = 0; i < Math.min(CONCURRENT_MODELS, queue.length); i++) worker();
  }

  setupControls() {
    this._controller = new AbortController();
    const signal = this._controller.signal;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

    window.addEventListener('keydown', e => {
      if (moveKeys.includes(e.key.toLowerCase())) { this.keys.add(e.key.toLowerCase()); e.preventDefault(); }
    }, { signal });

    window.addEventListener('keyup', e => { this.keys.delete(e.key.toLowerCase()); }, { signal });

    this.container.addEventListener('mousedown', e => {
      if (this.isTransitioning) return;
      this.isDragging = true;
      this.dragDistance = 0;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }, { signal });

    window.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMousePosition.x;
      const dy = e.clientY - this.previousMousePosition.y;
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
      this.playerYaw -= dx * 0.005;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * 0.005, -1.35, 1.35);
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    }, { signal });

    window.addEventListener('mouseup', () => { this.isDragging = false; }, { signal });

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
      }
    }, { signal });
  }

  setupJoystick() {
    const joystick = document.getElementById('joystick');
    const knob = joystick && joystick.querySelector('.joystick-knob');
    if (!joystick || !knob) return;

    const signal = this._controller ? this._controller.signal : undefined;
    const maxRadius = 42;

    const update = e => {
      const rect = joystick.getBoundingClientRect();
      let dx = e.clientX - (rect.left + rect.width / 2);
      let dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) { dx = dx / dist * maxRadius; dy = dy / dist * maxRadius; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joystick.dx = dx / maxRadius;
      this.joystick.dy = dy / maxRadius;
    };

    joystick.addEventListener('pointerdown', e => {
      if (this.isTransitioning) return;
      e.preventDefault();
      this.joystick.active = true;
      joystick.setPointerCapture(e.pointerId);
      update(e);
    }, { signal });

    joystick.addEventListener('pointermove', e => {
      if (this.joystick.active) update(e);
    }, { signal });

    const end = () => {
      this.joystick.active = false;
      this.joystick.dx = this.joystick.dy = 0;
      knob.style.transform = 'translate(0, 0)';
    };
    joystick.addEventListener('pointerup', end, { signal });
    joystick.addEventListener('pointercancel', end, { signal });
  }

  canWalk(x, z) {
    for (const rect of this.walkRects) {
      if (x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1) return true;
    }
    return false;
  }

  animate() {
    if (!this._running || !this.renderer) return;
    requestAnimationFrame(() => this.animate());

    const sinYaw = Math.sin(this.playerYaw);
    const cosYaw = Math.cos(this.playerYaw);
    const forward = [-sinYaw, -cosYaw];
    const right = [cosYaw, -sinYaw];

    let mx = 0, mz = 0;

    if (!this.isTransitioning) {
      if (this.keys.has('w') || this.keys.has('arrowup')) { mx += forward[0]; mz += forward[1]; }
      if (this.keys.has('s') || this.keys.has('arrowdown')) { mx -= forward[0]; mz -= forward[1]; }
      if (this.keys.has('a') || this.keys.has('arrowleft')) { mx -= right[0]; mz -= right[1]; }
      if (this.keys.has('d') || this.keys.has('arrowright')) { mx += right[0]; mz += right[1]; }

      if (this.joystick.dx || this.joystick.dy) {
        const jx = this.joystick.dx, jy = -this.joystick.dy;
        mx += forward[0] * jy + right[0] * jx;
        mz += forward[1] * jy + right[1] * jx;
      }

      if (mx || mz) {
        const len = Math.hypot(mx, mz);
        const speed = 0.085;
        const nx = this.playerPos[0] + mx / len * speed;
        const nz = this.playerPos[1] + mz / len * speed;

        if (this.canWalk(nx, nz)) this.playerPos = [nx, nz];
        else if (this.canWalk(nx, this.playerPos[1])) this.playerPos = [nx, this.playerPos[1]];
        else if (this.canWalk(this.playerPos[0], nz)) this.playerPos = [this.playerPos[0], nz];
      }
    }

    this.camera.position.set(this.playerPos[0], 1.7, this.playerPos[1]);
    const pitchCos = Math.cos(this.playerPitch);
    const pitchSin = Math.sin(this.playerPitch);
    this.camera.lookAt(
      this.camera.position.x + forward[0] * pitchCos,
      this.camera.position.y + pitchSin,
      this.camera.position.z + forward[1] * pitchCos
    );

    this.renderer.render(this.scene, this.camera);
  }

  pause() { this._running = false; }
  resume() { if (!this._running) { this._running = true; this.animate(); } }
  dispose() {
    this._generation++;
    this._running = false;
    if (this._controller) this._controller.abort();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}