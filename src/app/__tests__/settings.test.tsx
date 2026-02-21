import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Radix UI Slider uses ResizeObserver which is not available in jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockPut = vi.fn().mockResolvedValue(undefined);
const mockEnsureSettings = vi.fn().mockResolvedValue({
  id: "settings",
  apiKey: "sk-test-key",
  model: "claude-sonnet-4-20250514",
  chunkSize: 1500,
  chunkOverlap: 200,
});

vi.mock("@/lib/db/schema", () => ({
  db: {
    appSettings: {
      put: (...args: unknown[]) => mockPut(...args),
    },
  },
  ensureSettings: (...args: unknown[]) => mockEnsureSettings(...args),
}));

vi.mock("@/lib/utils/export", () => ({
  exportAllData: vi.fn().mockResolvedValue("{}"),
  importAllData: vi.fn().mockResolvedValue(undefined),
  clearAllData: vi.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line -- must be imported after mocks
import SettingsPage from "../settings/page";

beforeEach(() => {
  mockPut.mockClear();
  mockEnsureSettings.mockClear();
  mockEnsureSettings.mockResolvedValue({
    id: "settings",
    apiKey: "sk-test-key",
    model: "claude-sonnet-4-20250514",
    chunkSize: 1500,
    chunkOverlap: 200,
  });
});

describe("SettingsPage", () => {
  it("renders the settings form with expected sections", async () => {
    render(<SettingsPage />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("API Key")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Chunk Configuration")).toBeInTheDocument();
    expect(screen.getByText("Data Management")).toBeInTheDocument();
  });

  it("loads persisted API key on mount", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(mockEnsureSettings).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText("sk-ant-...");
    await waitFor(() => {
      expect(input).toHaveValue("sk-test-key");
    });
  });

  it("updates API key state on typing", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("sk-ant-...")).toHaveValue(
        "sk-test-key",
      );
    });

    const input = screen.getByPlaceholderText("sk-ant-...");
    fireEvent.change(input, { target: { value: "sk-ant-new-key" } });

    expect(input).toHaveValue("sk-ant-new-key");
  });

  it("saves settings with current API key when Save is clicked", async () => {
    render(<SettingsPage />);

    // Wait for settings to load
    await waitFor(() => {
      expect(screen.getByPlaceholderText("sk-ant-...")).toHaveValue(
        "sk-test-key",
      );
    });

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "settings",
          apiKey: "sk-test-key",
          model: "claude-sonnet-4-20250514",
          chunkSize: 1500,
          chunkOverlap: 200,
        }),
      );
    });
  });
});
