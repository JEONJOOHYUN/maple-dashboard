/**
 * A character's face: the middle of NEXON's 300×300 look picture, where the head stands. The initial until it is here.
 * Shared by boss revenue and homework.
 */
export function Face({ src, name }: { src?: string; name: string }) {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted font-bold text-muted-foreground lg:size-10">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- NEXON's character picture, shown as is
        <img src={src} alt="" className="absolute top-[-56px] left-[-56px] size-[150px] max-w-none lg:top-[-62px] lg:left-[-63px] lg:size-[167px]" />
      ) : (
        name[0]
      )}
    </span>
  );
}
