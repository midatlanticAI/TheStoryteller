/**
 * Spoiler gating.
 *
 * A campaign records which books the players have read. Any entry revealed in
 * a later book is invisible to the narrator and the codex. Reading order is
 * the book's `order`; "known through book N" means every book with order <= N.
 */
import type { World } from "./index";

export interface Gate {
  /** Highest book order the players know. Infinity means everything. */
  maxOrder: number;
}

export function gateFromBooks(world: World, knownBookIds: readonly string[]): Gate {
  if (knownBookIds.includes("*")) return { maxOrder: Number.POSITIVE_INFINITY };
  let max = 0;
  for (const id of knownBookIds) {
    const b = world.books.get(id);
    if (b && b.order > max) max = b.order;
  }
  return { maxOrder: max };
}

export function isRevealed(world: World, gate: Gate, entry: { revealedIn: string }): boolean {
  const book = world.books.get(entry.revealedIn);
  if (!book) return false;
  return book.order <= gate.maxOrder;
}

export function revealed<T extends { revealedIn: string }>(world: World, gate: Gate, entries: Iterable<T>): T[] {
  const out: T[] = [];
  for (const e of entries) if (isRevealed(world, gate, e)) out.push(e);
  return out;
}

/** Entries that belong to an era: either they list it or they list no eras at all. */
export function inEra<T extends { eraIds?: string[] }>(eraId: string, entries: Iterable<T>): T[] {
  const out: T[] = [];
  for (const e of entries) if (!e.eraIds || e.eraIds.length === 0 || e.eraIds.includes(eraId)) out.push(e);
  return out;
}
