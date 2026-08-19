import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import CardDetailClient from "./CardDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CardDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: card } = await supabase
    .from("log_cards")
    .select("*, log_entries(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!card) {
    notFound();
  }

  card.log_entries.sort(
    (a: { created_at: string }, b: { created_at: string }) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return <CardDetailClient card={card} />;
}
