import { AlertTriangle, FileText, Lightbulb, Search } from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your knowledge graph analysis.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Documents"
          value={0}
          description="Papers uploaded"
          icon={FileText}
        />
        <StatCard
          title="Claims"
          value={0}
          description="Extracted from papers"
          icon={Lightbulb}
        />
        <StatCard
          title="Contradictions"
          value={0}
          description="Detected conflicts"
          icon={AlertTriangle}
        />
        <StatCard
          title="Knowledge Gaps"
          value={0}
          description="Areas to explore"
          icon={Search}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <p className="text-sm">
                No documents uploaded yet. Go to Upload Papers to get started.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Topic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <p className="text-sm">
                Topic chart will appear after uploading papers.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
