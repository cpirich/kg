"use client";

import { FileUp, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";

interface FileDropzoneProps {
  onFilesAccepted?: (files: File[]) => void;
}

export function FileDropzone({ onFilesAccepted }: FileDropzoneProps) {
  const [acceptedFiles, setAcceptedFiles] = useState<File[]>([]);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setAcceptedFiles((prev) => [...prev, ...accepted]);
      setRejectionMessage(null);
      if (rejections.length > 0) {
        setRejectionMessage(
          `${rejections.length} file(s) rejected. Only PDF and TXT files are accepted.`,
        );
      }
      if (accepted.length > 0) {
        onFilesAccepted?.(accepted);
      }
    },
    [onFilesAccepted],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="mb-4 rounded-full bg-muted p-3">
          {isDragActive ? (
            <FileUp className="size-6 text-primary" />
          ) : (
            <Upload className="size-6 text-muted-foreground" />
          )}
        </div>
        {isDragActive ? (
          <p className="text-sm font-medium text-primary">Drop files here...</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              Drop files here or click to upload
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports PDF and TXT files
            </p>
          </>
        )}
      </div>

      {rejectionMessage && (
        <p className="text-sm text-destructive">{rejectionMessage}</p>
      )}

      {acceptedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Selected files ({acceptedFiles.length})
          </p>
          <ul className="space-y-1">
            {acceptedFiles.map((file) => (
              <li
                key={`${file.name}-${file.lastModified}`}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <FileUp className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
