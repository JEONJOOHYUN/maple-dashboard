"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SiteValues } from "@/lib/site-values/values";

// The default values the admin changed, handed down by the root layout (the server reads them, so the first HTML
// already has them). Screens read through lib/site-values/values.ts · revenue.ts: starItems(values), crystalTable(values) …
// Only the type is imported: this file is on every page, and the tables behind those functions are not.
const Context = createContext<SiteValues>({});

export function SiteValuesProvider({ values, children }: { values: SiteValues; children: ReactNode }) {
  return <Context value={values}>{children}</Context>;
}

export const useSiteValues = (): SiteValues => useContext(Context);
