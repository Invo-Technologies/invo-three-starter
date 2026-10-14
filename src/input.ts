/** Movement input: WASD or arrow keys, and an on-screen stick on touch screens. */
export class Input {
  private readonly keys = new Set<string>();
  private stick = { x: 0, y: 0 };
  readonly stickElement: HTMLElement;

  constructor(container: HTMLElement) {
    addEventListener("keydown", (e) => this.keys.add(e.key.toLowerCase()));
    addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener("blur", () => this.keys.clear());

    this.stickElement = document.createElement("div");
    this.stickElement.className = "stick";
    const knob = document.createElement("i");
    this.stickElement.append(knob);
    container.append(this.stickElement);

    let id: number | null = null;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const r = this.stickElement.getBoundingClientRect();
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      this.stick = { x, y };
      knob.style.transform = `translate(${x * 37}px, ${y * 37}px)`;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      this.stick = { x: 0, y: 0 };
      knob.style.transform = "";
    };
    this.stickElement.addEventListener("pointerdown", (e) => {
      id = e.pointerId;
      this.stickElement.setPointerCapture(e.pointerId);
      move(e);
    });
    this.stickElement.addEventListener("pointermove", move);
    this.stickElement.addEventListener("pointerup", end);
    this.stickElement.addEventListener("pointercancel", end);
  }

  /** Whether this device should show the touch stick. */
  static get touch(): boolean {
    return matchMedia("(pointer: coarse)").matches;
  }

  /** -1..1 on each axis; y is up on screen = negative. */
  get direction(): { x: number; y: number } {
    const k = this.keys;
    const x = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    const y = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
    return x || y ? { x, y } : this.stick;
  }

  showStick(on: boolean): void {
    this.stickElement.classList.toggle("on", on && Input.touch);
  }
}
