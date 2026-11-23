import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  bestPlan, walkRects, artSlots, groupByClass,
  worldOf, rot, DOOR_W, WALL_T, CORR_L
} from './gallery-layout.js';

const MAX_ARTWORKS_3D = 80;
const CONCURRENT_MODELS = 3;
const PLAQUE_W = 0.95, PLAQUE_H = 0.62;
const TALL_WALL_H = 40;

const CLASS_PASTEL_COLORS = {
  'IL101': '#F8C8DC',
  'PH101': '#B5EAD7',
  'AP201': '#FFE5B4',
  'AT201': '#DCD6F7',
  'Illustration': '#F8C8DC',
  'Ilustrasi Desain': '#F8C8DC',
  'Photography': '#B5EAD7',
  'Fotografi': '#B5EAD7',
  'Fotografi Iklan': '#B5EAD7',
  'Advertising Photography': '#FFE5B4',
  'Applied Typography': '#DCD6F7',
  'Tipografi Aplikatif': '#DCD6F7'
};

function makeSignCanvas(className, isExit = true) {
  const W = 768, H = 192;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.clearRect(0, 0, W, H);

  // Modern architectural portal lintel plaque
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(10, 10, W - 20, H - 20, 24);
  else ctx.rect(10, 10, W - 20, H - 20);
  ctx.fill();

  ctx.strokeStyle = '#1b1b1a';
  ctx.lineWidth = 4;
  ctx.stroke();

  const ink = '#1b1b1a';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = 72, cy = H / 2;
  if (isExit) {
    // Next room forward arrow
    ctx.beginPath();
    ctx.moveTo(cx, cy + 34); ctx.lineTo(cx, cy - 34); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy - 14); ctx.lineTo(cx, cy - 36); ctx.lineTo(cx + 20, cy - 14); ctx.stroke();
  } else {
    // Previous room return arrow
    ctx.beginPath();
    ctx.moveTo(cx + 16, cy + 30);
    ctx.lineTo(cx + 16, cy - 8);
    ctx.arc(cx, cy - 8, 16, 0, Math.PI, true);
    ctx.lineTo(cx - 16, cy + 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + 16); ctx.lineTo(cx - 16, cy + 32); ctx.lineTo(cx - 4, cy + 16); ctx.stroke();
  }

  const textX = 135;
  const textMaxW = W - textX - 32;
  const cleanName = (className || '').toUpperCase();

  // Find optimal large font size so class name is prominent and bold
  let fontSize = 44;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  while (ctx.measureText(cleanName).width > textMaxW && fontSize > 24) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }

  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(clamp(ctx, cleanName, textMaxW), textX, H / 2);

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
  ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
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
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
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
  c.width = 4; c.height = 512;
  const ctx = c.getContext('2d');

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

const FALLBACK_PASTELS = [
  '#F8C8DC', // pastel pink
  '#B5EAD7', // pastel mint green
  '#FFE5B4', // pastel peach
  '#DCD6F7', // pastel lavender
  '#FFDAC1', // pastel apricot
  '#E2F0CB', // pastel lime
  '#C7CEEA'  // pastel periwinkle
];

function getPastelColor(classKey, index = 0) {
  if (classKey && CLASS_PASTEL_COLORS[classKey]) {
    return CLASS_PASTEL_COLORS[classKey];
  }
  return FALLBACK_PASTELS[Math.abs(index) % FALLBACK_PASTELS.length];
}

function makeTunnelGradientTexture(colorA, colorB) {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Horizontal gradient: blend along tunnel from colorA (Room A) to colorB (Room B)
  const hGrad = ctx.createLinearGradient(0, 0, W, 0);
  hGrad.addColorStop(0, colorA);
  hGrad.addColorStop(1, colorB);
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, W, H);

  // Vertical highlight: arch vault crown is softly luminous, matching room walls
  const vGrad = ctx.createLinearGradient(0, 0, 0, H);
  vGrad.addColorStop(0, 'rgba(0, 0, 0, 0.04)');
  vGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0)');
  vGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
  vGrad.addColorStop(0.82, 'rgba(255, 255, 255, 0)');
  vGrad.addColorStop(1, 'rgba(0, 0, 0, 0.04)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, W, H);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

// ─── Wayfinder totem canvas: class name big + bold (Aspect ratio: 560x1840 -> 1:3.2857) ───
function makeWayfinderCanvas(className) {
  const W = 560, H = 1840;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.clearRect(0, 0, W, H);

  // Sleek dark museum monolith panel background
  ctx.fillStyle = '#141416';
  ctx.fillRect(0, 0, W, H);

  // Subtle interior frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  // Top emblem: Minimalist stylized gallery beacon
  const cx = W / 2;
  ctx.strokeStyle = '#c5a059'; // warm champagne gold
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, 130, 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#c5a059';
  ctx.beginPath();
  ctx.arc(cx, 130, 7, 0, Math.PI * 2);
  ctx.fill();

  // Top header text
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VIRTUAL ARCHIVE · DKV', cx, 185);

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 230); ctx.lineTo(W - 60, 230);
  ctx.stroke();

  // "CURRENT EXHIBITION" badge
  const badgeY = 320;
  ctx.fillStyle = 'rgba(197, 160, 89, 0.14)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(cx - 115, badgeY - 20, 230, 40, 20);
  else ctx.rect(cx - 115, badgeY - 20, 230, 40);
  ctx.fill();

  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CURRENT EXHIBITION', cx, badgeY);

  // Main Class Name in Bold, Clean Typography (dynamically word-wrapped so it never stretches or truncates)
  const cleanName = (className || 'Exhibition Hall').toUpperCase();
  const words = cleanName.split(' ');
  const lines = [];
  let currentLine = '';

  let fontSize = 50;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > W - 80) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  while (lines.some(l => ctx.measureText(l).width > W - 70) && fontSize > 26) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }

  const nameStartY = 500;
  const lineSpacing = fontSize * 1.25;
  ctx.fillStyle = '#ffffff';

  lines.forEach((l, i) => {
    ctx.fillText(l, cx, nameStartY + i * lineSpacing);
  });

  const lastLineY = nameStartY + (lines.length - 1) * lineSpacing;

  // Gold accent bar below class name
  const accentY = lastLineY + 55;
  ctx.fillStyle = '#c5a059';
  ctx.fillRect(cx - 45, accentY, 90, 4);

  // Minimalist floorplan compass glyph
  const glyphY = accentY + 230;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, glyphY, 65, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(cx - 90, glyphY); ctx.lineTo(cx + 90, glyphY);
  ctx.moveTo(cx, glyphY - 90); ctx.lineTo(cx, glyphY + 90);
  ctx.stroke();

  // 4 cardinal gallery door indicators
  ctx.fillStyle = '#c5a059';
  [
    [cx, glyphY - 65], // North
    [cx + 65, glyphY], // East
    [cx, glyphY + 65], // South
    [cx - 65, glyphY]  // West
  ].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Navigation instructions
  const guideY = glyphY + 220;
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('INTERACTIVE GALLERY', cx, guideY);

  ctx.fillStyle = '#8e8e93';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Walk up to any artwork to inspect', cx, guideY + 32);
  ctx.fillText('Look for overhead door signs to navigate', cx, guideY + 58);

  // Subtle bottom footer
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.beginPath();
  ctx.moveTo(60, H - 120); ctx.lineTo(W - 60, H - 120);
  ctx.stroke();

  ctx.fillStyle = '#52525b';
  ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DKV CURATED EXHIBITION · ROOM WAYFINDER', cx, H - 75);

  return c;
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
    this.isTransitioning = false;
    this._generation = 0;
  }

  async init() {
    this.scene = new THREE.Scene();
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
    const signGeo = new THREE.PlaneGeometry(3.2, 0.8);
    const pedestalGeo = new THREE.BoxGeometry(1.2, 1.1, 1.2);

    const signTextures = new Map();
    const plaqueTextures = new Map();
    const wallMaterials = new Map();
    const modelQueue = [];

    for (let i = 0; i < total; i++) {
      const entry = entries[i];
      const cls = this.classes[entry.ci];
      if (!cls) continue;

      const room = new THREE.Group();
      room.position.set(entry.P[0], 0, entry.P[1]);
      room.rotation.y = entry.yaw;

      const floorGeo = new THREE.PlaneGeometry(entry.W, entry.D);
      const floorUV = floorGeo.attributes.uv;
      for (let u = 0; u < floorUV.count; u++) {
        floorUV.setXY(u, floorUV.getX(u) * entry.W / 2, floorUV.getY(u) * entry.D / 2);
      }
      floorUV.needsUpdate = true;
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      room.add(floor);

      const pastelHex = CLASS_PASTEL_COLORS[cls.name] || CLASS_PASTEL_COLORS[cls.code] || getPastelColor(cls.name, entry.ci);
      const wallKey = cls.name || cls.code;
      if (!wallMaterials.has(wallKey)) {
        wallMaterials.set(wallKey, new THREE.MeshLambertMaterial({
          map: makeWallGradientTexture(pastelHex),
          transparent: true,
          side: THREE.DoubleSide
        }));
      }
      const wallMat = wallMaterials.get(wallKey);

      this.buildWalls(room, entry, H, wallMat);
      this.createFloatingLighting(room, entry.W, entry.D);
      this.addRoomDecor(room, entry, cls.name);

      // Sign on top of exit door leading to next room
      const nextCi = (entry.ci + 1) % this.classes.length;
      const nextCls = this.classes[nextCi] || cls;
      this.createDoorSign(room, entry.exit.side, entry.exit.pos, nextCls.name, true, signGeo, signTextures);

      // Sign on top of entry door leading to previous room (South wall: [0, entry.D / 2])
      const prevCi = (entry.ci - 1 + this.classes.length) % this.classes.length;
      const prevCls = this.classes[prevCi] || cls;
      this.createDoorSign(room, 'S', [0, entry.D / 2], prevCls.name, false, signGeo, signTextures);

      const slots = artSlots(entry, cls.items);
      cls.items.forEach((art, idx) => {
        const slot = slots[idx];
        if (!slot) return;
        if (slot.is2D) {
          this.createWallFramedArtwork(room, slot, art, plaqueGeo, plaqueTextures);
          this._addRopeBarrier(room, slot);
        } else {
          this.createPedestal(room, slot, art, pedestalGeo, pedestalMat, plaqueGeo, plaqueTextures, modelQueue);
        }
      });

      this.scene.add(room);
    }

    this.buildCorridors(this.plan.corridors, floorMat);
    if (modelQueue.length) this._loadModelsInBackground(modelQueue);
  }

  createFloatingLighting(room, W, D) {
    const lightGroup = new THREE.Group();
    lightGroup.position.set(0, 5.5, 0);

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

  /**
   * Add room decorations: architectural plants in corners and central minimalist wayfinder totem.
   * (Artwork picture lamps are mounted directly above every artwork).
   */
  addRoomDecor(room, entry, className) {
    const { W, D } = entry;
    this._addCornerPlants(room, W, D);
    this._addWayfinderTotem(room, className);
  }

  _addCornerPlants(room, W, D) {
    const inset = 1.4;
    const corners = [
      [-W / 2 + inset, -D / 2 + inset, Math.PI * 0.25],
      [ W / 2 - inset, -D / 2 + inset, -Math.PI * 0.25],
      [-W / 2 + inset,  D / 2 - inset, Math.PI * 0.75],
      [ W / 2 - inset,  D / 2 - inset, -Math.PI * 0.75],
    ];

    // Shared materials for architectural fiddle-leaf fig in ceramic planter
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3427, roughness: 0.7 });
    const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.25 });
    const soilMat = new THREE.MeshLambertMaterial({ color: 0x2b1e17 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a483a, roughness: 0.8 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d5a34, roughness: 0.5 });
    const leafMatDark = new THREE.MeshStandardMaterial({ color: 0x1d4a27, roughness: 0.35, side: THREE.DoubleSide });
    const leafMatLight = new THREE.MeshStandardMaterial({ color: 0x2e6b3b, roughness: 0.35, side: THREE.DoubleSide });

    // Sculpted organic leaf geometry with 3D curvature
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.16, 0.22, 0.20, 0.50);
    leafShape.quadraticCurveTo(0.12, 0.80, 0, 0.95);
    leafShape.quadraticCurveTo(-0.12, 0.80, -0.20, 0.50);
    leafShape.quadraticCurveTo(-0.16, 0.22, 0, 0);

    const baseLeafGeo = new THREE.ShapeGeometry(leafShape, 8);
    const pos = baseLeafGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      pos.setZ(i, -0.06 * Math.sin((y / 0.95) * Math.PI) + 0.12 * Math.abs(x));
    }
    baseLeafGeo.computeVertexNormals();

    for (const [cx, cz, baseAngle] of corners) {
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      g.rotation.y = baseAngle;

      // 1. Scandinavian Walnut Plant Stand
      const legR = 0.014;
      const legH = 0.42;
      const legDist = 0.21;
      const legGeo = new THREE.CylinderGeometry(legR, legR, legH, 10);

      const legPositions = [
        [-legDist, -legDist], [legDist, -legDist],
        [-legDist, legDist], [legDist, legDist]
      ];
      legPositions.forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(lx, legH / 2, lz);
        g.add(leg);
      });

      // Cross-bracing
      const crossGeo = new THREE.BoxGeometry(legDist * 2, 0.024, 0.024);
      const cross1 = new THREE.Mesh(crossGeo, woodMat);
      cross1.position.set(0, 0.22, 0);
      g.add(cross1);

      const cross2 = new THREE.Mesh(crossGeo, woodMat);
      cross2.rotation.y = Math.PI / 2;
      cross2.position.set(0, 0.22, 0);
      g.add(cross2);

      // 2. Matte Porcelain Planter Pot
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.20, 0.46, 24),
        ceramicMat
      );
      pot.position.y = 0.44;
      g.add(pot);

      // Top rim ring
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.014, 12, 24),
        ceramicMat
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.67;
      g.add(rim);

      // Potting soil
      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.23, 0.03, 20),
        soilMat
      );
      soil.position.y = 0.65;
      g.add(soil);

      // 3. Trunk & Branches
      const trunk1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.035, 0.55, 10),
        trunkMat
      );
      trunk1.position.set(0, 0.90, 0);
      g.add(trunk1);

      const branches = [
        { dx: -0.12, dy: 1.35, dz: -0.08, rx: -0.35, rz: 0.45, len: 0.50 },
        { dx:  0.14, dy: 1.40, dz: -0.05, rx: -0.20, rz: -0.50, len: 0.55 },
        { dx: -0.05, dy: 1.50, dz:  0.15, rx:  0.50, rz: 0.20, len: 0.48 },
        { dx:  0.02, dy: 1.65, dz: -0.02, rx:  0.10, rz: -0.15, len: 0.60 }
      ];

      branches.forEach(b => {
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.022, b.len, 8),
          stemMat
        );
        stem.position.set(b.dx * 0.6, b.dy - b.len * 0.35, b.dz * 0.6);
        stem.rotation.set(b.rx * 0.7, 0, b.rz * 0.7);
        g.add(stem);
      });

      // 4. Layered Realistic Foliage (14 sculpted leaves)
      const leafConfigs = [
        { x: -0.32, y: 1.25, z: -0.18, rx: 0.8, ry: -1.2, rz: -0.3, s: 0.85, dark: true },
        { x:  0.34, y: 1.28, z: -0.12, rx: 0.7, ry:  1.4, rz:  0.4, s: 0.88, dark: true },
        { x: -0.18, y: 1.35, z:  0.30, rx: -0.7, ry: 2.8, rz: -0.5, s: 0.82, dark: true },
        { x:  0.22, y: 1.38, z:  0.28, rx: -0.6, ry: -2.5, rz:  0.4, s: 0.85, dark: true },
        { x: -0.28, y: 1.55, z:  0.02, rx: 0.5, ry: -1.6, rz: -0.2, s: 0.95, dark: false },
        { x:  0.30, y: 1.58, z:  0.08, rx: 0.4, ry:  1.1, rz:  0.3, s: 0.96, dark: false },
        { x:  0.05, y: 1.62, z: -0.32, rx: 0.9, ry:  0.1, rz: -0.1, s: 0.90, dark: true },
        { x: -0.06, y: 1.68, z:  0.32, rx: -0.8, ry: 3.1, rz:  0.2, s: 0.92, dark: false },
        { x: -0.20, y: 1.82, z: -0.16, rx: 0.6, ry: -0.8, rz: -0.3, s: 0.88, dark: false },
        { x:  0.18, y: 1.85, z: -0.18, rx: 0.5, ry:  0.7, rz:  0.2, s: 0.85, dark: false },
        { x: -0.12, y: 1.92, z:  0.18, rx: -0.5, ry: 2.4, rz: -0.2, s: 0.82, dark: false },
        { x:  0.14, y: 1.95, z:  0.16, rx: -0.4, ry: -2.2, rz:  0.3, s: 0.84, dark: false },
        { x: -0.04, y: 2.12, z: -0.06, rx: 0.3, ry: -0.4, rz: -0.1, s: 0.72, dark: false },
        { x:  0.05, y: 2.15, z:  0.04, rx: -0.3, ry:  1.8, rz:  0.2, s: 0.68, dark: false }
      ];

      leafConfigs.forEach(cfg => {
        const leafMesh = new THREE.Mesh(
          baseLeafGeo,
          cfg.dark ? leafMatDark : leafMatLight
        );
        leafMesh.position.set(cfg.x, cfg.y, cfg.z);
        leafMesh.rotation.set(cfg.rx, cfg.ry, cfg.rz);
        leafMesh.scale.set(cfg.s, cfg.s, cfg.s);
        g.add(leafMesh);
      });

      room.add(g);
    }
  }

  _addWayfinderTotem(room, className) {
    const g = new THREE.Group();
    g.position.set(0, 0, 0);

    const totemW = 0.64;
    const totemH = 2.18;
    const totemD = 0.12;

    // 1. Recessed dark floor reveal / shadow-gap base
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f0f12, roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.08), baseMat);
    base.position.y = 0.025;
    g.add(base);

    // 2. Minimalist Monolith Body: Deep matte charcoal basalt
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.32,
      metalness: 0.15
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(totemW, totemH, totemD), bodyMat);
    body.position.y = 0.05 + totemH / 2;
    g.add(body);

    // 3. Top brushed titanium metal cap
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.2,
      metalness: 0.6
    });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(totemW + 0.006, 0.015, totemD + 0.006), capMat);
    cap.position.y = 0.05 + totemH + 0.0075;
    g.add(cap);

    // 4. Front & Back Wayfinding Panels (EXACT Aspect Ratio: 0.56 / 1.84 matches 560x1840 canvas)
    const panelW = 0.56;
    const panelH = 1.84;
    const tex = new THREE.CanvasTexture(makeWayfinderCanvas(className));
    tex.colorSpace = THREE.SRGBColorSpace;

    const faceGeo = new THREE.PlaneGeometry(panelW, panelH);
    const faceMat = new THREE.MeshBasicMaterial({ map: tex });

    const faceZ = totemD / 2 + 0.002;

    // Front face (facing South / entry)
    const frontFace = new THREE.Mesh(faceGeo, faceMat);
    frontFace.position.set(0, 0.05 + totemH / 2, faceZ);
    g.add(frontFace);

    // Back face (facing North / exit)
    const backFace = new THREE.Mesh(faceGeo, faceMat);
    backFace.position.set(0, 0.05 + totemH / 2, -faceZ);
    backFace.rotation.y = Math.PI;
    g.add(backFace);

    // Subtle warm ambient floor glow at base
    const totemLight = new THREE.PointLight(0xfff5ea, 5, 5, 2.0);
    totemLight.position.set(0, 1.4, 0);
    g.add(totemLight);

    room.add(g);
  }

  /**
   * Add a rope barrier in front of a wall artwork slot.
   * Two low brass posts with a catenary red velvet rope between them.
   */
  _addRopeBarrier(room, slot) {
    const postMat = new THREE.MeshLambertMaterial({ color: 0xb8963c }); // brass
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0x8b1a1a }); // deep red velvet rope

    // The artwork's yaw points INTO the wall (facing viewer).
    // "Forward" into the room from the artwork = wall inward direction.
    // yaw=0 (N wall) → faces +Z; yaw=PI (S wall) → faces -Z etc.
    const fwdOffset = 1.3;  // metres in front of wall
    const halfW = 0.75;     // half-span of rope (1.5m total barrier width)

    // Forward direction in room XZ (from wall inward toward room centre)
    const fwdX = Math.sin(slot.yaw) * fwdOffset;
    const fwdZ = Math.cos(slot.yaw) * fwdOffset;

    // Perpendicular direction (barrier spans left-right relative to artwork face)
    const perpX =  Math.cos(slot.yaw) * halfW;
    const perpZ = -Math.sin(slot.yaw) * halfW;

    const postH = 1.1;
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, postH, 10);
    const knobGeo = new THREE.SphereGeometry(0.055, 10, 8);

    for (const side of [-1, 1]) {
      const px = slot.x + fwdX + perpX * side;
      const pz = slot.z + fwdZ + perpZ * side;

      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, postH / 2, pz);
      room.add(post);

      const knob = new THREE.Mesh(knobGeo, postMat);
      knob.position.set(px, postH, pz);
      room.add(knob);
    }

    // Rope tube from left to right post with a gentle sag
    const p1x = slot.x + fwdX - perpX;
    const p1z = slot.z + fwdZ - perpZ;
    const p2x = slot.x + fwdX + perpX;
    const p2z = slot.z + fwdZ + perpZ;

    const ropePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(p1x, postH - 0.08, p1z),
      new THREE.Vector3((p1x + p2x) / 2, postH - 0.14, (p1z + p2z) / 2),
      new THREE.Vector3(p2x, postH - 0.08, p2z),
    ]);
    const ropeGeo = new THREE.TubeGeometry(ropePath, 16, 0.025, 8, false);
    room.add(new THREE.Mesh(ropeGeo, ropeMat));
  }

  buildArchedTunnel(length) {
    const r = DOOR_W / 2;
    const springY = 5.0 - r; // 3.2
    const z0 = -0.05, z1 = length + 0.05;

    // Cross-section profile points: left floor up through arch and down to right floor
    const profile = [];
    const wallSegs = 6;
    for (let i = 0; i <= wallSegs; i++) {
      profile.push({ x: -r, y: springY * (i / wallSegs) });
    }
    const archSegs = 20;
    for (let i = 1; i < archSegs; i++) {
      const theta = Math.PI - (Math.PI * i / archSegs);
      profile.push({
        x: r * Math.cos(theta),
        y: springY + r * Math.sin(theta)
      });
    }
    for (let i = 0; i <= wallSegs; i++) {
      profile.push({ x: r, y: springY * (1 - i / wallSegs) });
    }

    const P = profile.length;
    const lengthSegs = 16;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let j = 0; j <= lengthSegs; j++) {
      const tz = j / lengthSegs;
      const z = z0 + tz * (z1 - z0);
      const u = tz;

      for (let i = 0; i < P; i++) {
        const p = profile[i];
        positions.push(p.x, p.y, z);
        const v = i / (P - 1);
        uvs.push(u, v);
      }
    }

    for (let j = 0; j < lengthSegs; j++) {
      for (let i = 0; i < P - 1; i++) {
        const a = j * P + i;
        const b = (j + 1) * P + i;
        const c = (j + 1) * P + (i + 1);
        const d = j * P + (i + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  buildCorridors(corridors, floorMat) {
    corridors.forEach(corr => {
      if (!corr.len || corr.closed) return;

      const fromCi = corr.fromCi ?? 0;
      const toCi = corr.toCi ?? ((fromCi + 1) % this.classes.length);

      const fromClass = this.classes[fromCi];
      const toClass = this.classes[toCi];

      const colorA = getPastelColor(fromClass?.name || fromClass?.code, fromCi);
      const colorB = getPastelColor(toClass?.name || toClass?.code, toCi);

      const tunnelMat = new THREE.MeshLambertMaterial({
        map: makeTunnelGradientTexture(colorA, colorB),
        side: THREE.DoubleSide
      });

      const group = new THREE.Group();
      const angle = Math.atan2(corr.d[0], corr.d[1]);
      group.position.set(corr.E[0], 0, corr.E[1]);
      group.rotation.y = angle;

      const floorGeo = new THREE.PlaneGeometry(DOOR_W, corr.len);
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(0, 0, corr.len / 2);
      group.add(floorMesh);

      // Continuous arch extending across the entire tunnel from door to door
      const tunnelGeo = this.buildArchedTunnel(corr.len);
      const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
      group.add(tunnelMesh);

      // Subtle ambient illumination inside tunnel
      const tunnelLight = new THREE.PointLight(0xfff5ea, 12, 10, 1.5);
      tunnelLight.position.set(0, 3.5, corr.len / 2);
      group.add(tunnelLight);

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

  createDoorSign(group, wallSide, doorPos, name, isExit, geometry, cache) {
    const cacheKey = `${isExit ? 'exit' : 'entry'}_${name}`;
    if (!cache.has(cacheKey)) {
      const texture = new THREE.CanvasTexture(makeSignCanvas(name, isExit));
      texture.colorSpace = THREE.SRGBColorSpace;
      cache.set(cacheKey, texture);
    }

    const sign = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: cache.get(cacheKey), transparent: true }));
    const wallInset = WALL_T / 2 + 0.04;
    const signY = 5.55; // Mounted on top of the door arch (peak is at 5.0m)

    if (wallSide === 'S') {
      sign.position.set(doorPos[0], signY, doorPos[1] - wallInset);
      sign.rotation.y = Math.PI; // Facing into room (-z)
    } else if (wallSide === 'N') {
      sign.position.set(doorPos[0], signY, doorPos[1] + wallInset);
      sign.rotation.y = 0; // Facing into room (+z)
    } else if (wallSide === 'W') {
      sign.position.set(doorPos[0] + wallInset, signY, doorPos[1]);
      sign.rotation.y = Math.PI / 2; // Facing into room (+x)
    } else if (wallSide === 'E') {
      sign.position.set(doorPos[0] - wallInset, signY, doorPos[1]);
      sign.rotation.y = -Math.PI / 2; // Facing into room (-x)
    }
    group.add(sign);
  }

  /**
   * 2D Artwork Frame Generator with Aspect Ratio Preservation
   * Prevents stretching or squishing by inspecting texture dimensions.
   */
  createWallFramedArtwork(group, slot, art, plaqueGeometry, plaqueCache) {
    const artGroup = new THREE.Group();
    artGroup.position.set(slot.x, 2.2, slot.z);
    artGroup.rotation.y = slot.yaw;
    artGroup.userData = { art };

    const borderT = 0.1;
    const maxInnerW = 2.4;
    const maxInnerH = 2.6;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
    const canvasMat = new THREE.MeshBasicMaterial();

    const frameMesh = new THREE.Mesh(new THREE.BufferGeometry(), frameMat);
    const canvasMesh = new THREE.Mesh(new THREE.BufferGeometry(), canvasMat);
    artGroup.add(frameMesh);
    artGroup.add(canvasMesh);

    const plaqueKey = art.id || art.title || Math.random().toString(36);
    if (!plaqueCache.has(plaqueKey)) {
      const texture = new THREE.CanvasTexture(makePlaqueCanvas(art));
      texture.colorSpace = THREE.SRGBColorSpace;
      plaqueCache.set(plaqueKey, texture);
    }
    const plaqueMesh = new THREE.Mesh(plaqueGeometry, new THREE.MeshBasicMaterial({ map: plaqueCache.get(plaqueKey) }));
    artGroup.add(plaqueMesh);

    // Gallery Picture Lamp Fixture mounted directly on top of the artwork
    const lampGroup = new THREE.Group();
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x1f1f23, roughness: 0.35, metalness: 0.8 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfffae8 });

    // Wall mounting plate
    const lampBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.035), lampMat);
    lampGroup.add(lampBase);

    // Twin curved support arms extending out over the frame
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.36, 8), lampMat);
    armL.rotation.x = Math.PI / 2;
    armL.position.set(-0.16, -0.02, 0.18);
    lampGroup.add(armL);

    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.36, 8), lampMat);
    armR.rotation.x = Math.PI / 2;
    armR.position.set(0.16, -0.02, 0.18);
    lampGroup.add(armR);

    // Horizontal lamp bar & warm emissive light strip (geometry sized in updateFrameDimensions)
    const lampBarMesh = new THREE.Mesh(new THREE.BufferGeometry(), lampMat);
    lampBarMesh.rotation.z = Math.PI / 2;
    lampBarMesh.position.set(0, -0.035, 0.36);
    lampGroup.add(lampBarMesh);

    const lampGlow = new THREE.Mesh(new THREE.BufferGeometry(), lampGlowMat);
    lampGlow.rotation.x = Math.PI / 2;
    lampGlow.position.set(0, -0.052, 0.36);
    lampGroup.add(lampGlow);

    // Downward spotlight focused directly on the artwork canvas
    const artSpot = new THREE.SpotLight(0xfff3db, 6.0, 4.5, Math.PI / 3.2, 0.5, 1.2);
    artSpot.position.set(0, -0.055, 0.36);
    artSpot.target.position.set(0, -1.0, 0.05);
    lampGroup.add(artSpot);
    lampGroup.add(artSpot.target);

    artGroup.add(lampGroup);

    const updateFrameDimensions = (aspectRatio) => {
      let w = maxInnerW;
      let h = w / aspectRatio;
      if (h > maxInnerH) {
        h = maxInnerH;
        w = h * aspectRatio;
      }
      const frameW = w + borderT * 2;
      const frameH = h + borderT * 2;
      const frameD = 0.08;

      if (frameMesh.geometry) frameMesh.geometry.dispose();
      if (canvasMesh.geometry) canvasMesh.geometry.dispose();

      frameMesh.geometry = new THREE.BoxGeometry(frameW, frameH, frameD);
      canvasMesh.geometry = new THREE.PlaneGeometry(w, h);
      canvasMesh.position.z = frameD / 2 + 0.005;

      plaqueMesh.position.set(frameW / 2 + PLAQUE_W / 2 + 0.08, -frameH / 2 + PLAQUE_H / 2 + 0.05, 0.02);

      // Position lamp directly on top of the frame
      const lampY = frameH / 2 + 0.20;
      lampGroup.position.set(0, lampY, 0);

      const barLen = Math.min(1.4, Math.max(0.65, frameW * 0.62));
      if (lampBarMesh.geometry) lampBarMesh.geometry.dispose();
      lampBarMesh.geometry = new THREE.CylinderGeometry(0.02, 0.02, barLen, 12);

      if (lampGlow.geometry) lampGlow.geometry.dispose();
      lampGlow.geometry = new THREE.PlaneGeometry(barLen * 0.88, 0.02);

      artSpot.target.position.set(0, -frameH * 0.4, 0.05);
    };

    if (art.thumbnail) {
      new THREE.TextureLoader().load(
        art.thumbnail,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          canvasMat.map = texture;
          canvasMat.needsUpdate = true;
          const img = texture.image;
          if (img && img.width && img.height) {
            updateFrameDimensions(img.width / img.height);
          } else {
            updateFrameDimensions(512 / 640);
          }
        },
        undefined,
        () => {
          const fallbackTex = new THREE.CanvasTexture(make2DArtworkCanvas(art));
          fallbackTex.colorSpace = THREE.SRGBColorSpace;
          canvasMat.map = fallbackTex;
          canvasMat.needsUpdate = true;
          updateFrameDimensions(512 / 640);
        }
      );
    } else {
      const canvasTex = new THREE.CanvasTexture(make2DArtworkCanvas(art));
      canvasTex.colorSpace = THREE.SRGBColorSpace;
      canvasMat.map = canvasTex;
      updateFrameDimensions(512 / 640);
    }

    group.add(artGroup);
  }

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

    // Gallery overhead spotlight mounted directly above the 3D sculpture pedestal
    const spotFixture = new THREE.Group();
    spotFixture.position.set(0, 3.8, 0);

    const fixtureMount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0x1f1f23, roughness: 0.35, metalness: 0.8 })
    );
    spotFixture.add(fixtureMount);

    const fixtureGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.065, 12),
      new THREE.MeshBasicMaterial({ color: 0xfffae8 })
    );
    fixtureGlow.rotation.x = Math.PI / 2;
    fixtureGlow.position.y = -0.071;
    spotFixture.add(fixtureGlow);

    const pedestalSpot = new THREE.SpotLight(0xfff3db, 6.5, 4.8, Math.PI / 3.4, 0.45, 1.2);
    pedestalSpot.position.set(0, -0.075, 0);
    pedestalSpot.target.position.set(0, -2.5, 0);
    spotFixture.add(pedestalSpot);
    spotFixture.add(pedestalSpot.target);

    pedestalGroup.add(spotFixture);

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

  computePath(fromIndex, toIndex) {
    const entries = this.plan.entries;
    if (fromIndex === toIndex) return [this.playerPos];

    const entranceOf = entry => worldOf(entry.P, entry.yaw, [0, entry.D / 2]);
    const exitOf = entry => worldOf(entry.P, entry.yaw, entry.exit.pos);
    const points = [this.playerPos.slice()];

    if (fromIndex < toIndex) {
      points.push(exitOf(entries[fromIndex]));
      for (let k = fromIndex; k < toIndex; k++) {
        points.push(entranceOf(entries[k + 1]));
        if (k + 1 < toIndex) points.push(exitOf(entries[k + 1]));
      }
      points.push([entries[toIndex].P[0], entries[toIndex].P[1]]);
    } else {
      points.push(entranceOf(entries[fromIndex]));
      for (let k = fromIndex - 1; k >= toIndex; k--) {
        points.push(exitOf(entries[k]));
        if (k > toIndex) points.push(entranceOf(entries[k]));
      }
      points.push([entries[toIndex].P[0], entries[toIndex].P[1]]);
    }

    return points;
  }

  get currentEntryIdx() {
    for (let i = 0; i < this.plan.entries.length; i++) {
      const entry = this.plan.entries[i];
      const dx = this.playerPos[0] - entry.P[0];
      const dz = this.playerPos[1] - entry.P[1];
      const c = Math.cos(-entry.yaw);
      const s = Math.sin(-entry.yaw);
      const lx = dx * c + dz * s;
      const lz = -dx * s + dz * c;

      if (Math.abs(lx) <= entry.W / 2 + 1 && Math.abs(lz) <= entry.D / 2 + 1) return i;
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
          [this.plan.entries[targetIndex].P[0], this.plan.entries[targetIndex].P[1]]
        ];

    if (waypoints.length < 2) return;

    const lengths = [];
    let totalLength = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const len = Math.hypot(waypoints[i][0] - waypoints[i - 1][0], waypoints[i][1] - waypoints[i - 1][1]);
      lengths.push(len);
      totalLength += len;
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

      if (t < 1) requestAnimationFrame(step);
      else this.isTransitioning = false;
    };

    requestAnimationFrame(step);
  }

  checkLoopTeleport() {
    const entries = this.plan.entries;
    if (!entries || !entries.length) return;

    const pre = entries.find(entry => entry.role === 'pre');
    const post = entries.find(entry => entry.role === 'post');
    if (!pre || !post) return;

    const inside = entry => {
      const dx = this.playerPos[0] - entry.P[0];
      const dz = this.playerPos[1] - entry.P[1];
      const c = Math.cos(-entry.yaw);
      const s = Math.sin(-entry.yaw);
      const lx = dx * c + dz * s;
      const lz = -dx * s + dz * c;
      return (Math.abs(lx) <= entry.W / 2 - 0.3 && Math.abs(lz) <= entry.D / 2 - 0.3);
    };

    if (inside(pre)) {
      const lastMain = entries.find(e => e.role === 'main' && e.ci === this.classes.length - 1);
      if (lastMain) this.teleportBetween(pre, lastMain);
    } else if (inside(post)) {
      const firstMain = entries.find(e => e.role === 'main' && e.ci === 0);
      if (firstMain) this.teleportBetween(post, firstMain);
    }
  }

  teleportBetween(fromEntry, toEntry) {
    const local = rot([this.playerPos[0] - fromEntry.P[0], this.playerPos[1] - fromEntry.P[1]], -fromEntry.yaw);
    const world = rot(local, toEntry.yaw);

    this.playerPos = [toEntry.P[0] + world[0], toEntry.P[1] + world[1]];
    this.playerYaw += toEntry.yaw - fromEntry.yaw;
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

        this.checkLoopTeleport();
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