import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRunDetection = vi.fn();
const mockUseContradictions = vi.fn();

vi.mock("@/hooks/use-contradictions", () => ({
  useContradictions: () => mockUseContradictions(),
}));

// Dynamic import of ContradictionsPage after mock is set up
const { default: ContradictionsPage } = await import(
  "@/app/contradictions/page"
);

beforeEach(() => {
  mockRunDetection.mockClear();
  mockUseContradictions.mockReturnValue({
    contradictions: [],
    isLoading: false,
    isDetecting: false,
    error: null,
    runContradictionDetection: mockRunDetection,
  });
});

describe("ContradictionsPage", () => {
  it("renders the Run Detection button", () => {
    render(<ContradictionsPage />);
    expect(
      screen.getByRole("button", { name: "Run Detection" }),
    ).toBeInTheDocument();
  });

  it("shows empty state message when no contradictions exist", () => {
    render(<ContradictionsPage />);
    expect(
      screen.getByText(
        "No contradictions detected yet. Upload papers to begin analysis.",
      ),
    ).toBeInTheDocument();
  });

  it("renders contradiction cards when contradictions are returned", () => {
    mockUseContradictions.mockReturnValue({
      contradictions: [
        {
          id: "c1",
          description: "Conflicting claims about transformer efficiency",
          severity: "high",
          confidence: 0.85,
          status: "detected",
          claimAId: "claim1",
          claimBId: "claim2",
          createdAt: Date.now(),
        },
      ],
      isLoading: false,
      isDetecting: false,
      error: null,
      runContradictionDetection: mockRunDetection,
    });

    render(<ContradictionsPage />);
    expect(
      screen.getByText("Conflicting claims about transformer efficiency"),
    ).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("85% confidence")).toBeInTheDocument();
  });

  it("shows Detecting... with spinner when isDetecting is true", () => {
    mockUseContradictions.mockReturnValue({
      contradictions: [],
      isLoading: false,
      isDetecting: true,
      error: null,
      runContradictionDetection: mockRunDetection,
    });

    render(<ContradictionsPage />);
    expect(
      screen.getByRole("button", { name: /Detecting/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Detecting...")).toBeInTheDocument();
  });

  it("disables the button while detecting", () => {
    mockUseContradictions.mockReturnValue({
      contradictions: [],
      isLoading: false,
      isDetecting: true,
      error: null,
      runContradictionDetection: mockRunDetection,
    });

    render(<ContradictionsPage />);
    expect(screen.getByRole("button", { name: /Detecting/i })).toBeDisabled();
  });

  it("shows error message when error is set", () => {
    mockUseContradictions.mockReturnValue({
      contradictions: [],
      isLoading: false,
      isDetecting: false,
      error: "Need at least 2 claims to detect contradictions.",
      runContradictionDetection: mockRunDetection,
    });

    render(<ContradictionsPage />);
    expect(
      screen.getByText("Need at least 2 claims to detect contradictions."),
    ).toBeInTheDocument();
  });

  it("calls runContradictionDetection when Run Detection is clicked", () => {
    render(<ContradictionsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Run Detection" }));
    expect(mockRunDetection).toHaveBeenCalledOnce();
  });
});
