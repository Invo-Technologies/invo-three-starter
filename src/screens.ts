/** The game's screens, as plain DOM over the 3D canvas. Text is always set with textContent. */
import type { GameCatalogItem, InvoGameEconomy } from "@invonetwork/three";

type Attrs = { class?: string; text?: string; onclick?: () => void };

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Node[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.class) node.className = attrs.class;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.onclick) node.addEventListener("click", attrs.onclick);
  node.append(...children);
  return node;
}

const SHARD_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 20 12l-8 10.5L4 12z" fill="#3FD0C9"/><path d="M12 1.5 20 12H4z" fill="#B6F5F1" fill-opacity=".7"/><path d="M4 12h16M12 1.5v21" stroke="#0B0D11" stroke-opacity=".25" stroke-width=".8"/></svg>`;
const GEM_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="sa-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A8"/><stop offset=".5" stop-color="#F4C04A"/><stop offset="1" stop-color="#A8730F"/></linearGradient></defs><path d="M7 3.5h10l4.5 6L12 21.5 2.5 9.5z" fill="url(#sa-gem)"/><path d="M2.5 9.5h19M7 3.5l5 6 5-6M12 9.5v12" stroke="#000" stroke-opacity=".22" fill="none"/></svg>`;
const PLAY_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>`;

function icon(svg: string, cls: string): HTMLElement {
  const span = h("span", { class: cls });
  span.innerHTML = svg; // constants above
  span.style.display = "inline-grid";
  return span;
}

/** A full-screen layer that fades in and out. */
class Screen {
  readonly el: HTMLElement;
  constructor(root: HTMLElement, cls = "") {
    this.el = h("div", { class: `screen ${cls}` });
    root.append(this.el);
  }
  show(on = true): this {
    this.el.classList.toggle("on", on);
    this.el.inert = !on;
    return this;
  }
}

export function loadingScreen(root: HTMLElement) {
  const s = new Screen(root, "loading");
  const fill = h("i");
  s.el.append(h("div", { class: "stack" }, h("div", { class: "eyebrow", text: "An INVO starter" }), h("h1", { class: "wordmark", text: "SHARD ARENA" }), h("div", { class: "bar" }, fill)));
  return Object.assign(s, { progress: (f: number) => void (fill.style.width = `${Math.round(f * 100)}%`) });
}

export function menuScreen(root: HTMLElement, actions: { play(): void; shop(): void; transfer(): void; signIn(): void }) {
  const s = new Screen(root, "scrim");
  const status = h("div");
  const liveOnly = h("span", { class: "live-only", text: "Live only" });
  liveOnly.hidden = true;
  s.el.append(
    h(
      "div",
      { class: "stack" },
      h("div", { class: "eyebrow", text: "An INVO starter" }),
      h("h1", { class: "wordmark", text: "SHARD ARENA" }),
      h("p", { class: "tagline", text: "Collect shards. Upgrade your drone. Own the arena." }),
      h(
        "div",
        { class: "btns" },
        (() => {
          const b = h("button", { class: "btn gold", onclick: actions.play });
          b.append(icon(PLAY_SVG, ""), document.createTextNode("Play"));
          return b;
        })(),
        h(
          "div",
          { class: "btn-row" },
          h("button", { class: "btn", text: "Shop", onclick: actions.shop }),
          (() => {
            // INVO: transfers and sends (INVO's dialog). "Live only" when this key has them off.
            const b = h("button", { class: "btn", onclick: actions.transfer });
            b.append(document.createTextNode("⇄ Transfer"), liveOnly);
            return b;
          })(),
        ),
      ),
      status,
      h("div", { class: "keys" }, h("span", { class: "key", text: "W" }), h("span", { class: "key", text: "A" }), h("span", { class: "key", text: "S" }), h("span", { class: "key", text: "D" }), document.createTextNode("or drag to move")),
    ),
  );
  return Object.assign(s, {
    setTransfersEnabled(enabled: boolean) {
      liveOnly.hidden = enabled;
    },
    setPlayer(name: string | null, best: number) {
      status.replaceChildren(
        name
          ? h("span", { class: "chip teal" }, h("span", { class: "dot" }), document.createTextNode(best ? `${name} · best round ${best}` : `Signed in as ${name}`))
          : h("span", { class: "chip gold", onclick: actions.signIn }, h("span", { class: "dot" }), document.createTextNode("Sign in to keep your shards")),
      );
    },
  });
}

export function hud(root: HTMLElement) {
  const count = h("span", { class: "count", text: "0" });
  const fill = h("i");
  const timer = h("div", { class: "timer" }, fill);
  const secs = h("span", { class: "secs", text: "" });
  const el = h("div", { class: "hud" }, h("div", { class: "label", text: "Shards this round" }), h("div", { class: "row" }, count), timer, secs);
  root.append(el);
  const hint = h("div", { class: "hint" }, h("span", { class: "chip", text: "Move with WASD, the arrow keys, or the stick" }));
  hint.style.opacity = "0";
  root.append(hint);
  return {
    show(on: boolean) {
      el.classList.toggle("on", on);
      hint.style.opacity = on ? "1" : "0";
      if (on) setTimeout(() => (hint.style.opacity = "0"), 3500);
    },
    set(shards: number, secondsLeft: number, progress: number) {
      if (count.textContent !== String(shards)) {
        count.textContent = String(shards);
        count.classList.remove("bump");
        void count.offsetWidth;
        count.classList.add("bump");
      }
      const late = secondsLeft <= 5;
      fill.style.transform = `scaleX(${1 - progress})`;
      timer.classList.toggle("late", late);
      secs.classList.toggle("late", late);
      secs.textContent = `${Math.ceil(secondsLeft)}s left`;
    },
  };
}

/** "+1" rising from a point on screen. */
export function floatText(root: HTMLElement, x: number, y: number, text: string): void {
  const el = h("div", { class: "float", text });
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  root.append(el);
  setTimeout(() => el.remove(), 900);
}

/** 3, 2, 1, Go. Resolves on "Go". */
export function countdown(root: HTMLElement): Promise<void> {
  const layer = h("div", { class: "countdown" });
  root.append(layer);
  return new Promise((resolve) => {
    ["3", "2", "1", "Go"].forEach((word, i) => {
      setTimeout(() => {
        layer.replaceChildren(h("span", { class: word === "Go" ? "go" : "", text: word }));
        if (word === "Go") {
          resolve();
          setTimeout(() => layer.remove(), 450);
        }
      }, i * 420);
    });
  });
}

export function resultsScreen(root: HTMLElement, actions: { again(): void; shop(): void; menu(): void; signIn(): void }) {
  const s = new Screen(root, "scrim");
  const host = h("div");
  s.el.append(host);
  return Object.assign(s, {
    render(r: { shards: number; best: number; newBest: boolean; signedIn: boolean; seconds: number }) {
      const total = h("span", { text: "+0" });
      const panel = h(
        "div",
        { class: `panel stack${r.newBest ? " best" : ""}` },
        ...(r.newBest && r.shards > 0 ? [h("div", { class: "ribbon", text: "NEW BEST" })] : []),
        h("div", { class: "eyebrow", text: "Round complete" }),
        h("div", { class: "big" }, icon(SHARD_SVG, "shard-ico"), total),
        h("div", { class: "sub", text: "shards collected" }),
      );
      const stats = h(
        "div",
        { class: "stats" },
        h("div", { class: "stat" }, document.createTextNode("Round length"), h("b", { text: `${r.seconds}s` })),
        h("div", { class: "stat" }, document.createTextNode("Best round"), h("b", { class: r.newBest ? "gold" : "", text: String(r.best) })),
      );
      stats.style.width = "100%";
      panel.append(
        stats,
        r.signedIn ? h("div", { class: "note", text: "✓  Added to your wallet" }) : h("div", { class: "note gold", text: "Sign in to keep shards next round  →", onclick: actions.signIn }),
        h(
          "div",
          { class: "btns" },
          h("button", { class: "btn gold", text: "Play again", onclick: actions.again }),
          h("div", { class: "btn-row" }, h("button", { class: "btn small", text: "Shop", onclick: actions.shop }), h("button", { class: "btn small", text: "Menu", onclick: actions.menu })),
        ),
      );
      host.replaceChildren(panel);
      // Count up.
      const start = performance.now();
      const duration = Math.min(1300, 400 + r.shards * 40);
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        total.textContent = `+${Math.round(r.shards * (1 - Math.pow(1 - t, 3)))}`;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
  });
}

export function loadoutScreen(root: HTMLElement, economy: InvoGameEconomy, actions: { open(category?: string): void; gems(): void; back(): void }) {
  const s = new Screen(root);
  const cards = h("div", { class: "cards" });
  s.el.append(
    h(
      "div",
      { class: "loadout" },
      h("div", { class: "eyebrow", text: "Loadout" }),
      h("h2", { text: "Your drone" }),
      cards,
      h(
        "div",
        { class: "btns" },
        h("button", { class: "btn gold", text: "Open shop", onclick: () => actions.open() }),
        h("div", { class: "btn-row" }, h("button", { class: "btn small", text: "Get Gems", onclick: actions.gems }), h("button", { class: "btn small", text: "Back", onclick: actions.back })),
      ),
    ),
  );
  const card = (item: GameCatalogItem) => {
    const owned = economy.quantity(item.id);
    const max = item.maxOwned ?? 1;
    const el = h("button", { class: `card${owned ? " owned" : ""}`, onclick: () => actions.open(item.category) });
    el.style.setProperty("--c", item.currency === "premium" ? "#F4C04A" : "#3FD0C9");
    const info = h("div", {}, h("div", { class: "name", text: item.name }), h("div", { class: "meta", text: item.description ?? "" }));
    if (max > 1) {
      const pips = h("div", { class: "pips" });
      for (let i = 0; i < max; i++) pips.append(h("span", { class: `pip${i < owned ? " on" : ""}` }));
      info.append(pips);
    }
    const right = owned >= max ? h("span", { class: "tag", text: max === 1 ? "OWNED" : "MAXED" }) : h("span", { class: "price" }, icon(item.currency === "premium" ? GEM_SVG : SHARD_SVG, "cur"), document.createTextNode(item.price.toLocaleString()));
    el.append(h("span", { class: "glyph", text: item.icon ?? "◆" }), info, right);
    return el;
  };
  return Object.assign(s, {
    refresh() {
      cards.replaceChildren(...(economy.catalog?.items ?? []).map(card));
    },
  });
}

export function signature(root: HTMLElement): void {
  const el = h("div", { class: "signature", text: "made with care · INVO" });
  root.append(el);
  requestAnimationFrame(() => el.classList.add("on"));
  setTimeout(() => el.classList.remove("on"), 2600);
  setTimeout(() => el.remove(), 3500);
}
