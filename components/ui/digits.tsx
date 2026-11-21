/**
 * A number whose digits each take the same width, for a column of numbers in the number font: that font's digits
 * are not one width (its 1 is a third narrower than its 0) and it has no tabular feature, so right-aligned values did
 * not line up digit under digit. 0.68em is the widest digit. Commas, dots and units keep their own width.
 * Screen readers get the plain text once; the spaced copy is for the eye only.
 * `relative` keeps that hidden copy inside a scrolling table: an absolutely placed element whose containing block is
 * outside the scroll box is not clipped by it, and each one widened the whole page on phones.
 */
export function Digits({ children }: { children: string | number }) {
  const text = String(children);
  return (
    <span className="relative">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {[...text].map((ch, i) =>
          ch >= "0" && ch <= "9" ? (
            <span key={i} className="inline-block w-[0.68em] text-center">
              {ch}
            </span>
          ) : (
            ch
          )
        )}
      </span>
    </span>
  );
}
