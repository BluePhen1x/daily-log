"use client";

import { useState, useRef, useMemo } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogCardWithEntries, LogEntry } from "@/lib/types";
import Link from "next/link";

interface CardDetailClientProps {
  card: LogCardWithEntries;
}

export default function CardDetailClient({ card: initialCard }: CardDetailClientProps) {
  const [card, setCard] = useState<LogCardWithEntries>(initialCard);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const symbol = card.currency === "DHS" ? "DHS" : card.currency === "Rupees" ? "₹" : "$";
  const total = card.log_entries.reduce((sum, e) => sum + e.amount, 0);

  const savedDescriptions = useMemo(() => {
    const seen = new Set<string>();
    return card.log_entries
      .filter((e) => {
        if (!e.description || seen.has(e.description)) return false;
        seen.add(e.description);
        return true;
      })
      .map((e) => e.description as string);
  }, [card.log_entries]);

  const filteredDescriptions = useMemo(() => {
    if (!description.trim()) return savedDescriptions;
    return savedDescriptions.filter((d) =>
      d.toLowerCase().includes(description.toLowerCase())
    );
  }, [description, savedDescriptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    setLoading(true);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", card.user_id)
      .single();

    if (!existingProfile) {
      await supabase.from("profiles").insert({
        id: card.user_id,
        email: "",
        full_name: null,
      });
    }

    const { data, error } = await supabase
      .from("log_entries")
      .insert({
        card_id: card.id,
        user_id: card.user_id,
        amount: parsedAmount,
        description: description.trim() || null,
      })
      .select()
      .single();

    if (!error && data) {
      setCard((prev) => ({
        ...prev,
        log_entries: [data as LogEntry, ...prev.log_entries],
      }));
      setAmount("");
      setDescription("");
      setShowSuggestions(false);
      inputRef.current?.focus();
    }
    setLoading(false);
  };

  const handleDeleteEntry = async (entryId: string) => {
    const { error } = await supabase
      .from("log_entries")
      .delete()
      .eq("id", entryId);

    if (!error) {
      setCard((prev) => ({
        ...prev,
        log_entries: prev.log_entries.filter((e) => e.id !== entryId),
      }));
    }
  };

  const handleDeleteCard = async () => {
    if (!confirm(`Delete "${card.card_name}" and all its entries?`)) return;

    const { error } = await supabase
      .from("log_cards")
      .delete()
      .eq("id", card.id);

    if (!error) {
      router.push("/dashboard");
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) + " " + d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">{card.card_name}</h1>
            <p className="text-sm text-gray-400">
              {card.log_entries.length} entries · Total: {symbol}{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {card.currency}
          </span>
          <button
            onClick={handleDeleteCard}
            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            aria-label="Delete card"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">
                  {symbol}
                </span>
                <input
                  ref={inputRef}
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                  className="w-full pl-14 pr-4 py-3 text-lg border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !amount}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-xl transition-colors text-lg"
              >
                {loading ? "..." : "Add"}
              </button>
            </div>
            <div className="relative">
              <input
                ref={descRef}
                type="text"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Add a note (optional)"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {showSuggestions && filteredDescriptions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredDescriptions.map((desc) => (
                    <button
                      key={desc}
                      type="button"
                      onMouseDown={() => {
                        setDescription(desc);
                        setShowSuggestions(false);
                        inputRef.current?.focus();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      {desc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <h2 className="text-sm font-medium text-gray-500 mb-3 px-1">History</h2>

        {card.log_entries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-gray-300 text-sm">No entries yet. Add your first one above.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {card.log_entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-5 py-4 group"
              >
                <div>
                  <span className="text-lg font-medium text-gray-900">
                    {symbol}{entry.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  {entry.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{entry.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.created_at)}</p>
                </div>
                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="p-1.5 text-gray-200 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
