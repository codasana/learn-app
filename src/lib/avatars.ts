/**
 * The eight avatars a child can be.
 *
 * Animals, not photographs and not people. A photo of a child is data we have
 * decided not to hold (see the child_profiles comment in db/schema), and a
 * cartoon child forces a choice about skin and hair that no eight-year-old
 * should have to make on a sign-up screen. An otter is an otter.
 */

export const AVATARS = {
  fox: { emoji: "🦊", label: "Fox" },
  owl: { emoji: "🦉", label: "Owl" },
  panda: { emoji: "🐼", label: "Panda" },
  otter: { emoji: "🦦", label: "Otter" },
  cat: { emoji: "🐱", label: "Cat" },
  rabbit: { emoji: "🐰", label: "Rabbit" },
  turtle: { emoji: "🐢", label: "Turtle" },
  penguin: { emoji: "🐧", label: "Penguin" },
} as const;

export type AvatarKey = keyof typeof AVATARS;

export const AVATAR_KEYS = Object.keys(AVATARS) as AvatarKey[];

export function avatarEmoji(key: string): string {
  return AVATARS[key as AvatarKey]?.emoji ?? AVATARS.fox.emoji;
}
