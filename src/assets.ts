/**
 * The asset loader. The template draws everything in code, so the list below starts empty.
 * To use real art: put a .glb in `public/models/`, add it to MODELS, and read it with
 * `model("player")` where the game builds that object (each call returns a fresh clone).
 */
import { LoadingManager, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const MODELS: Array<{ key: string; url: string }> = [
  // { key: "player", url: "/models/player.glb" },
];

const loaded = new Map<string, Object3D>();

/** Load everything in MODELS, reporting progress from 0 to 1. */
export async function loadAssets(onProgress: (fraction: number) => void): Promise<void> {
  if (!MODELS.length) {
    onProgress(1);
    return;
  }
  const manager = new LoadingManager();
  manager.onProgress = (_url, done, total) => onProgress(done / total);
  const loader = new GLTFLoader(manager);
  await Promise.all(
    MODELS.map(async ({ key, url }) => {
      const gltf = await loader.loadAsync(url);
      gltf.scene.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
      loaded.set(key, gltf.scene);
    }),
  );
}

/** A fresh copy of a loaded model, or undefined when it is not in MODELS. */
export function model(key: string): Object3D | undefined {
  return loaded.get(key)?.clone(true);
}
