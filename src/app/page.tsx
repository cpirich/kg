"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, FileText, Lightbulb, Search } from "lucide-react";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { db } from "@/lib/db/schema";

export default function DashboardPage() {
  const documentCount = useLiveQuery(() => db.documents.count(), []);
  const claimCount = useLiveQuery(() => db.claims.count(), []);
  const contradictionCount = useLiveQuery(() => db.contradictions.count(), []);
  const gapCount = useLiveQuery(() => db.knowledgeGaps.count(), []);

  const topics = useLiveQuery(
    () => db.topics.orderBy("claimCount").reverse().limit(10).toArray(),
    [],
  );

  const recentDocuments = useLiveQuery(
    () => db.documents.orderBy("createdAt").reverse().limit(5).toArray(),
    [],
  );

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
          value={documentCount ?? 0}
          description="Papers uploaded"
          icon={FileText}
        />
        <StatCard
          title="Claims"
          value={claimCount ?? 0}
          description="Extracted from papers"
          icon={Lightbulb}
        />
        <StatCard
          title="Contradictions"
          value={contradictionCount ?? 0}
          description="Detected conflicts"
          icon={AlertTriangle}
        />
        <StatCard
          title="Knowledge Gaps"
          value={gapCount ?? 0}
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
            {recentDocuments && recentDocuments.length > 0 ? (
              <ul className="space-y-2">
                {recentDocuments.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">
                        {doc.name}
                      </span>
                    </div>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <p className="text-sm">
                  No documents uploaded yet. Go to Upload Papers to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Topic Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {topics && topics.length > 0 ? (
              <ChartContainer
                config={
                  {
                    claimCount: {
                      label: "Claims",
                      color: "hsl(var(--chart-1))",
                    },
                  } satisfies ChartConfig
                }
                className="h-[200px] w-full"
              >
                <BarChart
                  data={topics}
                  layout="vertical"
                  margin={{ left: 0, right: 16 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="claimCount"
                    fill="var(--color-claimCount)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <p className="text-sm">
                  Topic chart will appear after uploading papers.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
