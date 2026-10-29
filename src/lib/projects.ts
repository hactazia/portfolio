import { apiFetch } from "@/lib/api";

/**
 * Projects of the "01 — Selected work" list.
 *
 * Same rule as the rest of the page: the API (`GET /api/projects`) is the only
 * source, and a project that has not been retrieved is a skeleton.
 */
export type Project = {
  slug: string;
  title: string;
  /** Short label shown on the right of the row, e.g. "Developer platform". */
  category: string;
  /** Long description; other clients use it, the row does not. */
  summary: string;
  tags: string[];
  year: number;
  featured?: boolean;
  repo?: string;
};

type ProjectsPayload = Project[];

/** Fetches the projects. Throws when the API is unreachable or answers nothing. */
export async function fetchProjects(): Promise<Project[]> {
  const payload = await apiFetch<ProjectsPayload>("/projects");
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Empty projects payload");
  }
  return payload;
}

/** Row index as shown in the list: derived from the order, never stored. */
export function projectIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** Year range of the list, e.g. "2024 — 2026". */
export function projectYearRange(projects: Project[]): string | null {
  if (!projects.length) return null;
  const years = projects.map((project) => project.year);
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} — ${max}`;
}
