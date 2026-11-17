// Weekly Sunday model job, step 1 of 3 (.github/workflows/sunday-ml.yml): the Sundays the site knows (bundled history +
// published weeks, read with the public key like the pages) -> feature rows for the Sunday the pages predict
// (lib/sunday/ml-features.ts). Writes out/rows.csv + out/meta.json next to this file.
// When that Sunday already has scores computed from the same weeks (same fingerprint, lib/sunday/ml.ts mlDataHash) it
// writes nothing and sets skip=true for the workflow (the job runs several times a week; only the first run after a new
// or corrected week has work to do).
// env: SUPABASE_URL, SUPABASE_ANON_KEY. Argument YYYY-MM-DD = that Sunday instead (computed even if stored).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUNDAYS, predictionTarget } from "../../lib/sunday/history.ts";
import { ML_COLUMNS, mlRows } from "../../lib/sunday/ml-features.ts";
import { ML_MODEL, mlDataHash } from "../../lib/sunday/ml.ts";
import { mergePatches } from "../../lib/sunday/patches.ts";
import { SEASON_PATCHES } from "../../lib/sunday/predict.ts";
import { mergeStored } from "../../lib/sunday/stored.ts";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");

async function rest(query) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are required");
  const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key } });
  if (!res.ok) throw new Error(`${query.split("?")[0]}: HTTP ${res.status}`);
  return res.json();
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

const asked = process.argv[2];
if (asked && !/^\d{4}-\d{2}-\d{2}$/.test(asked)) throw new Error("argument must be YYYY-MM-DD");
const stored = await rest("sunday_weeks?select=sunday,notice_id,special,items,updated_at,images&status=in.(auto,confirmed)&order=sunday");
const weeks = mergeStored(SUNDAYS, stored);
// The season patch dates the pages use (lib/sunday/patches.ts): the bundled list + the ones the Cron found. If the rows
// cannot be read, the bundled list, as the pages fall back to; a mismatch only makes the pages use the statistical
// model until the next run.
let patchRows = [];
try {
  patchRows = await rest("sunday_patches?select=season_key,date,season,confirmed&order=date");
} catch (e) {
  console.log(`sunday_patches not read (${e.message}): using the bundled patch dates`);
}
const patches = mergePatches(SEASON_PATCHES, patchRows);
const sunday = asked || predictionTarget(new Date(), weeks);
const dataEnd = weeks.filter((w) => w.date < sunday).at(-1)?.date;
if (!dataEnd) throw new Error(`no Sunday before ${sunday}`);
const dataHash = mlDataHash(weeks, sunday, patches);

if (!asked) {
  const have = await rest(`sunday_ml_scores?select=data_hash&sunday=eq.${sunday}&model=eq.${encodeURIComponent(ML_MODEL)}`);
  if (have.some((r) => r.data_hash === dataHash)) {
    console.log(`${sunday}: already scored from the weeks up to ${dataEnd}, nothing to do`);
    setOutput("skip", "true");
    process.exit(0);
  }
}

const { train, target } = mlRows(weeks, sunday, patches);
const cell = (v) => (Number.isFinite(v) ? String(v) : "");
const lines = [["date", "bundle", "y", ...ML_COLUMNS].join(",")];
for (const r of [...train, ...target]) lines.push([r.date, r.bundle, r.y ?? "", ...r.x.map(cell)].join(","));
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "rows.csv"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ sunday, data_end: dataEnd, data_hash: dataHash, model: ML_MODEL, train: train.length, target: target.length }));
console.log(`${sunday}: ${train.length} training rows, ${target.length} bundles to score, weeks up to ${dataEnd}`);
setOutput("skip", "false");
