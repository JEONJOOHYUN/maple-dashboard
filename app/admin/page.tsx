import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminBoard } from "@/components/admin/board";
import { Message } from "@/components/message";
import { getAdmin } from "@/lib/auth/admin";
import { adminData } from "@/lib/site-values/server";

// The title is the admin's alone: to anyone else the tab says nothing about what is here.
export async function generateMetadata(): Promise<Metadata> {
  const robots = { index: false, follow: false };
  return (await getAdmin()) ? { title: "관리자", robots } : { robots };
}

// Not in the menu (it is the same for every visitor): admins come here from 내 정보. To anyone else the page does
// not exist. Every write checks the admin again (./actions.ts).
export default async function AdminPage() {
  const admin = await getAdmin();
  if (!admin) notFound();
  const data = await adminData();
  if (!data) return <Message heading title="값을 못 불러옴" sub="잠시 뒤 새로 고침" />;
  return <AdminBoard values={data.values} history={data.history} admins={data.admins} today={data.today} />;
}
