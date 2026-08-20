"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, X, Check, ArrowRight } from "lucide-react";
import { createWorker } from "tesseract.js";

interface PhotoScannerProps {
  symbol: string;
  onEntriesScanned: (entries: { amount: number; description: string; date?: string }[]) => void;
}

type ColumnType = "date" | "description" | "price" | "skip";

export default function PhotoScanner({ symbol, onEntriesScanned }: PhotoScannerProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<"upload" | "map" | "review">("upload");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnTypes, setColumnTypes] = useState<ColumnType[]>([]);
  const [entries, setEntries] = useState<{ amount: number; description: string; date: string; selected: boolean }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const splitRow = (line: string): string[] => {
    const trimmed = line.trim();
    if (!trimmed) return [];
    if (trimmed.includes("\t")) return trimmed.split("\t").map((c) => c.trim());
    return trimmed.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  };

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStep("upload");
    setRawRows([]);
    setColumnTypes([]);
    setEntries([]);
  };

  const handleScan = async () => {
    if (!preview) return;
    setScanning(true);
    setProgress(0);

    const worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          setProgress(Math.round(m.progress * 100));
        }
      },
    });

    const { data } = await worker.recognize(preview);
    await worker.terminate();

    const lines = data.text.split("\n").filter((l) => l.trim());
    const rows = lines.map(splitRow).filter((r) => r.length > 1);

    if (rows.length === 0) {
      const allLines = data.text.split("\n").filter((l) => l.trim());
      const singleColRows = allLines.map((l) => [l.trim()]).filter((r) => r.length > 0);
      setRawRows(singleColRows);
      setColumnTypes(["description"]);
    } else {
      const maxCols = Math.max(...rows.map((r) => r.length));
      const padded = rows.map((r) => {
        while (r.length < maxCols) r.push("");
        return r;
      });
      setRawRows(padded);
      setColumnTypes(Array(maxCols).fill("skip"));
    }

    setStep("map");
    setScanning(false);
  };

  const setColumnType = (index: number, type: ColumnType) => {
    setColumnTypes((prev) => prev.map((t, i) => (i === index ? type : t)));
  };

  const handleMapConfirm = () => {
    const priceCol = columnTypes.indexOf("price");
    if (priceCol === -1) {
      alert("Please mark at least one column as Price.");
      return;
    }

    const dateCol = columnTypes.indexOf("date");
    const descCols = columnTypes
      .map((t, i) => (t === "description" ? i : -1))
      .filter((i) => i !== -1);

    const parsed = rawRows
      .map((row) => {
        const priceText = row[priceCol]?.replace(/[^0-9.,]/g, "").replace(",", ".");
        const amount = parseFloat(priceText);
        if (isNaN(amount) || amount <= 0) return null;

        const date = dateCol !== -1 ? row[dateCol] || "" : "";
        const description = descCols.length > 0
          ? descCols.map((ci) => row[ci]).filter(Boolean).join(" ")
          : "";

        return { amount, description, date, selected: true };
      })
      .filter(Boolean) as { amount: number; description: string; date: string; selected: boolean }[];

    setEntries(parsed);
    setStep("review");
  };

  const toggleEntry = (index: number) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e)));
  };

  const updateEntry = (index: number, field: "amount" | "description" | "date", value: string) => {
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
      .map(({ amount, description, date }) => ({ amount, description, date }));
    onEntriesScanned(selected);
    setOpen(false);
    reset();
  };

  const reset = () => {
    setPreview(null);
    setRawRows([]);
    setColumnTypes([]);
    setEntries([]);
    setStep("upload");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Camera className="w-4 h-4" />
        Scan
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-semibold text-gray-900">Scan Handwritten Page</h2>
              <button
                onClick={() => { setOpen(false); reset(); }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5">
              {step === "upload" && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    className="hidden"
                  />

                  {preview ? (
                    <div className="space-y-4">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full rounded-xl border border-gray-200 max-h-64 object-contain"
                      />
                      {scanning ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Scanning... {progress}%
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => { setPreview(null); fileRef.current?.click(); }}
                            className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                          >
                            Retake
                          </button>
                          <button
                            onClick={handleScan}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm"
                          >
                            Scan Text
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-16 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors flex flex-col items-center gap-3"
                    >
                      <Camera className="w-10 h-10" />
                      <span className="text-sm">Take a photo or choose an image</span>
                    </button>
                  )}
                </>
              )}

              {step === "map" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Detected {rawRows.length} rows. Tap each column to label what it is.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
                      <thead>
                        <tr className="bg-gray-50">
                          {columnTypes.map((type, i) => (
                            <th key={i} className="px-3 py-2 border-b border-gray-200">
                              <select
                                value={type}
                                onChange={(e) => setColumnType(i, e.target.value as ColumnType)}
                                className={`w-full text-xs font-medium px-2 py-1.5 rounded-lg border text-center cursor-pointer transition-colors ${
                                  type === "date"
                                    ? "bg-purple-50 border-purple-200 text-purple-700"
                                    : type === "description"
                                    ? "bg-blue-50 border-blue-200 text-blue-700"
                                    : type === "price"
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : "bg-gray-50 border-gray-200 text-gray-400"
                                }`}
                              >
                                <option value="skip">Skip</option>
                                <option value="date">Date</option>
                                <option value="description">Description</option>
                                <option value="price">Price</option>
                              </select>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rawRows.slice(0, 10).map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-100 last:border-0">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">
                                {cell || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {rawRows.length > 10 && (
                    <p className="text-xs text-gray-400 text-center">
                      Showing 10 of {rawRows.length} rows
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => { setStep("upload"); setPreview(null); setRawRows([]); }}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleMapConfirm}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === "review" && (
                <div className="space-y-4">
                  {entries.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-sm">No valid entries found. Try again with a clearer photo.</p>
                      <button
                        onClick={() => { setStep("upload"); reset(); }}
                        className="mt-4 px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">
                        Found {entries.length} entries. Uncheck or edit before adding.
                      </p>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {entries.map((entry, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-xl border transition-colors ${
                              entry.selected ? "border-blue-200 bg-blue-50/50" : "border-gray-100 bg-gray-50 opacity-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={entry.selected}
                                onChange={() => toggleEntry(i)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm font-medium text-gray-500 whitespace-nowrap">{symbol}</span>
                              <input
                                type="number"
                                value={entry.amount || ""}
                                onChange={(e) => updateEntry(i, "amount", e.target.value)}
                                className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white"
                                step="0.01"
                              />
                              <input
                                type="text"
                                value={entry.description}
                                onChange={(e) => updateEntry(i, "description", e.target.value)}
                                placeholder="Note"
                                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white min-w-0"
                              />
                            </div>
                            {entry.date && (
                              <input
                                type="text"
                                value={entry.date}
                                onChange={(e) => updateEntry(i, "date", e.target.value)}
                                placeholder="Date"
                                className="mt-2 ml-7 w-[calc(100%-1.75rem)] px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-500"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setStep("map")}
                          className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleConfirm}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                        >
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
