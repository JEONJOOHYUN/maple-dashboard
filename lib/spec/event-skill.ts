// "보약": the buff skill every seasonal event hands out. Its name changes with the event, so it is read off NEXON's
// event notices: a running notice titled "[이벤트 스킬] - <skill name>" (2026-11-13: "[이벤트 스킬] - 아르고 호의 가호",
// and the characters' 0th-job skill lists carry a skill of exactly that name).
// Only whether the skill was taken can be told: how its points were spent is not in the API.
// A title in another form simply gives no name, so the check drops out instead of warning wrongly.

export type EventNotice = { title?: string; date_event_start?: string; date_event_end?: string };

const TITLE = /^\s*\[이벤트 스킬\]\s*-\s*(.+?)\s*$/;

/** Names of the event skills whose event is running at `now` (ms). */
export function eventSkillNames(notices: readonly EventNotice[], now: number): string[] {
  const names: string[] = [];
  for (const notice of notices) {
    const name = TITLE.exec(notice.title ?? "")?.[1];
    if (!name) continue;
    const start = Date.parse(notice.date_event_start ?? "");
    const end = Date.parse(notice.date_event_end ?? "");
    if (!Number.isFinite(start) || !Number.isFinite(end) || now < start || now > end) continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}
