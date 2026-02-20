import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock useLiveQuery to return controlled values
const mockUseLiveQuery = vi.fn();
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (...args: unknown[]) => mockUseLiveQuery(...args),
}));

// Mock recharts since it needs DOM measurements unavailable in jsdom
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
}));

// Mock the chart component from shadcn
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div data-testid="chart-container">{children}</div>,
  ChartTooltip: () => <div />,
  ChartTooltipContent: () => <div />,
}));

// Mock db — the component imports it for useLiveQuery callbacks, but the
// callbacks themselves are bypassed by the mockUseLiveQuery implementation.
vi.mock("@/lib/db/schema", () => ({
  db: {
    documents: { count: vi.fn(), orderBy: vi.fn() },
    claims: { count: vi.fn() },
    contradictions: { count: vi.fn() },
    knowledgeGaps: { count: vi.fn() },
    topics: { orderBy: vi.fn() },
  },
}));

// eslint-disable-next-line -- must be imported after mocks
import DashboardPage from "../page";

/**
 * Helper: configure mockUseLiveQuery to return values in call order.
 *
 * The dashboard component calls useLiveQuery 6 times:
 *   0 – documentCount
 *   1 – claimCount
 *   2 – contradictionCount
 *   3 – gapCount
 *   4 – topics
 *   5 – recentDocuments
 */
function setQueryReturns(values: {
  documentCount?: number;
  claimCount?: number;
  contradictionCount?: number;
  gapCount?: number;
  topics?: { id: string; name: string; claimCount: number }[];
  recentDocuments?: { id: string; name: string; createdAt: string }[];
}) {
  let callIndex = 0;
  const ordered = [
    values.documentCount ?? undefined,
    values.claimCount ?? undefined,
    values.contradictionCount ?? undefined,
    values.gapCount ?? undefined,
    values.topics ?? undefined,
    values.recentDocuments ?? undefined,
  ];
  mockUseLiveQuery.mockImplementation(() => {
    const val = ordered[callIndex];
    callIndex++;
    return val;
  });
}

beforeEach(() => {
  mockUseLiveQuery.mockReset();
});

describe("DashboardPage", () => {
  it("renders topic placeholder when no topics exist", () => {
    setQueryReturns({ topics: [], recentDocuments: [] });
    render(<DashboardPage />);
    expect(
      screen.getByText("Topic chart will appear after uploading papers."),
    ).toBeInTheDocument();
  });

  it("renders topic chart when topics exist", () => {
    setQueryReturns({
      topics: [
        { id: "t1", name: "Machine Learning", claimCount: 5 },
        { id: "t2", name: "Neural Networks", claimCount: 3 },
      ],
      recentDocuments: [],
    });
    render(<DashboardPage />);

    expect(screen.getByText("Topic Distribution")).toBeInTheDocument();
    expect(screen.getByTestId("chart-container")).toBeInTheDocument();
    expect(
      screen.queryByText("Topic chart will appear after uploading papers."),
    ).not.toBeInTheDocument();
  });

  it("shows correct stat card values", () => {
    setQueryReturns({
      documentCount: 7,
      claimCount: 42,
      contradictionCount: 3,
      gapCount: 5,
      topics: [],
      recentDocuments: [],
    });
    render(<DashboardPage />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows recent documents list when documents exist", () => {
    setQueryReturns({
      topics: [],
      recentDocuments: [
        {
          id: "d1",
          name: "Paper Alpha.pdf",
          createdAt: "2025-01-15T00:00:00Z",
        },
        { id: "d2", name: "Paper Beta.pdf", createdAt: "2025-01-16T00:00:00Z" },
      ],
    });
    render(<DashboardPage />);

    expect(screen.getByText("Paper Alpha.pdf")).toBeInTheDocument();
    expect(screen.getByText("Paper Beta.pdf")).toBeInTheDocument();
    expect(
      screen.queryByText(/No documents uploaded yet/),
    ).not.toBeInTheDocument();
  });

  it("shows empty state when no documents exist", () => {
    setQueryReturns({ topics: [], recentDocuments: [] });
    render(<DashboardPage />);

    expect(
      screen.getByText(
        "No documents uploaded yet. Go to Upload Papers to get started.",
      ),
    ).toBeInTheDocument();
  });
});
