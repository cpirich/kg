import type { ClaimType } from "./domain";

export interface ExtractedClaim {
  text: string;
  type: ClaimType;
  confidence: number;
  topics: string[]; // raw topic labels before normalization
}

export interface ClaimExtractionResult {
  claims: ExtractedClaim[];
  error?: string;
}

export interface ContradictionCheckResult {
  isContradiction: boolean;
  description: string;
  severity: "low" | "medium" | "high";
  confidence: number;
}

export interface GapAnalysisResult {
  gaps: Array<{
    description: string;
    topicLabels: string[];
    gapType: "methodological" | "temporal" | "structural" | "density";
    significance: number;
  }>;
}

export interface GeneratedQuestion {
  question: string;
  rationale: string;
  impact: number;
  feasibility: number;
}
