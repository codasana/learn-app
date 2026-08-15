import "server-only";

import { putObject, publicUrl, safeName, storageKey } from "@/lib/r2";

/**
 * Automette — certificates, reports and achievement cards.
 *
 * We are a CUSTOMER of Automette. Everything here goes through its public v1
 * API with an API key, exactly as any other customer's integration would. No
 * shared code, no shared database, no back doors. That constraint is the
 * point: if something is awkward from here, it is awkward for every customer,
 * and the fix belongs in Automette rather than in a shortcut taken here.
 *
 * What the API gives us, and how we use it:
 *
 *  - Templates are read-only. They are design work and belong in Automette's
 *    editor, so Sheeba builds them there and this app lists them for her to
 *    pick from. Nothing hardcodes a template id.
 *  - Renders can be synchronous (`async: false`), which is what a teacher
 *    pressing "generate" wants — she gets the document rather than a promise.
 *    Automette falls back to async past 30s and we poll.
 *  - A per-render `webhook_url` exists for the long ones. Better than the
 *    account-wide webhook subscription, which fires for every render on the
 *    team and would need filtering.
 */

const TIMEOUT_MS = 45_000;

function base(): string {
  return (
    process.env.AUTOMETTE_API_BASE ?? "https://automette.com/api/v1"
  ).replace(/\/+$/, "");
}

function key(): string {
  const k = process.env.AUTOMETTE_API_KEY;
  if (!k) {
    throw new Error(
      "AUTOMETTE_API_KEY is not set. Document generation needs it in .env.local.",
    );
  }
  return k;
}

/** True when documents can be generated, for UI that should degrade quietly. */
export function documentsReady(): boolean {
  return Boolean(process.env.AUTOMETTE_API_KEY);
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${key()}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await res.text();
  if (!res.ok) {
    // Automette answers errors as {"error": "..."}; fall back to the raw body
    // so a proxy's HTML error page is still readable in a log.
    let detail = text.slice(0, 300);
    try {
      detail = (JSON.parse(text) as { error?: string }).error ?? detail;
    } catch {
      /* keep the raw text */
    }
    throw new Error(`Automette ${res.status}: ${detail}`);
  }

  return JSON.parse(text) as T;
}

/* ------------------------------------------------------------------ */
/* Templates — read-only, by design                                    */
/* ------------------------------------------------------------------ */

export type Template = {
  id: string;
  name: string;
  engine: string;
  allowed_formats: string[];
};

export type TemplateField = {
  key: string;
  type: string;
  label: string;
  required: boolean;
};

export async function listTemplates(): Promise<Template[]> {
  return call<Template[]>("/templates");
}

/**
 * A template and the fields it expects.
 *
 * Worth fetching rather than assuming: the teacher can change a template in
 * Automette at any time, and a report that silently renders with a missing
 * field is worse than one that refuses.
 */
export async function getTemplate(
  id: string,
): Promise<Template & { fields: TemplateField[] }> {
  return call<Template & { fields: TemplateField[] }>(`/templates/${id}`);
}

/* ------------------------------------------------------------------ */
/* Renders                                                             */
/* ------------------------------------------------------------------ */

export type Render = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  url: string | null;
  format: string;
  template_id: string;
  template_name: string;
  error: string | null;
};

export async function startRender(input: {
  templateId: string;
  data: Record<string, unknown>;
  format?: string;
  /** Omit to render synchronously, which is what a teacher waiting wants. */
  webhookUrl?: string;
}): Promise<Render> {
  return call<Render>("/renders", {
    method: "POST",
    body: {
      template_id: input.templateId,
      data: input.data,
      format: input.format ?? "pdf",
      async: Boolean(input.webhookUrl),
      ...(input.webhookUrl ? { webhook_url: input.webhookUrl } : {}),
    },
  });
}

export async function getRender(id: string): Promise<Render> {
  return call<Render>(`/renders/${id}`);
}

/**
 * Renders and waits.
 *
 * Automette renders inline when it can and hands back a pending render when it
 * cannot, so a caller that only handled one of those would work until the day
 * a document got big. Polling is gentle and bounded — a document that has not
 * appeared in a minute is a failure worth surfacing, not worth waiting on.
 */
export async function renderAndWait(
  input: { templateId: string; data: Record<string, unknown>; format?: string },
  { timeoutMs = 60_000, intervalMs = 2_000 } = {},
): Promise<Render> {
  let render = await startRender(input);

  const deadline = Date.now() + timeoutMs;
  while (
    (render.status === "pending" || render.status === "processing") &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, intervalMs));
    render = await getRender(render.id);
  }

  if (render.status !== "completed" || !render.url) {
    throw new Error(
      render.error ?? `Render ${render.id} ended as "${render.status}".`,
    );
  }
  return render;
}

/* ------------------------------------------------------------------ */
/* Keeping a copy                                                      */
/* ------------------------------------------------------------------ */

/**
 * Renders, then stores the file in our own R2 and returns our URL.
 *
 * The URL Automette returns points at Automette's storage. That is fine for a
 * preview and wrong for anything handed to a family: a certificate emailed in
 * December must still open in June, and its lifetime should not depend on
 * another product's retention policy — even one we happen to own. Documents a
 * family keeps are ours to keep.
 */
export async function renderAndStore(input: {
  templateId: string;
  data: Record<string, unknown>;
  format?: string;
  /** Folder in the bucket, e.g. "reports" or "certificates". */
  folder: string;
  /** Becomes the download name a parent sees. */
  filename: string;
}): Promise<{ renderId: string; fileUrl: string }> {
  const render = await renderAndWait({
    templateId: input.templateId,
    data: input.data,
    format: input.format,
  });

  const res = await fetch(render.url!, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not fetch the rendered file (HTTP ${res.status}).`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());

  const format = input.format ?? "pdf";
  const key = storageKey(input.folder, `${safeName(input.filename)}.${format}`);
  await putObject(
    key,
    bytes,
    format === "pdf" ? "application/pdf" : "application/octet-stream",
  );

  return { renderId: render.id, fileUrl: publicUrl(key) };
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

/**
 * Hosted forms.
 *
 * Provisioned from code rather than clicked together, so the field keys — the
 * contract the webhook delivers under — live in this repository next to the
 * code that reads them. A form built by hand in a dashboard is a contract
 * nobody can diff.
 *
 * Design, theme and layout are deliberately not set here. Those belong in
 * Automette's builder; this only decides what is asked.
 */

export type FormFieldSpec = {
  key: string;
  type:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "textarea"
    | "select"
    | "checkbox"
    | "date";
  label: string;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
};

export type Form = {
  id: string;
  title: string;
  status: "draft" | "published";
  version: number | null;
  public_url: string | null;
  embed_url: string | null;
  fields?: FormFieldSpec[];
};

export async function listForms(): Promise<Form[]> {
  const res = await call<{ forms: Form[] }>("/forms");
  return res.forms;
}

export async function getForm(id: string): Promise<Form> {
  return call<Form>(`/forms/${id}`);
}

export async function createForm(input: {
  title: string;
  description?: string;
  submitLabel?: string;
  fields: FormFieldSpec[];
}): Promise<Form> {
  return call<Form>("/forms", {
    method: "POST",
    body: {
      title: input.title,
      description: input.description,
      submit_label: input.submitLabel,
      fields: input.fields,
    },
  });
}

/**
 * Who gets emailed when someone submits.
 *
 * Fields are referenced by the key we chose, not by an internal id — the API
 * maps it at its own boundary, which is what keeps our keys the only contract
 * we have to hold.
 */
export type FormNotifications = {
  notifications?: {
    emails: string[];
    reply_to_field?: string;
    include_document_link?: boolean;
  } | null;
  respondent_confirmation?: {
    email_field: string;
    subject: string;
    message: string;
  } | null;
  sender_name?: string;
};

export async function updateForm(
  id: string,
  patch: FormNotifications & { title?: string; description?: string },
): Promise<Form> {
  return call<Form>(`/forms/${id}`, { method: "PATCH", body: patch });
}

export async function publishForm(id: string): Promise<Form> {
  return call<Form>(`/forms/${id}/publish`, { method: "POST" });
}

export type FormWebhook = {
  id: string;
  url: string;
  active: boolean;
  /** Returned ONLY when created. Store it then or lose it. */
  secret?: string;
  secret_hint?: string;
};

export async function createFormWebhook(
  formId: string,
  url: string,
): Promise<FormWebhook> {
  return call<FormWebhook>(`/forms/${formId}/webhooks`, {
    method: "POST",
    body: { url, events: ["form.submitted"] },
  });
}

export async function listFormWebhooks(
  formId: string,
): Promise<FormWebhook[]> {
  const res = await call<{ webhooks: FormWebhook[] }>(
    `/forms/${formId}/webhooks`,
  );
  return res.webhooks;
}

export type FormSubmission = {
  id: string;
  submitted_at: string;
  answers: Record<string, unknown>;
};

/**
 * Submissions, for backfill.
 *
 * Webhooks are the live path; this is what recovers the ones missed while we
 * were down. `since` is the whole point of it.
 */
export async function listSubmissions(
  formId: string,
  opts: { since?: string; limit?: number; cursor?: string } = {},
): Promise<{ submissions: FormSubmission[]; next_cursor: string | null }> {
  const q = new URLSearchParams();
  if (opts.since) q.set("since", opts.since);
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.cursor) q.set("cursor", opts.cursor);
  const suffix = q.toString() ? `?${q}` : "";
  return call<{ submissions: FormSubmission[]; next_cursor: string | null }>(
    `/forms/${formId}/submissions${suffix}`,
  );
}
