"use client";

import { DocumentList } from "@/components/ingest/document-list";
import { FileDropzone } from "@/components/ingest/file-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDocuments } from "@/hooks/use-documents";
import { useIngestionPipeline } from "@/hooks/use-ingestion-pipeline";

export default function IngestPage() {
  const { ingest, isProcessing, progress } = useIngestionPipeline();
  const { documents } = useDocuments();

  // Merge in-progress items with completed documents from DB
  const progressDocs = progress.map((p) => ({
    id: p.documentId ?? p.fileName,
    name: p.fileName,
    status: p.error ? "error" : p.status,
    progress: p.progress,
    createdAt: Date.now(),
  }));

  const completedDocs = documents.map((doc) => ({
    id: doc.id,
    name: doc.name,
    status: "complete" as const,
    progress: 100,
    createdAt: doc.createdAt,
  }));

  // Show in-progress items first, then completed documents (avoid duplicates)
  const inProgressIds = new Set(
    progress.map((p) => p.documentId).filter(Boolean),
  );
  const allDocs = [
    ...progressDocs,
    ...completedDocs.filter((doc) => !inProgressIds.has(doc.id)),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Upload Papers</h2>
        <p className="text-muted-foreground">
          Upload PDFs or text files to extract claims and build the knowledge
          graph.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <FileDropzone onFilesAccepted={ingest} disabled={isProcessing} />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentList documents={allDocs} />
        </CardContent>
      </Card>
    </div>
  );
}
