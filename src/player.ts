/** The player: a hovering drone with a lit visor. Moves on the floor, tilts into its turns. */
import * as THREE from "three";
import { model } from "./assets.js";
import { resolveCollision } from "./logic.js";
import { COLORS } from "./world.js";

const SPEED = 7.5;

export class Player {
  /** Follows the player on the floor (x/z only): ground effects attach here. */
  readonly anchor = new THREE.Group();
  /** The drone itself (bobs and tilts): worn items attach here. */
  readonly body = new THREE.Group();
  readonly velocity = new THREE.Vector2();
  private t = 0;
  private heading = 0;

  constructor(scene: THREE.Scene) {
    const custom = model("player");
    if (custom) {
      this.body.add(custom);
    } else {
      const shell = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 0.5, 8, 24),
        new THREE.MeshPhysicalMaterial({ color: 0x5a6578, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }),
      );
      shell.castShadow = true;
      const visor = new THREE.Mesh(
        new THREE.TorusGeometry(0.43, 0.055, 10, 48, Math.PI * 1.1),
        new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 2 }),
      );
      visor.rotation.set(Math.PI / 2, 0, Math.PI * 0.95 + Math.PI / 2);
      visor.position.y = 0.18;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: COLORS.teal, emissiveIntensity: 2.5 }));
      eye.position.set(0, 0.18, 0.43);
      const thruster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.26, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 1.2 }),
      );
      thruster.position.y = -0.72;
      this.body.add(shell, visor, eye, thruster);
    }
    // A soft pool of light under the drone.
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 48),
      new THREE.MeshBasicMaterial({ color: COLORS.teal, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.015;
    this.anchor.add(glow);
    this.body.scale.setScalar(1.18);
    this.body.position.y = 1.05;
    this.body.rotation.order = "YXZ"; // turn, then lean in the drone's own frame
    this.anchor.add(this.body);
    scene.add(this.anchor);
  }

  get position(): { x: number; z: number } {
    return { x: this.anchor.position.x, z: this.anchor.position.z };
  }

  reset(): void {
    this.anchor.position.set(0, 0, 3);
    this.velocity.set(0, 0);
    this.heading = Math.PI;
  }

  /** Move by an input direction (-1..1 on each axis, screen-relative: up is away from camera). */
  update(dt: number, input: { x: number; y: number }, active: boolean): void {
    this.t += dt;
    const target = active ? new THREE.Vector2(input.x, input.y) : new THREE.Vector2(); // screen up = away from the camera (-z)
    if (target.lengthSq() > 1) target.normalize();
    target.multiplyScalar(SPEED);
    this.velocity.lerp(target, 1 - Math.exp(-dt * 10));
    const next = resolveCollision(this.anchor.position.x + this.velocity.x * dt, this.anchor.position.z + this.velocity.y * dt);
    this.anchor.position.x = next.x;
    this.anchor.position.z = next.z;

    const speed = this.velocity.length();
    if (speed > 0.3) this.heading = Math.atan2(this.velocity.x, this.velocity.y);
    this.body.rotation.y = lerpAngle(this.body.rotation.y, this.heading, 1 - Math.exp(-dt * 12));
    // Lean into the motion, and hover.
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, (speed / SPEED) * 0.28, 1 - Math.exp(-dt * 8));
    this.body.position.y = 1.05 + Math.sin(this.t * 2.4) * 0.07;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}
