"use client";

import { useState, useRef } from "react";
import { Camera, Loader2, X, Check } from "lucide-react";
import { createWorker } from "tesseract.js";

interface PhotoScannerProps {
  symbol: string;
  onEntriesScanned: (entries: { amount: number; description: string }[]) => void;
}

export default function PhotoScanner({ symbol, onEntriesScanned }: PhotoScannerProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText] = useState("");
  const [parsedEntries, setParsedEntries] = useState<{ amount: number; description: string; selected: boolean }[]>([]);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    setRawText("");
    setParsedEntries([]);
    setStep("upload");
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
    setRawText(data.text);
    await worker.terminate();

    const lines = data.text.split("\n").filter((l) => l.trim());
    const entries: { amount: number; description: string; selected: boolean }[] = [];

    for (const line of lines) {
      const cleaned = line.replace(/[^0-9.,\-\w\s]/g, " ").trim();
      const numMatch = cleaned.match(/(\d+[\.,]?\d*)/);
      if (numMatch) {
        const amount = parseFloat(numMatch[1].replace(",", "."));
        if (!isNaN(amount) && amount > 0) {
          const descPart = cleaned.replace(numMatch[0], "").replace(/\s+/g, " ").trim();
          entries.push({ amount, description: descPart, selected: true });
        }
      }
    }

    setParsedEntries(entries);
    setStep("review");
    setScanning(false);
  };

  const toggleEntry = (index: number) => {
    setParsedEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e))
    );
  };

  const updateEntry = (index: number, field: "amount" | "description", value: string) => {
    setParsedEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        if (field === "amount") return { ...e, amount: parseFloat(value) || 0 };
        return { ...e, description: value };
      })
    );
  };

  const handleConfirm = () => {
    const selected = parsedEntries
      .filter((e) => e.selected && e.amount > 0)
      .map(({ amount, description }) => ({ amount, description }));
    onEntriesScanned(selected);
    setOpen(false);
    setPreview(null);
    setRawText("");
    setParsedEntries([]);
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Scan Handwritten Page</h2>
              <button
                onClick={() => { setOpen(false); setPreview(null); setStep("upload"); }}
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

              {step === "review" && (
                <div className="space-y-4">
                  {parsedEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-sm mb-3">No amounts found in the image.</p>
                      <p className="text-xs text-gray-400 mb-4">Raw extracted text:</p>
                      <textarea
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        rows={6}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 resize-none font-mono"
                      />
                      <button
                        onClick={() => { setStep("upload"); setPreview(null); setRawText(""); }}
                        className="mt-4 px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">
                        Found {parsedEntries.length} entries. Uncheck ones you don&apos;t want, or edit them.
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {parsedEntries.map((entry, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                              entry.selected ? "border-blue-200 bg-blue-50/50" : "border-gray-100 bg-gray-50 opacity-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={entry.selected}
                              onChange={() => toggleEntry(i)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                              {symbol}
                            </span>
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
                              className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => { setStep("upload"); setParsedEntries([]); }}
                          className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleConfirm}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Add {parsedEntries.filter((e) => e.selected).length} Entries
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
