/** Shards: crystals that appear around the arena, drift into reach, and burst when collected. */
import * as THREE from "three";
import { spawnPoint } from "./logic.js";
import { COLORS } from "./world.js";

const ACTIVE = 7;

interface Shard {
  mesh: THREE.Mesh;
  phase: number;
  pulled: boolean;
}

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  age: number;
}

export class Shards {
  private readonly shards: Shard[] = [];
  private readonly bursts: Burst[] = [];
  private readonly geometry = new THREE.OctahedronGeometry(0.3, 0);
  private readonly material = new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.15, flatShading: true });
  private t = 0;

  constructor(private readonly scene: THREE.Scene) {}

  /** Fill the arena, away from the player. */
  reset(player: { x: number; z: number }): void {
    for (const s of this.shards) this.scene.remove(s.mesh);
    this.shards.length = 0;
    for (let i = 0; i < ACTIVE; i++) this.spawn(player);
  }

  clear(): void {
    for (const s of this.shards) this.scene.remove(s.mesh);
    this.shards.length = 0;
  }

  /**
   * Animate, pull shards within `reach` towards the player, and collect any that arrive.
   * Returns the world positions of the shards collected this frame.
   */
  update(dt: number, player: { x: number; z: number }, reach: number, collecting: boolean): THREE.Vector3[] {
    this.t += dt;
    const collected: THREE.Vector3[] = [];
    for (const s of [...this.shards]) {
      const m = s.mesh;
      m.rotation.y += dt * 1.6;
      m.rotation.x = Math.sin(this.t + s.phase) * 0.4;
      const d = Math.hypot(m.position.x - player.x, m.position.z - player.z);
      if (collecting && d < reach) s.pulled = true;
      if (s.pulled) {
        const k = 1 - Math.exp(-dt * 9);
        m.position.x += (player.x - m.position.x) * k;
        m.position.z += (player.z - m.position.z) * k;
        m.position.y += (1.05 - m.position.y) * k;
        if (d < 0.45) {
          collected.push(m.position.clone());
          this.scene.remove(m);
          this.shards.splice(this.shards.indexOf(s), 1);
          this.burst(m.position);
          this.spawn(player);
        }
      } else {
        m.position.y = 0.75 + Math.sin(this.t * 2 + s.phase) * 0.18;
      }
    }
    this.updateBursts(dt);
    return collected;
  }

  private spawn(player: { x: number; z: number }): void {
    const p = spawnPoint(Math.random, player);
    const mesh = new THREE.Mesh(this.geometry, this.material);
    mesh.position.set(p.x, 0.75, p.z);
    mesh.castShadow = true;
    mesh.scale.setScalar(0.01);
    this.scene.add(mesh);
    const shard: Shard = { mesh, phase: Math.random() * Math.PI * 2, pulled: false };
    this.shards.push(shard);
    // Grow in.
    const grow = () => {
      mesh.scale.multiplyScalar(1.25);
      if (mesh.scale.x < 1) requestAnimationFrame(grow);
      else mesh.scale.setScalar(1);
    };
    requestAnimationFrame(grow);
  }

  private burst(at: THREE.Vector3): void {
    const count = 26;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions.set([at.x, at.y, at.z], i * 3);
      const dir = new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 3);
      velocities.set([dir.x, Math.abs(dir.y) + 1, dir.z], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: Math.random() < 0.5 ? 0xb6f5f1 : COLORS.gold, size: 0.12, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.scene.add(points);
    this.bursts.push({ points, velocities, age: 0 });
  }

  private updateBursts(dt: number): void {
    for (const b of [...this.bursts]) {
      b.age += dt;
      const pos = b.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        b.velocities[i * 3 + 1]! -= 9 * dt;
        pos.setXYZ(i, pos.getX(i) + b.velocities[i * 3]! * dt, Math.max(0.05, pos.getY(i) + b.velocities[i * 3 + 1]! * dt), pos.getZ(i) + b.velocities[i * 3 + 2]! * dt);
      }
      pos.needsUpdate = true;
      const material = b.points.material as THREE.PointsMaterial;
      material.opacity = Math.max(0, 1 - b.age / 0.7);
      if (b.age > 0.7) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        material.dispose();
        this.bursts.splice(this.bursts.indexOf(b), 1);
      }
    }
  }
}
