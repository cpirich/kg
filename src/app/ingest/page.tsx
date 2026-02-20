"use client";

import { DocumentList } from "@/components/ingest/document-list";
import { FileDropzone } from "@/components/ingest/file-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function IngestPage() {
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
          <FileDropzone />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentList documents={[]} />
        </CardContent>
      </Card>
    </div>
  );
}
