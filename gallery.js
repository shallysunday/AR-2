/* ==========================================================
   gallery.js — Three.js renderer for the procedural museum.
   Builds the all-white architectural model, doors, signs, 
   pedestals, lighting, and smooth room-jump transitions.
   ========================================================== */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { bestPlan, walkRects, mapPoint, artSlots, groupByClass, DOOR_W, WALL_T, CORR_L } from './gallery-layout.js';

export class ArchitecturalGallery {
  constructor(containerEl, onSelectArtwork) {
    this.container = containerEl;
    this.onSelectArtwork = onSelectArtwork;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.classes = [];
    this.plan = null;
    this.walkRects = [];
    
    // Player / Camera State
    this.playerPos = [0, 0];
    this.playerYaw = 0;
    this.currentRoomIndex = 0;
    this.isTransitioning = false;
    
    // Controls state
    this.keys = {};
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };

    this.init();
  }

  init() {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f4f6);
    this.scene.fog = new THREE.FogExp2(0xf4f4f6, 0.015);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(60, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
    
    // 3. Renderer setup with soft shadows
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting (Architectural soft studio lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // 5. Load Data & Build Geometry
    this.loadDataAndBuild();

    // 6. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.setupControls();

    // 7. Start Animation Loop
    this.animate();
  }

  loadDataAndBuild() {
    // Fetch items from localStorage (fallback to sample if empty)
    const raw = localStorage.getItem('artArchiveItems');
    let items = raw ? JSON.parse(raw) : [];
    
    if (items.length === 0) {
      items = [
        { title: "Cybernetic Vessel", studentName: "Jor Langit", lecturerName: "Dr. Aris", classCode: "DK202", className: "Advanced 3D Design", description: "Hard surface mech design study.", modelUrl: "https://modelviewer.dev/shared-assets/models/Astronaut.glb" },
        { title: "Nusantara Typface Poster", studentName: "Siti Rahma", lecturerName: "Prof. Melati", classCode: "TYP101", className: "Typography I", description: "Revival of Rencong script.", modelUrl: "https://modelviewer.dev/shared-assets/models/Astronaut.glb" }
      ];
    }

    this.classes = groupByClass(items);
    const counts = this.classes.map(c => c.items.length);

    // Generate Layout using layout math
    this.plan = bestPlan(counts);
    this.walkRects = walkRects(this.plan);

    // Build 3D World
    this.buildMuseumGeometry();
  }

  buildMuseumGeometry() {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe5e5eb, roughness: 0.8 });
    const wallHeight = 5.0;

    this.plan.entries.forEach((e, roomIdx) => {
      const { W, D, P, yaw } = e;
      const roomGroup = new THREE.Group();
      roomGroup.position.set(P[0], 0, P[1]);
      roomGroup.rotation.y = yaw;

      // Floor
      const floorGeo = new THREE.PlaneGeometry(W, D);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      roomGroup.add(floor);

      // Ceiling
      const ceilGeo = new THREE.PlaneGeometry(W, D);
      const ceiling = new THREE.Mesh(ceilGeo, whiteMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = wallHeight;
      roomGroup.add(ceiling);

      // Walls (North, South, East, West with door cutouts simplified as boxes)
      // For brevity in clean architectural mockup style, we build perimeter walls:
      this.buildWallsWithOpenings(roomGroup, W, D, wallHeight, whiteMat, e);

      // Add Class Sign over entrance/exit
      this.createRoomSign(roomGroup, W, D, wallHeight, this.classes[e.ci].name, this.classes[e.ci].code);

      // Place Artworks on pedestals
      const classData = this.classes[e.ci];
      const slots = artSlots(e, classData.items.length);

      classData.items.forEach((art, artIdx) => {
        const slot = slots[artIdx] || { x: 0, z: 0, yaw: 0 };
        this.createPedestalAndArtwork(roomGroup, slot, art);
      });

      this.scene.add(roomGroup);
    });
  }

  buildWallsWithOpenings(group, W, D, H, mat, roomMeta) {
    // Simplified perimeter box walls
    const t = WALL_T;
    const halfW = W / 2, halfD = D / 2;

    // North wall
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), mat);
    nWall.position.set(0, H/2, -halfD);
    nWall.castShadow = true; nWall.receiveShadow = true;
    group.add(nWall);

    // South wall
    const sWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, t), mat);
    sWall.position.set(0, H/2, halfD);
    sWall.castShadow = true; sWall.receiveShadow = true;
    group.add(sWall);

    // West wall
    const wWall = new THREE.Mesh(new THREE.BoxGeometry(t, H, D), mat);
    wWall.position.set(-halfW, H/2, 0);
    wWall.castShadow = true; wWall.receiveShadow = true;
    group.add(wWall);

    // East wall
    const eWall = new THREE.Mesh(new THREE.BoxGeometry(t, H, D), mat);
    eWall.position.set(halfW, H/2, 0);
    eWall.castShadow = true; eWall.receiveShadow = true;
    group.add(eWall);
  }

  createRoomSign(group, W, D, H, className, classCode) {
    // Simple floating architectural text placard mockup (can be enhanced with canvas texture)
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${classCode}: ${className}`, 256, 75);

    const texture = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: texture });
    const signGeo = new THREE.PlaneGeometry(3.6, 0.9);
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, H - 1.2, D / 2 - 0.05);
    group.add(sign);
  }

  createPedestalAndArtwork(group, slot, art) {
    const pedGroup = new THREE.Group();
    pedGroup.position.set(slot.x, 0, slot.z);

    // Minimalist white pedestal block
    const pedGeo = new THREE.BoxGeometry(0.8, 1.1, 0.8);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 });
    const pedestal = new THREE.Mesh(pedGeo, pedMat);
    pedestal.position.y = 0.55;
    pedestal.castShadow = true; pedestal.receiveShadow = true;
    pedGroup.add(pedestal);

    // Load 3D model or placeholder
    const loader = new GLTFLoader();
    loader.load(art.modelUrl || "https://modelviewer.dev/shared-assets/models/Astronaut.glb", (gltf) => {
      const model = gltf.scene;
      model.scale.set(0.6, 0.6, 0.6);
      model.position.set(0, 1.1, 0);
      model.traverse(node => { if (node.isMesh) { node.castShadow = true; } });
      pedGroup.add(model);
    }, undefined, () => {
      // Fallback shape if loading fails
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({color: 0x2563eb}));
      sphere.position.set(0, 1.5, 0);
      pedGroup.add(sphere);
    });

    // Store reference for click interaction
    pedGroup.userData = { art };
    group.add(pedGroup);
  }

  jumpToClass(classIndex) {
    if (this.isTransitioning) return;
    const targetEntry = this.plan.entries.find(e => e.ci === classIndex);
    if (!targetEntry) return;

    this.isTransitioning = true;
    // Smooth camera glide animation to target room coordinates
    const startX = this.playerPos[0], startZ = this.playerPos[1];
    const targetX = targetEntry.P[0], targetZ = targetEntry.P[1];
    let progress = 0;

    const transitionInterval = setInterval(() => {
      progress += 0.03;
      this.playerPos[0] = startX + (targetX - startX) * progress;
      this.playerPos[1] = startZ + (targetZ - startZ) * progress;

      if (progress >= 1) {
        clearInterval(transitionInterval);
        this.playerPos = [targetX, targetZ];
        this.isTransitioning = false;
      }
    }, 16);
  }

  setupControls() {
    // Basic mouse drag to look around
    this.container.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      this.playerYaw -= deltaX * 0.005;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => { this.isDragging = false; });
  }

  onWindowResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Update camera position based on playerPos
    this.camera.position.set(this.playerPos[0], 1.7, this.playerPos[1]);
    
    // Calculate look direction from playerYaw
    const lookDir = [Math.sin(this.playerYaw), 0, Math.cos(this.playerYaw)];
    this.camera.lookAt(this.camera.position.x - lookDir[0], this.camera.position.y, this.camera.position.z - lookDir[2]);

    this.renderer.render(this.scene, this.camera);
  }
}