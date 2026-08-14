import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

/**
 * Amazon SES. Ported from the Automette codebase and reusing the same SES
 * account (eu-west-1) until this program has its own verified sending domain.
 *
 * The client is created lazily on first send, never at module load: build-time
 * tooling that merely imports this module has no runtime env vars, and a
 * module-level client would capture `region: undefined` and bake it in.
 *
 * Emails are plain text on purpose. It suits the voice in docs/design-and-copy.md
 * — a teacher writing to a parent, not a marketing template — and plain text has
 * markedly better deliverability.
 */
let client: SESv2Client | null = null;

function sesClient() {
  if (!client) {
    client = new SESv2Client({
      // Its own var, defaulting to AWS_REGION. SES identities are per-region, so
      // moving sending later must not require touching other AWS config.
      region: process.env.AWS_SES_REGION ?? process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/**
 * SES answers every accepted send with a MessageId. Accepted is NOT delivered —
 * that id is the only handle for tying a message to its later bounce or
 * complaint event, so callers should log it.
 */
export type SentEmail = { id?: string };

/**
 * Swap the display name in front of the sending address, keeping the address.
 * SES verifies the domain, not the name, so we can send as the program's name
 * from the verified Automette identity with no extra SES setup.
 */
export function fromAddress(fromName?: string): string {
  const configured = process.env.EMAIL_FROM!;
  // Strip control chars first: this string ends up in a mail header, where a
  // newline is the classic injection vector.
  const name = fromName?.replace(/[\x00-\x1F\x7F]+/g, " ").trim();
  if (!name) return configured;

  const addr = configured.match(/<([^>]+)>/)?.[1]?.trim() ?? configured.trim();
  // RFC 5322: a display name containing specials must be a quoted-string.
  const quoted = /[(),.:;<>@[\]"\\]/.test(name)
    ? `"${name.replace(/([\\"])/g, "\\$1")}"`
    : name;
  return `${quoted} <${addr}>`;
}

export async function sendEmail({
  to,
  subject,
  text,
  replyTo,
  fromName,
}: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  /** Display name only; the address always stays EMAIL_FROM. */
  fromName?: string;
}): Promise<SentEmail> {
  const res = await sesClient().send(
    new SendEmailCommand({
      FromEmailAddress: fromAddress(fromName),
      Destination: { ToAddresses: [to] },
      ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
      ...(process.env.AWS_SES_CONFIGURATION_SET
        ? { ConfigurationSetName: process.env.AWS_SES_CONFIGURATION_SET }
        : {}),
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" } },
        },
      },
    }),
  );
  return { id: res.MessageId };
}

export const ADMIN_EMAIL = "msahajwani@gmail.com";
