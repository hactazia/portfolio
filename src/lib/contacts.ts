import { apiFetch } from "@/lib/api";

/**
 * Contact rows of the "04 — Contact" section.
 *
 * Same rule as the showcase: the API (`GET /api/contacts`) is the only source,
 * so a row that has not been retrieved yet renders as a skeleton instead of
 * stale bundled data.
 */
export type ContactRow = {
  /** Eyebrow of the row, e.g. "Email". */
  label: string;
  /** Lets other components pick a specific row without matching on text. */
  kind?: "email" | "profile";
  /** What the visitor reads, e.g. "contact@hactazia.fr". */
  value: string;
  /** Target of the row: `mailto:`, `https:`… */
  href: string;
  /** `rel` / `title` for identity links (ActivityPub uses `me`). */
  rel?: string;
  title?: string;
};

type ContactsPayload = { contacts: ContactRow[] };

/** Fetches the rows. Throws when the API is unreachable or answers nothing. */
export async function fetchContacts(): Promise<ContactRow[]> {
  const payload = await apiFetch<ContactsPayload>("/contacts");
  if (!Array.isArray(payload?.contacts) || payload.contacts.length === 0) {
    throw new Error("Empty contacts payload");
  }
  return payload.contacts;
}
