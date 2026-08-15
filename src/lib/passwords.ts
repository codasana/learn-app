import "server-only";

import { randomInt } from "node:crypto";

/**
 * Readable passwords, for people who have to type them from memory.
 *
 * A child's first password is read off a message their parent shows them and
 * typed on a tablet, possibly several times. `Xk7#pQ2v` guarantees a support
 * conversation; "otter-lamp-38" does not. Two common words and two digits is
 * roughly 2^28 with this list — weak against an offline attack on a stolen
 * hash, ample against someone guessing at a login form, which is the threat
 * that exists here. Better Auth rate-limits the form, and nothing behind a
 * child's account is worth a serious attempt.
 *
 * Every word is one a Level 1 child can already spell, on purpose: the first
 * thing the account does should not be make them feel stupid.
 */

const WORDS = [
  "apple", "otter", "river", "cloud", "lemon", "tiger", "panda", "mango",
  "honey", "robin", "daisy", "melon", "zebra", "koala", "puppy", "kitten",
  "planet", "rocket", "pencil", "garden", "yellow", "purple", "orange", "silver",
  "banana", "candle", "island", "monkey", "rabbit", "turtle", "dolphin", "penguin",
];

/** Two words and two digits, hyphenated: "otter-lemon-38". */
export function readablePassword(): string {
  const a = WORDS[randomInt(WORDS.length)];
  let b = WORDS[randomInt(WORDS.length)];
  while (b === a) b = WORDS[randomInt(WORDS.length)];
  return `${a}-${b}-${randomInt(10, 100)}`;
}
