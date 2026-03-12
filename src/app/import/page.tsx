"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, CheckCircle2, AlertCircle, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importFile, type ImportResult } from "@/lib/importer";
import { cn } from "@/lib/utils";

type ImportState =
  | { status: "idle" }
  | { status: "importing" }
  | { status: "success"; result: ImportResult }
  | { status: "error"; message: string };

export default function ImportPage() {
  const [state, setState] = useState<ImportState>({ status: "idle" });
  const [deckName, setDeckName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file);
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
    setDeckName(nameWithoutExt);
    setState({ status: "idle" });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleImport = async () => {
    if (!selectedFile || !deckName.trim()) return;

    setState({ status: "importing" });
    try {
      const result = await importFile(selectedFile, deckName.trim());
      setState({ status: "success", result });
      setSelectedFile(null);
      setDeckName("");
    } catch (err) {
      setState({
        status: "error",
        message:
          err instanceof Error ? err.message : "インポートに失敗しました",
      });
    }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-6 text-2xl font-bold">インポート</h1>

      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <FileUp className="size-8 text-primary" />
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <>
            <Upload className="mb-3 size-8 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium">
              ファイルをドラッグ＆ドロップ
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              .txt / .tsv / .csv / .apkg に対応
            </p>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          ファイルを選択
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.tsv,.csv,.apkg"
          className="hidden"
          onClick={(e) => {
            (e.target as HTMLInputElement).value = "";
          }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {selectedFile && (
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="deck-name"
              className="mb-1 block text-sm font-medium"
            >
              デッキ名
            </label>
            <input
              id="deck-name"
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="デッキ名を入力"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleImport}
            disabled={!deckName.trim() || state.status === "importing"}
          >
            {state.status === "importing" ? "インポート中..." : "インポート"}
          </Button>
        </div>
      )}

      {state.status === "success" && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-success-border bg-success-muted p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="font-medium text-success-muted-foreground">
              インポート完了
            </p>
            <p className="text-sm text-success-muted-foreground/80">
              「{state.result.deckName}」に {state.result.importedCount}{" "}
              枚のカードを追加しました
            </p>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-error-border bg-error-muted p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-error" />
          <div>
            <p className="font-medium text-error-muted-foreground">エラー</p>
            <p className="text-sm text-error-muted-foreground/80">
              {state.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
