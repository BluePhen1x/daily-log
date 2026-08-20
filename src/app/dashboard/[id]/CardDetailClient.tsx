"use client";

import { useState, useRef, useMemo } from "react";
import { ArrowLeft, Trash2, Search, X, Calendar, Download, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogCardWithEntries, LogEntry } from "@/lib/types";
import Link from "next/link";
import ExcelImport from "@/components/ExcelImport";
import * as XLSX from "xlsx";

interface CardDetailClientProps {
  card: LogCardWithEntries;
}

export default function CardDetailClient({ card: initialCard }: CardDetailClientProps) {
  const normalizeDescs = (d: unknown): string[] => {
    if (Array.isArray(d)) return d.filter(Boolean);
    if (typeof d === "string" && d.length > 0) {
      try {
        const parsed = JSON.parse(d);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        return d.split(/[{},]/).map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const [card, setCard] = useState<LogCardWithEntries>(() => ({
    ...initialCard,
    log_entries: initialCard.log_entries.map((e) => ({
      ...e,
      descriptions: normalizeDescs(e.descriptions),
    })),
  }));
  const [amount, setAmount] = useState("");
  const [descInput, setDescInput] = useState("");
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterDescs, setFilterDescs] = useState<string[]>([]);
  const [filterDescInput, setFilterDescInput] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingDescs, setEditingDescs] = useState<string[]>([]);
  const [editingInput, setEditingInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const symbol = card.currency === "DHS" ? "DHS" : card.currency === "Rupees" ? "₹" : "$";
  const total = card.log_entries.reduce((sum, e) => sum + e.amount, 0);

  const allDescriptions = useMemo(() => {
    const seen = new Set<string>();
    card.log_entries.forEach((e) =>
      (e.descriptions || []).forEach((d) => {
        if (d) seen.add(d);
      })
    );
    return Array.from(seen).sort();
  }, [card.log_entries]);

  const filteredSuggestions = useMemo(() => {
    if (!descInput.trim()) return allDescriptions.filter((d) => !descriptions.includes(d));
    return allDescriptions.filter(
      (d) => d.toLowerCase().includes(descInput.toLowerCase()) && !descriptions.includes(d)
    );
  }, [descInput, allDescriptions, descriptions]);

  const addDescription = (desc: string) => {
    const trimmed = desc.trim();
    if (trimmed && !descriptions.includes(trimmed)) {
      setDescriptions((prev) => [...prev, trimmed]);
    }
    setDescInput("");
  };

  const removeDescription = (desc: string) => {
    setDescriptions((prev) => prev.filter((d) => d !== desc));
  };

  const handleDescKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addDescription(descInput);
    }
  };

  const filteredEntries = useMemo(() => {
    return card.log_entries.filter((entry) => {
      const rawDate = entry.source_date || entry.created_at;
      const entryDate = rawDate.slice(0, 10);
      if (dateFrom) {
        if (entryDate < dateFrom) return false;
      }
      if (dateTo) {
        if (entryDate > dateTo) return false;
      }
      if (filterDescs.length > 0) {
        const entryDescs = (entry.descriptions || []).map((d) => d.toLowerCase());
        if (!filterDescs.some((f) => entryDescs.includes(f.toLowerCase()))) return false;
      }
      if (filterDescInput.trim()) {
        const query = filterDescInput.toLowerCase();
        const entryDescs = (entry.descriptions || []).map((d) => d.toLowerCase());
        const matchesDesc = entryDescs.some((d) => d.includes(query));
        const matchesAmount = entry.amount.toString().includes(query);
        if (!matchesDesc && !matchesAmount) return false;
      }
      return true;
    });
  }, [card.log_entries, dateFrom, dateTo, filterDescs, filterDescInput]);

  const hasActiveFilters = dateFrom || dateTo || filterDescs.length > 0 || filterDescInput.trim();

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

    const { data } = await supabase
      .from("log_entries")
      .insert({
        card_id: card.id,
        user_id: card.user_id,
        amount: parsedAmount,
        descriptions: descriptions.length > 0 ? descriptions : [],
      })
      .select()
      .single();

    if (data) {
      const normalized = { ...data, descriptions: normalizeDescs(data.descriptions) } as LogEntry;
      setCard((prev) => ({
        ...prev,
        log_entries: [normalized, ...prev.log_entries],
      }));
      setAmount("");
      setDescriptions([]);
      setDescInput("");
      inputRef.current?.focus();
    }
    setLoading(false);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Delete this entry?")) return;

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

  const startEditing = (entry: LogEntry) => {
    setEditingEntryId(entry.id);
    setEditingDescs(entry.descriptions || []);
    setEditingInput("");
  };

  const addEditingDesc = (desc: string) => {
    const trimmed = desc.trim();
    if (trimmed && !editingDescs.includes(trimmed)) {
      setEditingDescs((prev) => [...prev, trimmed]);
    }
    setEditingInput("");
  };

  const removeEditingDesc = (desc: string) => {
    setEditingDescs((prev) => prev.filter((d) => d !== desc));
  };

  const saveEditing = async (entryId: string) => {
    const { error } = await supabase
      .from("log_entries")
      .update({ descriptions: editingDescs })
      .eq("id", entryId);

    if (!error) {
      setCard((prev) => ({
        ...prev,
        log_entries: prev.log_entries.map((e) =>
          e.id === entryId ? { ...e, descriptions: editingDescs } : e
        ),
      }));
    }
    setEditingEntryId(null);
    setEditingDescs([]);
  };

  const handleEntriesScanned = async (entries: { amount: number; descriptions: string[]; source_date?: string }[]) => {
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

    const newEntries = entries.map((e) => ({
      card_id: card.id,
      user_id: card.user_id,
      amount: e.amount,
      descriptions: e.descriptions || [],
      source_date: e.source_date || null,
    }));

    const { data, error } = await supabase
      .from("log_entries")
      .insert(newEntries)
      .select();

    if (error) {
      const fallback = entries.map((e) => ({
        card_id: card.id,
        user_id: card.user_id,
        amount: e.amount,
        descriptions: [],
        source_date: e.source_date || null,
      }));
      const result = await supabase
        .from("log_entries")
        .insert(fallback)
        .select();
      if (result.data) {
        setCard((prev) => ({
          ...prev,
          log_entries: [...(result.data as LogEntry[]), ...prev.log_entries],
        }));
      }
      return;
    }

    if (data) {
      setCard((prev) => ({
        ...prev,
        log_entries: [...(data as LogEntry[]), ...prev.log_entries],
      }));
    }
  };

  const handleExport = () => {
    const exportData = filteredEntries.map((entry) => ({
      Amount: entry.amount,
      Descriptions: (entry.descriptions || []).join(", "),
      "Source Date": entry.source_date || "",
      "Logged At": formatDate(entry.created_at),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, card.card_name);
    XLSX.writeFile(wb, `${card.card_name}_export.xlsx`);
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

  const filteredTotal = filteredEntries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-gray-900">{card.card_name}</h1>
            <p className="text-sm text-gray-400">
              {card.log_entries.length} entries · Total: {symbol}{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{card.currency}</span>
          <button onClick={handleDeleteCard} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" aria-label="Delete card">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">{symbol}</span>
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
              <button type="submit" disabled={loading || !amount} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-xl transition-colors text-lg">
                {loading ? "..." : "Add"}
              </button>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  onKeyDown={handleDescKeyDown}
                  placeholder="Add description (Enter to add)"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {filteredSuggestions.length > 0 && descInput && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                    {filteredSuggestions.slice(0, 6).map((desc) => (
                      <button
                        key={desc}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); addDescription(desc); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        {desc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {descriptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {descriptions.map((desc) => (
                    <span key={desc} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
                      {desc}
                      <button type="button" onClick={() => removeDescription(desc)} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-medium text-gray-500">
            {hasActiveFilters ? `${filteredEntries.length} results` : "History"}
          </h2>
          <div className="flex items-center gap-1">
            <ExcelImport symbol={symbol} onEntriesImported={handleEntriesScanned} />
            <button onClick={handleExport} className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                searchOpen || hasActiveFilters ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Search</label>
              <input
                type="text"
                value={filterDescInput}
                onChange={(e) => setFilterDescInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filterDescInput.trim()) {
                    e.preventDefault();
                    const val = filterDescInput.trim();
                    if (!filterDescs.includes(val)) setFilterDescs((p) => [...p, val]);
                    setFilterDescInput("");
                  }
                }}
                placeholder="Type to search descriptions or amounts (Enter to add tag)..."
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {filterDescs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filterDescs.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-600 text-white rounded-full">
                      {d}
                      <button type="button" onClick={() => setFilterDescs((p) => p.filter((x) => x !== d))} className="hover:text-blue-200">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {allDescriptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {allDescriptions
                    .filter((d) => !filterDescs.includes(d) && (!filterDescInput || d.toLowerCase().includes(filterDescInput.toLowerCase())))
                    .slice(0, 10)
                    .map((desc) => (
                      <button
                        key={desc}
                        type="button"
                        onClick={() => { if (!filterDescs.includes(desc)) setFilterDescs((p) => [...p, desc]); }}
                        className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                      >
                        {desc}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Filtered total: <span className="font-semibold text-gray-900">{symbol}{filteredTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </p>
                <button onClick={() => { setDateFrom(""); setDateTo(""); setFilterDescs([]); setFilterDescInput(""); }} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {hasActiveFilters ? "No entries match your filters" : "No entries yet. Add your first one above."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-lg font-medium text-gray-900">
                      {symbol}{entry.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>

                    {editingEntryId === entry.id ? (
                      <div className="mt-2 space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={editingInput}
                            onChange={(e) => setEditingInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); addEditingDesc(editingInput); }
                              if (e.key === "Escape") setEditingEntryId(null);
                            }}
                            placeholder="Add tag (Enter)"
                            autoFocus
                            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {editingDescs.map((d) => (
                            <span key={d} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                              {d}
                              <button type="button" onClick={() => removeEditingDesc(d)} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEditing(entry.id)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
                          <button onClick={() => setEditingEntryId(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(entry.descriptions || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.descriptions.map((d) => (
                              <span key={d} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{d}</span>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      {entry.source_date && (
                        <span className="text-xs text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">{entry.source_date}</span>
                      )}
                      <p className="text-xs text-gray-400">{formatDate(entry.created_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    {editingEntryId !== entry.id && (
                      <button onClick={() => startEditing(entry)} className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" aria-label="Edit descriptions">
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteEntry(entry.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label="Delete entry">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
