import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: cards } = await supabase
    .from("log_cards")
    .select("*, log_entries(*)")
    .order("created_at", { ascending: false });

  return <DashboardClient initialCards={cards || []} user={user} />;
}
