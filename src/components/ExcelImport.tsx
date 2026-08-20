"use client";

import { useState, useRef } from "react";
import { FileSpreadsheet, X, Check, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ExcelImportProps {
  symbol: string;
  onEntriesImported: (entries: { amount: number; description: string; source_date: string }[]) => void;
}

interface ParsedEntry {
  amount: number;
  description: string;
  source_date: string;
  selected: boolean;
}

export default function ExcelImport({ symbol, onEntriesImported }: ExcelImportProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "map" | "review">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [colMap, setColMap] = useState<{ date: number; desc: number; price: number }>({ date: -1, desc: -1, price: -1 });
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    if (json.length < 2) {
      setLoading(false);
      return;
    }

    const hdrs = json[0].map((h) => String(h || "").trim());
    const dataRows = json.slice(1).map((r) => r.map((c) => String(c || "").trim()));

    setHeaders(hdrs);
    setRows(dataRows);
    setColMap({ date: -1, desc: -1, price: -1 });
    setStep("map");
    setLoading(false);
  };

  const guessColumns = () => {
    const dateIdx = headers.findIndex((h) => /date|day|time/i.test(h));
    const descIdx = headers.findIndex((h) => /desc|note|item|name|particular/i.test(h));
    const priceIdx = headers.findIndex((h) => /price|amount|cost|pay|total|sum|rs|rupee|\$/i.test(h));
    setColMap({ date: dateIdx, desc: descIdx, price: priceIdx });
  };

  const handleMapConfirm = () => {
    if (colMap.price === -1) {
      alert("Please select a Price/Amount column.");
      return;
    }

    const parsed = rows
      .map((row) => {
        const priceText = row[colMap.price]?.replace(/[^0-9.,]/g, "").replace(",", ".");
        const amount = parseFloat(priceText);
        if (isNaN(amount) || amount <= 0) return null;

        const description = colMap.desc !== -1 ? row[colMap.desc] || "" : "";
        const source_date = colMap.date !== -1 ? row[colMap.date] || "" : "";

        return { amount, description, source_date, selected: true };
      })
      .filter(Boolean) as ParsedEntry[];

    setEntries(parsed);
    setStep("review");
  };

  const toggleEntry = (index: number) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e)));
  };

  const updateEntry = (index: number, field: "amount" | "description" | "source_date", value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        if (field === "amount") return { ...e, amount: parseFloat(value) || 0 };
        return { ...e, [field]: value };
      })
    );
  };

  const handleConfirm = () => {
    const selected = entries
      .filter((e) => e.selected && e.amount > 0)
      .map(({ amount, description, source_date }) => ({ amount, description, source_date }));
    onEntriesImported(selected);
    reset();
  };

  const reset = () => {
    setOpen(false);
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setColMap({ date: -1, desc: -1, price: -1 });
    setEntries([]);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <FileSpreadsheet className="w-4 h-4" />
        Import
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-gray-900">Import from Excel / CSV</h2>
              <button onClick={reset} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5">
              {step === "upload" && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={loading}
                    className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-16 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors flex flex-col items-center gap-3"
                  >
                    {loading ? (
                      <Loader2 className="w-10 h-10 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-10 h-10" />
                    )}
                    <span className="text-sm">
                      {loading ? "Reading file..." : "Upload Excel or CSV file"}
                    </span>
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-3">
                    Paste your notes into Gemini, export as Excel/CSV, then upload here.
                  </p>
                </>
              )}

              {step === "map" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {rows.length} rows found. Map your columns below.
                    </p>
                    <button
                      onClick={guessColumns}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Auto-detect
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(["date", "desc", "price"] as const).map((field) => (
                      <div key={field} className="flex items-center gap-3">
                        <span className={`text-xs font-medium w-20 py-1.5 px-2 rounded-lg text-center ${
                          field === "date" ? "bg-purple-50 text-purple-700" :
                          field === "desc" ? "bg-blue-50 text-blue-700" :
                          "bg-green-50 text-green-700"
                        }`}>
                          {field === "desc" ? "Description" : field === "price" ? "Price *" : "Date"}
                        </span>
                        <select
                          value={colMap[field]}
                          onChange={(e) => setColMap((prev) => ({ ...prev, [field]: parseInt(e.target.value) }))}
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={-1}>-- Not mapped --</option>
                          {headers.map((h, i) => (
                            <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                      <thead>
                        <tr className="bg-gray-50">
                          {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 border-b border-gray-200 font-medium text-gray-600">
                              {h || `Col ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-100 last:border-0">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 text-gray-500 whitespace-nowrap">
                                {cell || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 5 && <p className="text-xs text-gray-400 text-center">Showing 5 of {rows.length} rows</p>}

                  <div className="flex gap-3 pt-2">
                    <button onClick={reset} className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">
                      Cancel
                    </button>
                    <button onClick={handleMapConfirm} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm">
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {step === "review" && (
                <div className="space-y-4">
                  {entries.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-sm">No valid entries found. Check your column mapping.</p>
                      <button onClick={() => setStep("map")} className="mt-4 px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">
                        Back
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">Found {entries.length} entries. Review and edit before importing.</p>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {entries.map((entry, i) => (
                          <div key={i} className={`p-3 rounded-xl border transition-colors ${entry.selected ? "border-blue-200 bg-blue-50/50" : "border-gray-100 bg-gray-50 opacity-50"}`}>
                            <div className="flex items-center gap-3">
                              <input type="checkbox" checked={entry.selected} onChange={() => toggleEntry(i)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">{symbol}</span>
                              <input type="number" value={entry.amount || ""} onChange={(e) => updateEntry(i, "amount", e.target.value)} className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white" step="0.01" />
                              <input type="text" value={entry.description} onChange={(e) => updateEntry(i, "description", e.target.value)} placeholder="Note" className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white min-w-0" />
                            </div>
                            {entry.source_date && (
                              <input type="text" value={entry.source_date} onChange={(e) => updateEntry(i, "source_date", e.target.value)} placeholder="Date" className="mt-2 ml-7 w-[calc(100%-1.75rem)] px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-500" />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setStep("map")} className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">Back</button>
                        <button onClick={handleConfirm} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" />
                          Add {entries.filter((e) => e.selected).length} Entries
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
