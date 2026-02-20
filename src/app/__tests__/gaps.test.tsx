import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRunAnalysis = vi.fn();
const mockUseGaps = vi.fn();

vi.mock("@/hooks/use-gaps", () => ({
  useGaps: () => mockUseGaps(),
}));

// Dynamic import of GapsPage after mock is set up
const { default: GapsPage } = await import("@/app/gaps/page");

beforeEach(() => {
  mockRunAnalysis.mockClear();
  mockUseGaps.mockReturnValue({
    gaps: [],
    questions: [],
    isLoading: false,
    isAnalyzing: false,
    error: null,
    runGapAnalysis: mockRunAnalysis,
  });
});

describe("GapsPage", () => {
  it("renders the Run Analysis button", () => {
    render(<GapsPage />);
    expect(
      screen.getByRole("button", { name: "Run Analysis" }),
    ).toBeInTheDocument();
  });

  it("shows empty state message when no gaps exist", () => {
    render(<GapsPage />);
    expect(
      screen.getByText(
        "No knowledge gaps identified yet. Upload papers to begin analysis.",
      ),
    ).toBeInTheDocument();
  });

  it("renders gap cards when gaps are returned from the hook", () => {
    mockUseGaps.mockReturnValue({
      gaps: [
        {
          id: "gap1",
          description: "Structural gap between X and Y",
          gapType: "structural",
          significance: 0.8,
          topicIds: ["t1", "t2"],
          createdAt: Date.now(),
        },
      ],
      questions: [],
      isLoading: false,
      isAnalyzing: false,
      error: null,
      runGapAnalysis: mockRunAnalysis,
    });

    render(<GapsPage />);
    expect(
      screen.getByText("Structural gap between X and Y"),
    ).toBeInTheDocument();
    expect(screen.getByText("structural")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("renders question cards in Research Questions tab", async () => {
    mockUseGaps.mockReturnValue({
      gaps: [],
      questions: [
        {
          id: "q1",
          gapId: "gap1",
          question: "How does X relate to Y?",
          rationale: "Because...",
          impact: 8,
          feasibility: 6,
          overallScore: 7.2,
          createdAt: Date.now(),
        },
      ],
      isLoading: false,
      isAnalyzing: false,
      error: null,
      runGapAnalysis: mockRunAnalysis,
    });

    render(<GapsPage />);

    // Switch to Research Questions tab
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Research Questions" }));

    expect(screen.getByText("How does X relate to Y?")).toBeInTheDocument();
    expect(screen.getByText("Because...")).toBeInTheDocument();
  });

  it("shows Analyzing... with spinner when isAnalyzing is true", () => {
    mockUseGaps.mockReturnValue({
      gaps: [],
      questions: [],
      isLoading: false,
      isAnalyzing: true,
      error: null,
      runGapAnalysis: mockRunAnalysis,
    });

    render(<GapsPage />);
    expect(
      screen.getByRole("button", { name: /Analyzing/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Analyzing...")).toBeInTheDocument();
  });

  it("disables the button while analyzing", () => {
    mockUseGaps.mockReturnValue({
      gaps: [],
      questions: [],
      isLoading: false,
      isAnalyzing: true,
      error: null,
      runGapAnalysis: mockRunAnalysis,
    });

    render(<GapsPage />);
    expect(screen.getByRole("button", { name: /Analyzing/i })).toBeDisabled();
  });

  it("shows error message when error is set", () => {
    mockUseGaps.mockReturnValue({
      gaps: [],
      questions: [],
      isLoading: false,
      isAnalyzing: false,
      error: "No topics found. Ingest some documents first.",
      runGapAnalysis: mockRunAnalysis,
    });

    render(<GapsPage />);
    expect(
      screen.getByText("No topics found. Ingest some documents first."),
    ).toBeInTheDocument();
  });

  it("calls runGapAnalysis when Run Analysis is clicked", () => {
    render(<GapsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Run Analysis" }));
    expect(mockRunAnalysis).toHaveBeenCalledOnce();
  });
});
