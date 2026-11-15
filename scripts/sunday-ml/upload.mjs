// Weekly Sunday model job, step 3 of 3: posts out/scores.json (predict.py) to the site, which stores it
// (app/api/sunday/ml). env: SITE_URL (https://...), ML_UPLOAD_SECRET (the same value as on Vercel).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
const site = process.env.SITE_URL;
const secret = process.env.ML_UPLOAD_SECRET;
if (!site || !secret) throw new Error("SITE_URL / ML_UPLOAD_SECRET are required");

const res = await fetch(new URL("/api/sunday/ml", site), {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
  body: fs.readFileSync(path.join(OUT, "scores.json"), "utf8"),
});
const text = await res.text();
console.log(`upload: HTTP ${res.status} ${text.slice(0, 300)}`);
if (!res.ok) process.exit(1);
