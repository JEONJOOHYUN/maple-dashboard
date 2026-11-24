// The header's login mark, without making any page dynamic: a readable cookie (HINT_COOKIE, one letter) is copied
// onto <html> before the first paint, and two CSS rules (app/globals.css: .when-guest / .when-member) pick what the
// header shows. Display only: every member page checks the real session (lib/auth/server.ts getMember).
import { HINT_COOKIE } from "./rules";

/** Runs in the browser. Anything but one expected letter becomes a dot: the value ends up inside a CSS string. */
function apply(cookieName: string) {
  try {
    const root = document.documentElement;
    const found = document.cookie.split("; ").find((part) => part.startsWith(cookieName + "="));
    if (!found) {
      delete root.dataset.member;
      root.style.removeProperty("--member-letter");
      return;
    }
    const raw = decodeURIComponent(found.slice(cookieName.length + 1));
    const letter = /^[A-Z0-9]$/.test(raw) ? raw : "·";
    root.dataset.member = letter;
    root.style.setProperty("--member-letter", '"' + letter + '"');
  } catch {
    // Cookies blocked: the header stays on the signed-out look.
  }
}

/** Inline script for the top of <body>: the mark is right before anything is painted. */
export const MEMBER_HINT_SCRIPT = `(${apply.toString()})(${JSON.stringify(HINT_COOKIE)})`;

/** After a navigation without a page load (signing out): read the cookie again. */
export function syncMemberHint() {
  apply(HINT_COOKIE);
}
