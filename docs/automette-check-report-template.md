# Template spec — "Your child's English check"

**For:** Automette · engine `typst` · output `pdf` · one page, A4 portrait
**Used by:** English Ladder, after a child finishes the free level check and a
parent asks for the full report. Sent by email.

This is the **first and only template needed right now.** Certificates, term
reports and achievement cards come in March; there is no point designing them
before a single child has finished a term.

---

## Why Typst rather than docx

Typst is right here for three reasons, and one reason it might not be:

- The layout is fixed and typographic — panels, scores, generous space. Typst
  gives precise control and clean PDF output.
- It is code, so an agent can write and revise it, and the diff is readable.
- It renders fast and identically every time.

**The tradeoff:** Sheeba cannot nudge the layout herself without touching code.
If she is likely to want to restyle it, docx is the kinder choice and she edits
it in Word. My recommendation is Typst, because this document goes to strangers
deciding whether to trust the programme and should look composed rather than
word-processed.

---

## The job this document has to do

A parent has just let their child take a twelve-minute test online. They are
about to decide whether this programme is worth a free class.

So the report must, in this order:

1. **Not read like a test result.** No pass, no fail, no red, no percentage
   presented as a verdict. A child scoring 5 out of 17 has a parent reading
   this, and that parent must not feel their child has been graded and found
   wanting.
2. **Tell them something they did not know**, specifically — which of the three
   areas is strongest, and what that means.
3. **Be honest.** If the child is doing fine, it says so.
4. **End with one obvious next step**, which is the free class.

---

## Fields

Snake_case keys, matching the convention already used on the account.

| Key | Type | Example | Notes |
|---|---|---|---|
| `child_name` | text | `Nila` | First name only. Never a surname. |
| `report_date` | text | `15 August 2026` | Pre-formatted; do not parse. |
| `total_score` | text | `12` | |
| `total_out_of` | text | `17` | |
| `vocab_score` | text | `6` | Words and grammar |
| `vocab_out_of` | text | `8` | |
| `reading_score` | text | `4` | |
| `reading_out_of` | text | `5` | |
| `listening_score` | text | `2` | |
| `listening_out_of` | text | `4` | |
| `strongest_area` | text | `Reading` | One of the three, already chosen. |
| `summary` | text | 2–3 sentences | **Teacher-edited before sending.** |
| `what_went_well` | text | 1–2 sentences | |
| `what_to_work_on` | text | 1–2 sentences | Never phrased as a weakness. |
| `suggested_level` | text | `Level 2` | Provisional; the teacher decides. |
| `level_description` | text | 1 sentence | What that level covers. |
| `next_step` | text | 1–2 sentences | The free class, and what happens in it. |
| `teacher_name` | text | `Sheeba` | |
| `programme_name` | text | `English Ladder` | Placeholder name — do not draw a logo. |

All fields are text and all are required. The app fills every one; nothing is
computed inside the template.

---

## Layout

```
┌──────────────────────────────────────────────┐
│  {programme_name}              {report_date} │   small, muted
│                                              │
│  Nila's English check                        │   large, bold
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │   12 out of 17                         │  │   lilac panel
│  │   Strongest area: Reading              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Words &  │ │ Reading  │ │Listening │      │   three panels:
│  │ grammar  │ │          │ │          │      │   peach, mint, butter
│  │  6 / 8   │ │  4 / 5   │ │  2 / 4   │      │
│  └──────────┘ └──────────┘ └──────────┘      │
│                                              │
│  What this tells us                          │
│  {summary}                                   │
│                                              │
│  What went well                              │
│  {what_went_well}                            │
│                                              │
│  What to work on next                        │
│  {what_to_work_on}                           │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Where {child_name} would start        │  │   lilac panel
│  │  {suggested_level}                     │  │
│  │  {level_description}                   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  What happens next                           │
│  {next_step}                                 │
│                                              │
│  — {teacher_name}                            │
└──────────────────────────────────────────────┘
```

## Colours — take these exactly

They are the product's own tokens, so the report looks like the site a parent
just came from.

```
ground / page     #fbf9ff   barely-tinted lilac
ink               #20233d
ink muted         #5d6180
panel lilac       #e8e4ff
panel peach       #ffe4d6
panel mint        #d6f5ea
panel butter      #fff3d1
brand indigo      #4f46e5   headings only
```

**There is no red anywhere in this product, deliberately** — not for a low
score, not for anything. If a score needs emphasis it gets the indigo.

## Type

Figtree if the renderer has it. If not, any humanist sans — Source Sans,
Inter, Lato. **Not** a serif, and not a rounded/cartoon face. Generous line
height; this is read by a parent on a phone as often as on paper.

Corners on panels: 12–16pt. Nothing sharp.

## Two things to avoid

- **No logo, no wordmark image.** The programme name is a placeholder and will
  change; keep it as plain text in one field.
- **No progress bars or gauges** on the scores. A bar that is one-third full
  is a picture of failure. Plain numbers read as information.
