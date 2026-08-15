import type { Role } from "@/lib/roles";

/**
 * Where a signed-in person belongs.
 *
 * Sign-in used to push everyone to "/", which meant Sheeba landed on the
 * marketing page and had to find her own way in. One function, so the answer
 * cannot drift between the login form, the header and the route guards.
 *
 * This lives apart from session.ts because the login form is a client
 * component and session.ts imports next/headers.
 *
 * Parents get "/" only because their dashboard does not exist yet. When it
 * does, this line is the whole change.
 */
export function homeFor(role: Role | string | null | undefined): string {
  switch (role) {
    case "teacher":
    case "owner":
      return "/teacher";
    case "student":
      return "/learn";
    default:
      return "/";
  }
}
