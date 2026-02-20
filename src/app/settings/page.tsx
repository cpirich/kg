"use client";

import {
  Database,
  Download,
  Eye,
  EyeOff,
  Key,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

export default function SettingsPage() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [chunkSize, setChunkSize] = useState([1500]);
  const [overlap, setOverlap] = useState([200]);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure your Anthropic API key and application preferences.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* API Key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="size-4" />
              API Key
            </CardTitle>
            <CardDescription>
              Your Anthropic API key is stored locally in IndexedDB and never
              sent to any server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1/2 right-2 -translate-y-1/2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
              </div>
              <Button variant="outline">Save</Button>
            </div>
          </CardContent>
        </Card>

        {/* Model Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Model</CardTitle>
            <CardDescription>
              Select the Claude model to use for analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-sonnet-4-20250514">
                  Claude Sonnet 4 (claude-sonnet-4-20250514)
                </SelectItem>
                <SelectItem value="claude-haiku-4-5-20251001">
                  Claude Haiku 4.5 (claude-haiku-4-5-20251001)
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Chunk Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Chunk Configuration</CardTitle>
            <CardDescription>
              Control how documents are split into chunks for analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Chunk Size</Label>
                <span className="text-sm text-muted-foreground">
                  {chunkSize[0]} characters
                </span>
              </div>
              <Slider
                value={chunkSize}
                onValueChange={setChunkSize}
                min={500}
                max={3000}
                step={100}
              />
              <p className="text-xs text-muted-foreground">
                Larger chunks provide more context but increase API costs.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Overlap</Label>
                <span className="text-sm text-muted-foreground">
                  {overlap[0]} characters
                </span>
              </div>
              <Slider
                value={overlap}
                onValueChange={setOverlap}
                min={0}
                max={500}
                step={50}
              />
              <p className="text-xs text-muted-foreground">
                Overlap ensures claims at chunk boundaries are not missed.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4" />
              Data Management
            </CardTitle>
            <CardDescription>
              Export, import, or clear your local data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">
                <Download className="size-4" />
                Export Data
              </Button>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <Upload className="size-4" />
                  Import Data
                  <input
                    type="file"
                    accept=".json"
                    className="sr-only"
                    onChange={() => {
                      // Will be connected to DB later
                    }}
                  />
                </label>
              </Button>
              <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="size-4" />
                    Clear All Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Clear All Data</DialogTitle>
                    <DialogDescription>
                      This will permanently delete all documents, claims,
                      contradictions, and knowledge gaps. This action cannot be
                      undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setClearDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        // Will be connected to DB later
                        setClearDialogOpen(false);
                      }}
                    >
                      Delete Everything
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
