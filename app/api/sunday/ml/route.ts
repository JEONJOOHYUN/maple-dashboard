// Weekly foundation-model scores for the Sunday prediction (lib/sunday/ml.ts), posted by the GitHub Actions job
// (.github/workflows/sunday-ml.yml, scripts/sunday-ml). A route handler is required because the job runs outside
// Vercel. The job holds only ML_UPLOAD_SECRET, which can write these scores and nothing else, so the database key
// never leaves Vercel (the service role key also covers the nyamnyam schema in the same project).
// POST { sunday, model, data_end, data_hash, scores } with Authorization: Bearer ML_UPLOAD_SECRET. The same Sunday and
// model is replaced: a later run may have more or corrected weeks (pages use a row only when its data_hash matches, mlFor).
import { revalidateTag } from "next/cache";
import { bearerAuthorized } from "@/lib/bearer-auth";
import { SUNDAY_ML_TAG } from "@/lib/sunday/live";
import { parseMlUpload } from "@/lib/sunday/ml";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  if (!bearerAuthorized(request, process.env.ML_UPLOAD_SECRET)) return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const row = parseMlUpload(body);
  if (typeof row === "string") return Response.json({ error: row }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from("sunday_ml_scores")
    .upsert({ ...row, computed_at: new Date().toISOString() }, { onConflict: "sunday,model" });
  if (error) {
    console.error("sunday_ml_scores write failed", error.message);
    return Response.json({ error: "write failed" }, { status: 502 });
  }
  revalidateTag(SUNDAY_ML_TAG, { expire: 0 });
  return Response.json({ saved: { sunday: row.sunday, model: row.model, data_end: row.data_end, bundles: Object.keys(row.scores).length } });
}
