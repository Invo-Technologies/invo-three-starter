/**
 * The arena: renderer, lights, floor, pillars and a bloom pass that makes the emissive
 * edges glow. Everything is built from code, so there are no asset files to manage.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ARENA_RADIUS, PILLARS } from "./logic.js";

export const COLORS = {
  ink: 0x07090c,
  gold: 0xf4c04a,
  teal: 0x3fd0c9,
  metal: 0x2b323e,
};

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  rim: THREE.Mesh;
  rimMaterial: THREE.MeshStandardMaterial;
  render(): void;
  resize(): void;
}

export function createWorld(container: HTMLElement): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.ink);
  scene.fog = new THREE.FogExp2(COLORS.ink, 0.028);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  camera.position.set(0, 10, 16);

  // Light: a cool sky, a warm key that casts shadows, and coloured rims.
  scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x0b0d11, 0.7));
  const key = new THREE.DirectionalLight(0xfff1d6, 1.6);
  key.position.set(8, 16, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -16;
  key.shadow.camera.right = key.shadow.camera.top = 16;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);
  const tealFill = new THREE.PointLight(COLORS.teal, 30, 30, 2);
  tealFill.position.set(-9, 4, -6);
  scene.add(tealFill);
  const goldFill = new THREE.PointLight(COLORS.gold, 24, 30, 2);
  goldFill.position.set(9, 3, 8);
  scene.add(goldFill);

  // The floor: a dark disc with a fine grid that fades towards the edge.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_RADIUS + 0.4, 96),
    new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.82, metalness: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS + 0.4, ARENA_RADIUS + 0.9, 0.8, 96, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x0f1218, roughness: 0.6, metalness: 0.5 }),
  );
  plinth.position.y = -0.4;
  scene.add(plinth);

  // The glowing rim, and gold arcs outside it.
  const rimMaterial = new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 1.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(ARENA_RADIUS + 0.35, 0.05, 12, 200), rimMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  scene.add(rim);
  const arcMaterial = new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 1.6 });
  for (let i = 0; i < 4; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(ARENA_RADIUS + 1.6, 0.035, 8, 64, Math.PI / 5), arcMaterial);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = (i / 4) * Math.PI * 2 + Math.PI / 10;
    arc.position.y = -0.2;
    scene.add(arc);
  }

  // Pillars: dark hexagonal columns with lit bands.
  const pillarMaterial = new THREE.MeshStandardMaterial({ color: COLORS.metal, roughness: 0.38, metalness: 0.55 });
  const bandMaterial = new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 1.4 });
  for (const p of PILLARS) {
    const pillar = new THREE.Group();
    const column = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.92, p.r, 3.4, 6), pillarMaterial);
    column.position.y = 1.7;
    column.castShadow = column.receiveShadow = true;
    pillar.add(column);
    for (const y of [0.25, 3.1]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(p.r * (y > 1 ? 0.95 : 1.02), 0.035, 6, 6), bandMaterial);
      band.rotation.x = Math.PI / 2;
      band.rotation.z = Math.PI / 6;
      band.position.y = y;
      pillar.add(band);
    }
    pillar.position.set(p.x, 0, p.z);
    scene.add(pillar);
  }

  // Distant motes for depth.
  const stars = new THREE.BufferGeometry();
  const pts: number[] = [];
  for (let i = 0; i < 600; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 30 + Math.random() * 50;
    pts.push(Math.cos(a) * r, -4 + Math.random() * 40, Math.sin(a) * r);
  }
  stars.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x8fd9d5, size: 0.12, transparent: true, opacity: 0.6, depthWrite: false })));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.45, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    // Keep the arena in frame on tall phone screens.
    camera.fov = w / h < 0.8 ? 62 : 48;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  return { renderer, scene, camera, composer, rim, rimMaterial, render: () => composer.render(), resize };
}

function gridTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const base = ctx.createRadialGradient(c, c, 0, c, c, c);
  base.addColorStop(0, "#232a35");
  base.addColorStop(1, "#0d1015");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.clip();
  const step = size / 26;
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 26; i++) {
    const v = i * step;
    ctx.strokeStyle = "rgba(63,208,201,0.16)";
    ctx.beginPath();
    ctx.moveTo(v, 0);
    ctx.lineTo(v, size);
    ctx.moveTo(0, v);
    ctx.lineTo(size, v);
    ctx.stroke();
  }
  for (const r of [0.33, 0.66]) {
    ctx.strokeStyle = "rgba(244,192,74,0.14)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c, c, c * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const fade = ctx.createRadialGradient(c, c, c * 0.55, c, c, c);
  fade.addColorStop(0, "rgba(13,16,21,0)");
  fade.addColorStop(1, "rgba(13,16,21,0.85)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
