import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Document {
  id: string;
  name: string;
  status: string;
  progress: number;
  createdAt: number;
}

interface DocumentListProps {
  documents: Document[];
}

const statusConfig: Record<string, { label: string; className: string }> = {
  uploading: {
    label: "Uploading",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  },
  extracting: {
    label: "Extracting",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  },
  analyzing: {
    label: "Analyzing",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  },
  complete: {
    label: "Complete",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  },
  error: {
    label: "Error",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  },
};

export function DocumentList({ documents }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        <p className="text-sm">No documents uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const config = statusConfig[doc.status] ?? {
          label: doc.status,
          className: "bg-muted text-muted-foreground",
        };
        const isInProgress =
          doc.status !== "complete" && doc.status !== "error";

        return (
          <div
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
          >
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <Badge variant="outline" className={config.className}>
                  {config.label}
                </Badge>
              </div>
              {isInProgress && (
                <div className="mt-2">
                  <Progress value={doc.progress} className="h-1.5" />
                </div>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(doc.createdAt).toLocaleDateString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
