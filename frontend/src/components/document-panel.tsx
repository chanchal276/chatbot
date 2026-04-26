import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { FileText, Search, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";

export function DocumentPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { documents, uploadDocument, uploadProgress, isLoadingDocuments } = useChatStore();
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((document) => document.filename.toLowerCase().includes(query));
  }, [documents, search]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!["application/pdf", "text/plain"].includes(file.type) && !/\.(pdf|txt)$/i.test(file.name)) {
      toast.error("Only PDF and TXT files are supported.");
      return;
    }
    try {
      await uploadDocument(file);
      toast.success(`${file.name} uploaded successfully.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  return (
    <section className="rounded-[1.75rem] border bg-card/90 p-5 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Document Library</h2>
          <p className="text-sm text-muted-foreground">Upload source files for your research assistant.</p>
        </div>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          <UploadCloud className="h-4 w-4" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      <div
        className={`mt-4 rounded-3xl border border-dashed p-6 text-center transition ${
          dragging ? "border-primary bg-secondary/60" : "border-border bg-background/70"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragging(false);
          await handleFile(event.dataTransfer.files?.[0]);
        }}
      >
        <p className="font-medium">Drag and drop files here</p>
        <p className="mt-1 text-sm text-muted-foreground">PDF and TXT only. Files are chunked and indexed in Neo4j.</p>
        {uploadProgress > 0 ? (
          <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        ) : null}
      </div>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" className="pl-9" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        {isLoadingDocuments
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border p-4">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="mt-2 h-3 w-2/3 rounded bg-muted" />
              </div>
            ))
          : filtered.map((document) => (
              <div key={document.filename} className="rounded-2xl border bg-background/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-secondary p-3 text-secondary-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{document.filename}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{document.chunks ?? 0} chunks</span>
                      <span>{formatBytes(document.file_size)}</span>
                      {document.uploaded_at ? <span>{format(new Date(document.uploaded_at), "PP p")}</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}
