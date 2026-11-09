import type { Metadata } from "next";
import { SpecCheck, type SpecView } from "@/components/spec/spec-check";
import { NexonError } from "@/lib/nexon/api";
import { getSpec } from "@/lib/spec/load";

export const metadata: Metadata = { title: "숨은 스펙업" };

// MapleStory names are at most 12 characters; anything longer cannot exist, so skip the API call.
const MAX_NAME = 12;

type Props = { searchParams: Promise<{ name?: string | string[] }> };

async function view(name: string): Promise<SpecView> {
  if (!name) return { kind: "empty" };
  if (name.length > MAX_NAME || /\s/.test(name)) return { kind: "notFound", name };
  try {
    const got = await getSpec(name);
    if (!got.ok) return { kind: "notFound", name };
    return { kind: "result", result: got.result, at: got.at };
  } catch (e) {
    if (e instanceof NexonError && e.kind === "quota") return { kind: "quota", name };
    console.error("spec-check failed", e);
    return { kind: "failed", name };
  }
}

export default async function SpecPage({ searchParams }: Props) {
  const raw = (await searchParams).name;
  const name = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
  return <SpecCheck key={name} name={name} view={await view(name)} />;
}
