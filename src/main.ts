import "./styles.css";
import * as THREE from "three";
import { installInvo } from "@invonetwork/three";
import { ITEMS } from "../shared/economy.js";
import { loadAssets } from "./assets.js";
import { readBest, recordBest } from "./best.js";
import { celebrateFirstSale } from "./first-sale.js";
import { Input } from "./input.js";
import { attachItems } from "./items.js";
import { pickupRadius, RoundClock, wordWatcher } from "./logic.js";
import { Player } from "./player.js";
import { countdown, floatText, hud as createHud, loadingScreen, loadoutScreen, menuScreen, resultsScreen, signature } from "./screens.js";
import { Shards } from "./shards.js";
import { COLORS, createWorld } from "./world.js";

type State = "loading" | "menu" | "countdown" | "play" | "results" | "loadout";

const root = document.getElementById("game")!;
const vignette = document.createElement("div");
vignette.className = "vignette";
root.append(vignette);

await Promise.race([
  Promise.all(["800 64px Sora", "700 16px Inter", "500 14px Inter"].map((f) => document.fonts.load(f))),
  new Promise((resolve) => setTimeout(resolve, 2500)),
]);

const world = createWorld(root);
const loading = loadingScreen(root).show();
await loadAssets((f) => loading.progress(f));

const player = new Player(world.scene);
player.reset();
const shards = new Shards(world.scene);
const input = new Input(root);

// INVO: one call connects the economy. It mounts the INVO UI (balances, shop, sign-in,
// buying Gems) over the canvas, talks to this project's server at /api/invo, and reports
// `paused` while an INVO dialog is open so the game can stop the clock.
const invo = installInvo({ renderer: world.renderer, container: root });
const { economy } = invo;
celebrateFirstSale(economy, () => invo.ui);
// INVO: purchases appear in the world (see items.ts).
const items = attachItems(economy, player);

let state: State = "loading";
let round = new RoundClock();
let collected = 0;

const menu = menuScreen(root, { play: () => startRound(), shop: () => enterLoadout(), signIn: () => invo.ui?.openSignIn() });
const hudView = createHud(root);
const results = resultsScreen(root, { again: () => startRound(), shop: () => enterLoadout(), menu: () => enterMenu(), signIn: () => invo.ui?.openSignIn() });
const loadout = loadoutScreen(root, economy, { open: (c) => invo.ui?.openShop(c), gems: () => invo.ui?.openBuyCurrency(), back: () => enterMenu() });

const refreshPlayer = () => {
  menu.setPlayer(economy.player?.name ?? null, readBest());
  loadout.refresh();
};
economy.on("session", refreshPlayer);
economy.on("wallet", refreshPlayer);
economy.on("catalog", refreshPlayer);

function show(next: State) {
  state = next;
  loading.show(false);
  menu.show(next === "menu");
  results.show(next === "results");
  loadout.show(next === "loadout");
  hudView.show(next === "play" || next === "countdown");
  input.showStick(next === "play" || next === "countdown");
}

function enterMenu() {
  refreshPlayer();
  show("menu");
}

function enterLoadout() {
  refreshPlayer();
  show("loadout");
}

async function startRound() {
  round = new RoundClock();
  collected = 0;
  player.reset();
  shards.reset(player.position);
  hudView.set(0, round.left, 0);
  show("countdown");
  await countdown(root);
  show("play");
}

function finishRound() {
  void economy.flushEarnings();
  // INVO: a loyalty event. Set up a loyalty program with this milestone key in the INVO
  // console to reward it. A failure here never interrupts the game.
  void economy.reportEvent("game.milestone.reached", { milestone_key: "round_complete" }).catch(() => undefined);
  const newBest = recordBest(collected);
  results.render({ shards: collected, best: readBest(), newBest, signedIn: economy.signedIn, seconds: round.seconds });
  show("results");
}

// Easter egg: type the word on the menu.
const typed = wordWatcher("invo");
let rimFlash = 0;
addEventListener("keydown", (e) => {
  if (state === "menu" && typed(e.key)) {
    rimFlash = 2.6;
    signature(root);
  }
});

// ---------------------------------------------------------------- the loop
const timer = new THREE.Timer();
timer.connect(document); // pauses cleanly while the tab is hidden
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const projected = new THREE.Vector3();
let orbit = 0;

function frame(time: number) {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05);
  const playing = state === "play" && !invo.paused; // the clock stops while a dialog is open

  player.update(dt, input.direction, playing);
  items.update(dt);
  const reach = pickupRadius(economy.quantity(ITEMS.magnet));
  const got = shards.update(dt, player.position, reach, playing);
  for (const at of got) {
    collected += 1;
    // INVO: earnings are batched and sent to the server, which credits the player's
    // Shards in its ledger (and rate-limits them). Nothing happens for guests.
    economy.earn(1, "shard collected");
    projected.copy(at).project(world.camera);
    floatText(root, ((projected.x + 1) / 2) * root.clientWidth, ((1 - projected.y) / 2) * root.clientHeight, "+1");
  }
  if (playing) {
    round.tick(dt);
    if (round.over) finishRound();
  }
  if (state === "play" || state === "countdown") hudView.set(collected, round.left, round.progress);

  // Camera: orbit the arena on the menu, follow the drone in play, close-up in the loadout.
  orbit += dt * (state === "loadout" ? 0.35 : 0.08);
  const p = player.anchor.position;
  if (state === "play" || state === "countdown") {
    camPos.set(p.x * 0.85, 10.5, p.z + 10.5);
    camTarget.set(p.x, 0.6, p.z - 1.5);
  } else if (state === "loadout") {
    const narrow = root.clientWidth < 720;
    camPos.set(p.x + Math.sin(orbit) * 4.6, 2.3, p.z + Math.cos(orbit) * 4.6);
    camTarget.set(p.x + (narrow ? 0 : -1.1), narrow ? 0.4 : 1.1, p.z);
  } else {
    // Pulled back, looking slightly above the arena so it sits under the title.
    camPos.set(Math.sin(orbit) * 23, 11, Math.cos(orbit) * 23);
    camTarget.set(0, 3.2, 0);
  }
  const k = 1 - Math.exp(-dt * (state === "play" ? 6 : 2.5));
  world.camera.position.lerp(camPos, k);
  const look = new THREE.Vector3().copy(camTarget);
  world.camera.lookAt(look);

  if (rimFlash > 0) {
    rimFlash = Math.max(0, rimFlash - dt);
    const c = new THREE.Color(COLORS.teal).lerp(new THREE.Color(COLORS.gold), 0.5 + 0.5 * Math.sin(rimFlash * 9));
    world.rimMaterial.color.copy(c);
    world.rimMaterial.emissive.copy(c);
    world.rimMaterial.emissiveIntensity = 1.6 + rimFlash;
  } else {
    world.rimMaterial.color.setHex(COLORS.teal);
    world.rimMaterial.emissive.setHex(COLORS.teal);
    world.rimMaterial.emissiveIntensity = 1.6;
  }

  world.render();
  requestAnimationFrame(frame);
}

shards.reset(player.position);
await invo.ready;
enterMenu();
requestAnimationFrame(frame);
