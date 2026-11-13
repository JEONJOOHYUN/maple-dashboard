/**
 * The address as it is when it is an https one on nexon.com, else "". Addresses the Open API (or a notice read from
 * it) hands back go into `href` and `src`, so anything else is dropped rather than shown.
 */
export function nexonUrl(text: string | undefined | null): string {
  try {
    const url = new URL(text ?? "");
    return url.protocol === "https:" && (url.hostname === "nexon.com" || url.hostname.endsWith(".nexon.com")) ? url.href : "";
  } catch {
    return "";
  }
}
