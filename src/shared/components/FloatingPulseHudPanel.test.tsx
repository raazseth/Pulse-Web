import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

vi.mock("./HudSuggestionsTab", () => ({
  HudSuggestionsTab: () => React.createElement("div", { "data-testid": "suggestions-tab" }),
}));
vi.mock("./HudComposerBar", () => ({
  HudComposerBar: () => React.createElement("div", { "data-testid": "composer-bar" }),
}));
vi.mock("./HudNotesTab", () => ({
  HudNotesTab: () => React.createElement("div", { "data-testid": "notes-tab" }),
}));
vi.mock("./floatingHudDigitShortcutOwnership", () => ({
  claimFloatingHudTagDigitShortcuts: vi.fn(),
  releaseFloatingHudTagDigitShortcuts: vi.fn(),
}));

import { FloatingPulseHudPanel } from "./FloatingPulseHudPanel";
import type { FloatingPulseHudPanelProps } from "./FloatingPulseHudPanel";

const theme = createTheme();

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ThemeProvider, { theme }, children);
}

function baseProps(overrides: Partial<FloatingPulseHudPanelProps> = {}): FloatingPulseHudPanelProps {
  return {
    visible: true,
    layout: "embed",
    helpText: "",
    transcriptPreview: [],
    composerLine: "",
    onComposerLineChange: vi.fn(),
    prompts: [],
    acceptedMessages: [],
    dismissedPromptIds: new Set(),
    onHudPromptAccept: vi.fn(),
    onHudPromptDismissId: vi.fn(),
    quickTags: [],
    ...overrides,
  };
}

describe("FloatingPulseHudPanel — rendering", () => {
  it("renders without crashing (visible=true, embed layout)", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps()),
      { wrapper: Wrapper },
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("sets aria-hidden=false when visible", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({ visible: true })),
      { wrapper: Wrapper },
    );
    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    expect(region!.getAttribute("aria-hidden")).toBe("false");
  });

  it("sets aria-hidden=true when visible=false", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({ visible: false })),
      { wrapper: Wrapper },
    );
    const region = container.querySelector('[role="region"]');
    expect(region!.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders in pip layout without crashing", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({ layout: "pip" })),
      { wrapper: Wrapper },
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders HudSuggestionsTab by default (suggestions tab active)", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps()),
      { wrapper: Wrapper },
    );
    expect(container.querySelector('[data-testid="suggestions-tab"]')).toBeTruthy();
  });

  it("renders composer bar", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps()),
      { wrapper: Wrapper },
    );
    expect(container.querySelector('[data-testid="composer-bar"]')).toBeTruthy();
  });
});

describe("FloatingPulseHudPanel — session heading", () => {
  it("shows sessionTitle in the header when provided", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({ sessionTitle: "My Interview", sessionId: "s1" })),
      { wrapper: Wrapper },
    );
    expect(container.textContent).toContain("My Interview");
  });

  it("falls back to sessionId when title is absent", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({ sessionId: "abc-123" })),
      { wrapper: Wrapper },
    );
    expect(container.textContent).toContain("abc-123");
  });
});

describe("FloatingPulseHudPanel — badge counts", () => {
  it("shows prompt count badge when there are undismissed prompts", () => {
    const prompts = [
      { id: "p1", sessionId: "s1", title: "Q1", text: "text", timestamp: "t", transcriptIds: [] },
      { id: "p2", sessionId: "s1", title: "Q2", text: "text", timestamp: "t", transcriptIds: [] },
    ];
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({ prompts } as any)),
      { wrapper: Wrapper },
    );
    expect(container.textContent).toContain("2");
  });

  it("shows notes count badge when notes are present", () => {
    const notes = [
      { id: "n1", label: "Note 1", body: "body", linkedTagIds: [] },
      { id: "n2", label: "Note 2", body: "body", linkedTagIds: [] },
    ];
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({ notes })),
      { wrapper: Wrapper },
    );
    expect(container.textContent).toContain("2");
  });
});

describe("FloatingPulseHudPanel — PiP launch button", () => {
  it("renders the pip launch button when showPipLaunch + pipSupported + onRequestDocumentPip are all truthy", () => {
    const onRequestDocumentPip = vi.fn();
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({
        showPipLaunch: true,
        pipSupported: true,
        onRequestDocumentPip,
      })),
      { wrapper: Wrapper },
    );
    const btn = container.querySelector('[aria-label="Open always-on-top window"]');
    expect(btn).toBeTruthy();
  });

  it("does not render pip button when pipSupported is false", () => {
    const { container } = render(
      React.createElement(FloatingPulseHudPanel, baseProps({
        showPipLaunch: true,
        pipSupported: false,
        onRequestDocumentPip: vi.fn(),
      })),
      { wrapper: Wrapper },
    );
    expect(container.querySelector('[aria-label="Open always-on-top window"]')).toBeNull();
  });
});
