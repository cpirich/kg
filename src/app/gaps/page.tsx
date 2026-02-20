"use client";

import { GapList } from "@/components/gaps/gap-list";
import { QuestionList } from "@/components/gaps/question-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function GapsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Knowledge Gaps</h2>
        <p className="text-muted-foreground">
          Under-explored areas and generated research questions.
        </p>
      </div>

      <Tabs defaultValue="gaps">
        <TabsList>
          <TabsTrigger value="gaps">Knowledge Gaps</TabsTrigger>
          <TabsTrigger value="questions">Research Questions</TabsTrigger>
        </TabsList>
        <TabsContent value="gaps" className="mt-4">
          <GapList gaps={[]} />
        </TabsContent>
        <TabsContent value="questions" className="mt-4">
          <QuestionList questions={[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
