// Keys remembered in this browser. Records are stored apart by account, so a person with two NEXON accounts
// (or looking at a friend's records) switches between keys without asking NEXON for the same days again.
export type SavedKey = { key: string; account: string; name?: string };

/** The list with this key in it: added at the end, or put in place of the entry for the same account (its name is kept). */
export function withKey(list: SavedKey[], next: SavedKey): SavedKey[] {
  const at = list.findIndex((k) => k.account === next.account);
  if (at < 0) return [...list, next];
  const name = next.name ?? list[at].name;
  return list.map((k, i) => (i === at ? { key: next.key, account: next.account, ...(name ? { name } : {}) } : k));
}

export const withoutKey = (list: SavedKey[], account: string): SavedKey[] => list.filter((k) => k.account !== account);

/** Names a key after the account's main character. The first name stays: it is what the user learned to look for. */
export function withName(list: SavedKey[], account: string, name: string): SavedKey[] {
  if (!name || !list.some((k) => k.account === account && !k.name)) return list;
  return list.map((k) => (k.account === account ? { ...k, name } : k));
}

/** What a saved key is called on screen: a character of that account, or its place in the list. Never the key itself. */
export const keyLabel = (k: SavedKey, index: number): string => k.name || `저장된 키 ${index + 1}`;
