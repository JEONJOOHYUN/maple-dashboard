import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다. .env.local.example을 참고하세요."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Worker = {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
};

export type HuntingLog = {
  id: number;
  worker_id: number;
  log_date: string;
  pure_meso: number;
  fragment_count: number;
  created_at: string;
  updated_at: string;
};

// 조각을 경매장에 팔아 메소로 전환한 기록. (현금 정산과는 별개 단계)
export type FragmentSale = {
  id: number;
  worker_id: number;
  sold_at: string;
  fragment_count: number;
  fragment_price: number;
  gross_meso: number;
  fee_meso: number;
  net_meso: number;
};

export type Settlement = {
  id: number;
  worker_id: number;
  settled_at: string;
  fragment_price: number;
  cash_rate: number;
  fragment_count: number;
  pure_meso: number;
  fee_meso: number;
  incentive_meso: number;
  total_meso: number;
  krw_value: number;
};
