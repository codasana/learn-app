/**
 * Fisher–Yates, returning a new array.
 *
 * Kept in one place because randomness in a React tree is a trap: shuffle in a
 * client component and the server renders one order, the browser another, and
 * React throws a hydration mismatch. Anything shuffled for display is shuffled
 * on the server and passed down already ordered.
 */
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
