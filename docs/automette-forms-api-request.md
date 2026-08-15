# Feature request to Automette — a public Forms API

**From:** English Ladder, an Automette customer
**Status:** built 2026-08-15 — every endpoint below ships, plus
`DELETE /api/v1/forms/:id/webhooks/:webhook_id` (per-endpoint rather than a
collection delete, so removing one integration's webhook leaves the others).
Docs: `/docs/forms/forms-api` and `/docs/api-reference/listForms`.
**Contract wanted:** `/api/v1/forms*`, Bearer `dg_…`, same auth as `/renders`

---

## Why this is a product feature, not a favour

English Ladder needs exactly one form, and one form can be built in the
dashboard in five minutes. **That is not the case for this API.**

The case is that Automette sells a forms product, and every competitor in that
category ships an API for it — Tally and Typeform both let you create a form
and read its submissions programmatically. Right now an Automette customer can
generate documents from code but must click through a dashboard to make a form,
which means forms cannot be provisioned per client, cannot be version
controlled, and cannot be created by anyone's automation.

There is also a smaller gap that matters more than it looks: **submissions can
only be received, never fetched.** Webhooks are the right primary path, but
every webhook consumer eventually needs "we were down for an hour, give me what
I missed." Without a read endpoint a failed delivery is unrecoverable, which is
a bad property for a product holding other people's leads.

**Build the read endpoint even if nothing else here gets built.**

---

## Endpoints

Auth, error shape and pagination should match `/api/v1/renders` exactly.
Everything is team-scoped by the API key. Nothing below should be reachable
across teams.

### `POST /api/v1/forms` — create

```json
{
  "title": "Book a free class",
  "fields": [
    { "key": "parent_name",  "type": "text",     "label": "Your name", "required": true },
    { "key": "parent_email", "type": "email",    "label": "Email",     "required": true },
    { "key": "whatsapp",     "type": "tel",      "label": "WhatsApp",  "required": false },
    { "key": "child_age",    "type": "select",   "label": "How old is your child?",
      "required": true, "options": [
        { "value": "8_9",   "label": "8–9 years"  },
        { "value": "10_11", "label": "10–11 years" }
      ] },
    { "key": "message",      "type": "textarea", "label": "Anything else?", "required": false }
  ]
}
```

→ `201` with the form, `status: "draft"`, and its `id`.

**`key` is the contract.** It is what arrives in the webhook `answers` object,
so the caller must be able to set it rather than receive a generated one.
Reject duplicates within a form, and reject anything that is not
`[a-z][a-z0-9_]*`.

Field types to support in v1: `text`, `email`, `tel`, `number`, `textarea`,
`select`, `checkbox`, `date`. Anything the builder supports beyond that can
come later; these are the ones an integration actually provisions.

### `GET /api/v1/forms` — list
### `GET /api/v1/forms/:id` — detail

Include `status`, `fields`, and when published, `public_url` and `embed_url`.

### `PATCH /api/v1/forms/:id` — update title and fields

Edits the draft. Does not affect the live version until published — same as
the builder.

### `POST /api/v1/forms/:id/publish`

Freezes the draft as a new version and returns:

```json
{ "status": "published", "version": 3,
  "public_url": "https://forms.automette.com/abc123",
  "embed_url":  "https://forms.automette.com/abc123/embed" }
```

**This is the endpoint that makes the rest worth having.** Create-without-
publish still requires a dashboard visit, which defeats the purpose.

### `GET /api/v1/forms/:id/submissions` — the important one

```
?since=2026-08-01T00:00:00Z   &limit=100   &cursor=…
```

```json
{ "submissions": [
    { "id": "sub_…", "submitted_at": "…",
      "answers": { "parent_name": "Anita", "child_age": "8_9" } }
  ],
  "next_cursor": null }
```

Same `answers` shape as the webhook, so one parser handles both. Newest first,
cursor paginated. `since` is what makes backfill possible.

### `POST | GET | DELETE /api/v1/forms/:id/webhooks`

Per-form webhook with a returned `secret`. The delivery format already exists
and should not change — `event: "form.submitted"`, Standard Webhooks headers
(`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64>`), and
`evt_form_<submissionId>` as the event id for idempotency.

**Correction, 15 Aug:** this section originally said `X-Signature`, which was
wrong — taken from an older planning document rather than the shipped
`webhook-delivery` implementation. The reference page has it right; the forms
guide repeated our mistake.

Returning the secret on create is the missing piece: today it can only be read
from the dashboard, so an API-provisioned form cannot verify its own webhooks.

---

## What I am *not* asking for

Worth stating, so the surface stays small:

- No theming or layout control via API. Design belongs in the builder.
- No submission deletion or editing.
- No file-upload field provisioning in v1.
- No analytics endpoints.

---

## Then MCP becomes nearly free

Manish mentioned wanting an MCP server so an agent could set Automette up
conversationally. **Build this API first and that becomes a thin wrapper** —
an MCP server is mostly a typed shim over an HTTP API, and the hard part is
having the API at all. Doing MCP first would mean writing the logic twice.

Sequence: forms API → MCP server exposing forms + templates + renders.

---

## How English Ladder will use it

So the shape can be sanity-checked against a real consumer:

1. `POST /forms` with the eight fields of "Book a free class"
2. `POST /forms/:id/publish` → embed `public_url` on the marketing page
3. `POST /forms/:id/webhooks` pointing at `/api/webhooks/automette-form`
4. Verify `X-Signature`, dedupe on `submission_id`, insert an `enquiries` row
5. `GET /forms/:id/submissions?since=…` on deploy, to catch anything missed

Steps 1–3 happen once. Steps 4–5 are the running integration.
