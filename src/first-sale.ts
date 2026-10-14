/**
 * INVO: a one-time moment for you, the builder. The first time a sandbox purchase clears
 * (Gems bought through checkout, or an item bought with Gems), a small card says so. It
 * shows once per browser, only in the sandbox, and never to players of a live game.
 * Delete this file and its call in main.ts if you do not want it.
 */
import type { InvoGameEconomy, InvoUIHandle } from "@invonetwork/three";

const SEEN_KEY = "invo.firstSale.seen";
const STYLE_ID = "invo-first-sale";
const SHOW_MS = 6500;

const CSS = `
.ifs{position:absolute;left:50%;top:max(72px,calc(env(safe-area-inset-top) + 60px));z-index:60;width:min(460px,calc(100% - 24px));transform:translate(-50%,-14px) scale(.97);opacity:0;pointer-events:auto;
  display:grid;grid-template-columns:52px 1fr auto;gap:14px;align-items:center;padding:16px 16px 18px;border-radius:20px;overflow:hidden;
  background:radial-gradient(120% 140% at 0% 0%,rgba(244,192,74,.16),transparent 55%),linear-gradient(180deg,rgba(36,40,48,.97),rgba(20,22,27,.98));
  border:1px solid rgba(244,192,74,.45);box-shadow:0 0 0 6px rgba(244,192,74,.06),0 30px 70px -20px rgba(0,0,0,.8);
  font-family:Inter,system-ui,sans-serif;color:#EEF1F6;transition:opacity .45s cubic-bezier(.2,.8,.2,1),transform .45s cubic-bezier(.2,.8,.2,1)}
.ifs.in{opacity:1;transform:translate(-50%,0) scale(1)}
.ifs-ico{position:relative;display:grid;place-items:center;width:52px;height:52px;border-radius:16px;background:linear-gradient(150deg,#FFE6A3,#F4C04A 55%,#C98E1C);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 10px 24px -8px rgba(244,192,74,.8)}
.ifs-ico::after{content:"";position:absolute;inset:-6px;border-radius:20px;border:2px solid rgba(244,192,74,.5);animation:ifs-ring 1.6s cubic-bezier(.2,.8,.2,1) .3s both}
.ifs-eyebrow{font:700 10.5px/1 Inter,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#F4C04A;margin-bottom:6px}
.ifs-title{font:800 17px/1.25 Sora,Inter,system-ui,sans-serif;letter-spacing:-.02em}
.ifs-sub{margin-top:4px;color:#98A1B3;font-size:12.5px;line-height:1.45}
.ifs-x{align-self:start;width:28px;height:28px;border-radius:50%;border:0;background:rgba(255,255,255,.05);color:#98A1B3;font-size:16px;line-height:28px;cursor:pointer}
.ifs-x:hover{color:#EEF1F6;background:rgba(255,255,255,.1)}
.ifs-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:linear-gradient(90deg,#F4C04A,#3FD0C9);transform-origin:left;animation:ifs-drain ${SHOW_MS}ms linear forwards}
.ifs-spark{position:absolute;width:6px;height:6px;border-radius:50%;background:#FFE6A3;pointer-events:none;animation:ifs-spark 1.1s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes ifs-ring{from{opacity:1;transform:scale(.8)}to{opacity:0;transform:scale(1.5)}}
@keyframes ifs-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@keyframes ifs-spark{from{opacity:1;transform:translate(0,0) scale(1)}to{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.3)}}
@media (prefers-reduced-motion:reduce){.ifs,.ifs *{transition:none!important;animation:none!important}.ifs-spark{display:none}}
`;

const GEM = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7 3.5h10l4.5 6L12 21.5 2.5 9.5z" fill="#1A1405" fill-opacity=".85"/><path d="M2.5 9.5h19M7 3.5l5 6 5-6M12 9.5v12" stroke="#F4C04A" stroke-opacity=".55" stroke-width="1.2" fill="none"/></svg>`;

export function celebrateFirstSale(economy: InvoGameEconomy, getUI: () => InvoUIHandle | null): () => void {
  let shown = readSeen();
  const show = () => {
    const ui = getUI();
    if (shown || !ui || !economy.catalog?.sandbox) return;
    shown = true;
    writeSeen();
    ui.root.append(card());
  };
  const offs = [
    economy.on("purchase", (u) => {
      if (u.status === "credited") show();
    }),
    economy.on("item", (p) => {
      if (p.currency === "premium" && !p.replayed) show();
    }),
  ];
  return () => offs.forEach((off) => off());
}

function card(): HTMLElement {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }
  const node = document.createElement("div");
  node.className = "ifs";
  node.setAttribute("role", "status");

  const icon = document.createElement("div");
  icon.className = "ifs-ico";
  icon.innerHTML = GEM; // a constant above, not user data

  const text = document.createElement("div");
  const eyebrow = document.createElement("div");
  eyebrow.className = "ifs-eyebrow";
  eyebrow.textContent = "Welcome to INVO";
  const title = document.createElement("div");
  title.className = "ifs-title";
  title.textContent = "You just made your first sale.";
  const sub = document.createElement("div");
  sub.className = "ifs-sub";
  sub.textContent = "Sandbox, so no real money moved. Going live is one key swap.";
  text.append(eyebrow, title, sub);

  const x = document.createElement("button");
  x.className = "ifs-x";
  x.type = "button";
  x.setAttribute("aria-label", "Dismiss");
  x.textContent = "×";

  const bar = document.createElement("div");
  bar.className = "ifs-bar";
  node.append(icon, text, x, bar);

  for (let i = 0; i < 14; i++) {
    const s = document.createElement("span");
    s.className = "ifs-spark";
    const a = (i / 14) * Math.PI * 2;
    s.style.left = "42px";
    s.style.top = "42px";
    s.style.setProperty("--dx", `${Math.cos(a) * (40 + (i % 3) * 18)}px`);
    s.style.setProperty("--dy", `${Math.sin(a) * (40 + (i % 3) * 18)}px`);
    s.style.animationDelay = `${120 + (i % 4) * 30}ms`;
    if (i % 2) s.style.background = "#3FD0C9";
    node.append(s);
  }

  let gone = false;
  const dismiss = () => {
    if (gone) return;
    gone = true;
    node.classList.remove("in");
    setTimeout(() => node.remove(), 450);
  };
  x.onclick = dismiss;
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add("in")));
  setTimeout(dismiss, SHOW_MS);
  return node;
}

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode: it may show again next visit, which is fine */
  }
}
