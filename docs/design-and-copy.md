# Design and copy guide

The rules every screen and every line of text in this app follows.

---

## 1. The name is a placeholder

**"English Ladder" is not final.** Therefore:

- The name lives in `src/lib/brand.ts` and nowhere else. Never hardcode it.
- **No ladder metaphor anywhere** — no rungs, no climbing, no steps, no "move up a rung", no ladder iconography or stair imagery. The metaphor dies when the name does.
- Progress is described plainly: "Week 4 of 12", "Level 2", "words you know".

---

## 2. One design system, ages 8–15

An 8-year-old and a 15-year-old do not respond to the same surface. But they can share one **system**.

**Shared at every age:** component structure, layout, spacing rhythm, interaction patterns, accessibility rules, the whole codebase.

**Shifts by age band** (tokens only, in `globals.css` under `[data-age-band]`):

| | 8–11 (shipped) | 12+ (later) |
|---|---|---|
| Corner radius | Rounder (16–24px) | Tighter (10–14px) |
| Accent saturation | Full amber | Muted |
| Celebration | Confetti, pop scale 1.1 | Near-flat, 1.02 |
| Line length | ~34rem | ~46rem |

Adding the older theme is a token swap. **Never fork a component to make it look older.**

### What this is not

Not a cartoon app. No mascots, no bubble fonts, no rainbow primaries, no baby talk. A ten-year-old placed in Level 1 must never feel handed something made for a five-year-old — that is the same dignity principle as the `age_band` content dial.

The target feel: **warm, calm, and confident.** Closer to a well-made notebook than to a game show.

---

## 3. Visual rules

- **Warm ground** (`--ground: #fdfbf7`), never clinical grey-white.
- **Deep indigo primary** for actions, **warm amber accent** for encouragement and progress.
- **There is no red token.** A wrong answer is amber and reads "Not yet — try again!". Errors in kid mode are never failures.
- **Minimum touch target 48px** in kid mode. Body text 18px minimum.
- **Soft warm shadows**, never hard grey drop shadows.
- **Visible focus rings** everywhere, and all motion respects `prefers-reduced-motion`.
- Parent and teacher surfaces use the same tokens but plainer, denser layouts — no kid theming there.

---

## 4. Copy: friendly, explanatory, trustworthy

**The voice is a good teacher explaining something clearly.** Not a brand. Not a salesperson.

### Always

- **Explain what will happen** before asking someone to act.
- **Plain words.** Short sentences. Sentence case.
- **Say the useful, specific thing** — "3 of 5 days this week" beats "great progress!"
- **Be warm without performing warmth.** One friendly line is warmer than three exclamation marks.

### Never

- No boasting or superlatives: *world-class, revolutionary, the best, proven, cutting-edge, transform*.
- No urgency or pressure: *limited seats, hurry, don't miss out, act now*.
- No hype punctuation. One exclamation mark on a screen is plenty; usually zero.
- No shaming, ever: no "you missed 3 days", no broken-streak guilt, no red counts.
- No jargon at parents: not *SRS*, *spaced repetition algorithm*, *engagement metrics*.

### Examples

| Instead of | Write |
|---|---|
| "Unlock your child's full potential!" | "Two live classes a week, and ten minutes of practice a day." |
| "You've broken your streak!" | "Good to see you back. Ready for today's words?" |
| "Incorrect." | "Not yet — look again." |
| "Submission failed." | "That didn't save. Check your connection and try once more." |
| "AI-powered feedback" | "Your teacher reads every piece of writing before you see her notes." |
| "Enroll now — limited seats!" | "Batches are small, so we take a few children at a time. Here's how placement works." |

### For children specifically

- Address them directly: "you", by first name.
- One instruction per screen, short enough for a weak reader.
- Never show percentages, scores, or how far behind they are.
- Praise the specific thing they did, not their ability: "You put all five sentences in the right order" — not "You're so clever."

### For parents specifically

- Lead with what happened, then what it means, then what they can do.
- Be honest when progress is slow. Trust is worth more than a good-looking dashboard.
- Never imply a child is behind other children. There is no comparison between children anywhere in this product.

---

## 5. Accessibility floor

- Contrast: 4.5:1 for body text, 3:1 for large text and UI borders.
- Every interactive element reachable and operable by keyboard.
- Every image has alt text; every audio control has a label.
- Nothing communicated by colour alone.
- Target Lighthouse a11y ≥ 90.
