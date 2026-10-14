/**
 * INVO: what the shop's items look like in the world. InvoItemAttachments adds each object
 * when the server confirms the player owns the item, rebuilds it when the quantity changes,
 * and removes it on sign-out. Add your own items here.
 */
import * as THREE from "three";
import { InvoItemAttachments, type InvoGameEconomy } from "@invonetwork/three";
import { ITEMS } from "../shared/economy.js";
import { pickupRadius } from "./logic.js";
import type { Player } from "./player.js";
import { COLORS } from "./world.js";

export function attachItems(economy: InvoGameEconomy, player: Player): { update(dt: number): void; dispose(): void } {
  const spinners: THREE.Object3D[] = [];

  // Worn on the drone: the Crown of Light.
  const worn = new InvoItemAttachments(economy, player.body).define(ITEMS.crown, () => crown(), {
    onEquip: (o) => {
      spinners.push(o);
      o.scale.setScalar(0.01);
    },
    onUnequip: (o) => spinners.splice(spinners.indexOf(o), 1),
  });

  // On the floor around the drone: the Shard Magnet's reach, one ring per level.
  const ground = new InvoItemAttachments(economy, player.anchor).define(ITEMS.magnet, (ctx) => magnetRings(ctx.quantity));

  return {
    update(dt) {
      for (const o of spinners) {
        o.rotation.y += dt * 0.9;
        o.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-dt * 6)); // grows in when bought
      }
      const rings = ground.get(ITEMS.magnet);
      if (rings) rings.rotation.z += dt * 0.25;
    },
    dispose() {
      worn.dispose();
      ground.dispose();
    },
  };
}

function crown(): THREE.Object3D {
  const gold = new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: COLORS.gold, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.25 });
  const group = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 12, 64), gold);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 10), gold);
    spike.position.set(Math.cos(a) * 0.34, 0.1, Math.sin(a) * 0.34);
    group.add(spike);
  }
  group.position.y = 0.95;
  return group;
}

function magnetRings(level: number): THREE.Object3D {
  const group = new THREE.Group();
  const reach = pickupRadius(level);
  for (let i = 1; i <= level; i++) {
    const r = 0.9 + ((reach - 0.9) * i) / level;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.03, r, 96, 1, 0, Math.PI * 1.7),
      new THREE.MeshBasicMaterial({ color: COLORS.teal, transparent: true, opacity: 0.5 - i * 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.z = i * 1.3;
    group.add(ring);
  }
  group.rotation.x = -Math.PI / 2;
  group.position.y = 0.03;
  return group;
}
