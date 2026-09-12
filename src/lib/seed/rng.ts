/**
 * Deterministic PRNG (mulberry32) so seed data is identical every run
 * (BUILD_PROMPT_PART3 §21.4). Never use Math.random in the seed engine.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** integer in [lo, hi] inclusive */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  float(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Pick by relative weights */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((n, [, w]) => n + w, 0);
    let r = this.next() * total;
    for (const [item, w] of items) {
      r -= w;
      if (r <= 0) return item;
    }
    return items[items.length - 1][0];
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Deterministic RFC-4122-shaped UUID (v4 layout) */
  uuid(): string {
    const hex = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 32; i++) s += hex[this.int(0, 15)];
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${hex[8 + this.int(0, 3)]}${s.slice(17, 20)}-${s.slice(20, 32)}`;
  }

  /** Gaussian-ish via sum of uniforms, clamped */
  gauss(mean: number, sd: number): number {
    let s = 0;
    for (let i = 0; i < 6; i++) s += this.next();
    return mean + ((s - 3) / 3) * 2 * sd;
  }
}

/** The one fixed seed for reproducible demo data. */
export const SEED = 20260912;

/** Stable 32-bit hash of a string, for sub-seeds keyed by slug/phone. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
