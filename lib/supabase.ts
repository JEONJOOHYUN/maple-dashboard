import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다. .env.local.example을 참고하세요."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
