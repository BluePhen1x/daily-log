"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { LogOut, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogCardWithEntries } from "@/lib/types";
import Link from "next/link";

interface DashboardClientProps {
  initialCards: LogCardWithEntries[];
  user: User;
}

export default function DashboardClient({ initialCards, user }: DashboardClientProps) {
  const [cards, setCards] = useState<LogCardWithEntries[]>(initialCards);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardCurrency, setNewCardCurrency] = useState("DHS");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName.trim()) return;
    setCreating(true);
    setCreateError(null);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        id: user.id,
        email: user.email || "",
        full_name: user.user_metadata?.full_name || null,
      });
    }

    const { data, error } = await supabase
      .from("log_cards")
      .insert({
        user_id: user.id,
        card_name: newCardName.trim(),
        currency: newCardCurrency,
      })
      .select("*, log_entries(*)")
      .single();

    if (error) {
      setCreateError(error.message);
      setCreating(false);
      return;
    }

    if (data) {
      setCards((prev) => [data as LogCardWithEntries, ...prev]);
      setNewCardName("");
      setNewCardCurrency("DHS");
      setShowCreateModal(false);
    }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Daily Log</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {cards.map((card) => {
          const total = card.log_entries.reduce((sum, e) => sum + e.amount, 0);
          const symbol = card.currency === "DHS" ? "DHS" : card.currency === "Rupees" ? "₹" : "$";
          return (
            <Link
              key={card.id}
              href={`/dashboard/${card.id}`}
              className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-100 transition-all"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">{card.card_name}</h2>
                <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  {card.currency}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {card.log_entries.length} entries
                {total > 0 && ` · ${symbol}${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              </p>
            </Link>
          );
        })}

        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-6 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors flex items-center justify-center gap-2 text-lg"
        >
          <Plus className="w-6 h-6" />
          Add New Card
        </button>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">New Card</h2>
              <button
                onClick={() => { setShowCreateModal(false); setNewCardName(""); setNewCardCurrency("DHS"); }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateCard}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Name</label>
              <input
                type="text"
                value={newCardName}
                onChange={(e) => setNewCardName(e.target.value)}
                placeholder="e.g. Karkala"
                autoFocus
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              />
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={newCardCurrency}
                onChange={(e) => setNewCardCurrency(e.target.value)}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white mb-4"
              >
                <option value="DHS">DHS (Dirham)</option>
                <option value="Rupees">Rupees (INR)</option>
                <option value="USD">USD (Dollar)</option>
              </select>
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
                  {createError}
                </div>
              )}
              <button
                type="submit"
                disabled={creating || !newCardName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
