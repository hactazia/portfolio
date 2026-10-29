import { apiFetch, apiUrl } from "@/lib/api";

/**
 * Cards of the tilted "scrapbook" showcase.
 *
 * The API (`GET /api/showcase`) is the single source of truth: there is no
 * bundled copy of this content, so a card that has not been retrieved yet is
 * rendered as a skeleton rather than as invented data.
 */
export type ShowcaseCard = {
  id: string;
  /** Short label shown on the back face, e.g. "AtelierVR". */
  title: string;
  /** Context of the shot, e.g. "Open source", "Editor", "Avatar". */
  place: string;
  /** Date label kept verbatim, e.g. "08.30.25". */
  date: string;
  /** Painted under the photo; also the placeholder colour when `image` is null. */
  tone: string;
  /** Site-relative path under `public/`, or an absolute URL. */
  image?: string | null;
  /** `background-position` used to crop the shot inside the 4:5 plate. */
  focus?: string | null;
  href?: string | null;
  /** Label of the back face's action row (e.g. "Open", "In-house build"). */
  cta?: string | null;
};

type ShowcasePayload = { cards: ShowcaseCard[] };

/**
 * Resolves a card image to the URL the API serves it from.
 *
 * `image` is a site-relative asset path (`/showcase/unity.jpg`); the file lives
 * outside the static export and outside git, so `GET /api/assets/*` streams it.
 */
export function resolveCardImage(image: string | null | undefined): string | null {
  if (!image) return null;
  if (!image.startsWith("/")) return image;
  return apiUrl(`/assets${image}`);
}

/** Fetches the cards. Throws when the API is unreachable or answers nothing. */
export async function fetchShowcaseCards(): Promise<ShowcaseCard[]> {
  const payload = await apiFetch<ShowcasePayload>("/showcase");
  if (!Array.isArray(payload?.cards) || payload.cards.length === 0) {
    throw new Error("Empty showcase payload");
  }
  return payload.cards;
}
