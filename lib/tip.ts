/**
 * Props for a hover bubble (components/tip-layer.tsx) that says what the screen does not: the same words also go to
 * screen readers as the element's description, as the browser's `title` did. A bubble that only shows a cut-short
 * name needs no description (the name is read whole already), so it takes a bare `data-tip`.
 */
export function extraTip(text: string | undefined) {
  return text ? { "data-tip": text, "aria-description": text } : {};
}
