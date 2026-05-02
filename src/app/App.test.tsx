import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

vi.mock("@/modules/context/components/ContextPanel", () => ({
  ContextPanel: () => React.createElement("div", { "data-testid": "context-panel" }),
}));
vi.mock("@/modules/prompts/components/PromptSuggestionPanel", () => ({
  PromptSuggestionPanel: () => React.createElement("div", { "data-testid": "prompt-panel" }),
}));
vi.mock("@/modules/tagging/components/TagPanel", () => ({
  TagPanel: () => React.createElement("div", { "data-testid": "tag-panel" }),
}));
vi.mock("@/modules/timeline/components/TimelinePanel", () => ({
  TimelinePanel: () => React.createElement("div", { "data-testid": "timeline-panel" }),
}));
vi.mock("@/modules/transcript/components/TranscriptComposer", () => ({
  TranscriptComposer: () => React.createElement("div", { "data-testid": "transcript-composer" }),
}));
vi.mock("@/modules/transcript/components/TranscriptPanel", () => ({
  TranscriptPanel: () => React.createElement("div", { "data-testid": "transcript-panel" }),
}));
vi.mock("@/shared/components/FloatingPulseHudPanel", () => ({
  FloatingPulseHudPanel: () => React.createElement("div", { "data-testid": "floating-hud-panel" }),
}));
vi.mock("@/shared/components/FloatingPulseHud", () => ({
  FloatingPulseHud: () => React.createElement("div", { "data-testid": "floating-hud" }),
}));

vi.mock("@/modules/auth/hooks/useAuthStore", () => ({
  useAuth: vi.fn(),
}));
vi.mock("@/modules/transcript/context/TranscriptHudContext", () => ({
  useTranscriptHud: vi.fn(),
}));
vi.mock("@/modules/context/hooks/useSessionStore", () => ({
  useSessionStore: vi.fn(),
  lastSessionStorageKey: (userId: string) => `pulse-hud-session-${userId}`,
}));
vi.mock("@/modules/context/hooks/useHudContextApi", () => ({
  useHudContextApi: vi.fn(),
}));
vi.mock("@/modules/context/hooks/useNoteApi", () => ({
  useNoteApi: vi.fn(),
}));
vi.mock("@/modules/context/hooks/useNoteTagApi", () => ({
  useNoteTagApi: vi.fn(),
}));
vi.mock("@/modules/context/hooks/useSessionList", () => ({
  useSessionList: vi.fn(),
}));
vi.mock("@/modules/transcript/hooks/useTranscriptStream", () => ({
  useTranscriptStream: vi.fn(),
}));
vi.mock("@/modules/transcript/hooks/useTranscriptBridge", () => ({
  useTranscriptMainBridge: vi.fn(),
  useTranscriptPipBridge: vi.fn(),
}));
vi.mock("@/modules/transcript/hooks/useMicCapture", () => ({
  useMicCapture: vi.fn(),
}));
vi.mock("@/modules/transcript/hooks/useBrowserFirstVoice", () => ({
  useBrowserFirstVoice: vi.fn(),
}));
vi.mock("@/modules/transcript/hooks/useSystemAudioCapture", () => ({
  useSystemAudioCapture: vi.fn(),
}));
vi.mock("@/modules/prompts/hooks/usePromptSuggestions", () => ({
  usePromptSuggestions: vi.fn(),
}));
vi.mock("@/modules/timeline/hooks/useTimelineMarkers", () => ({
  useTimelineMarkers: vi.fn(),
}));
vi.mock("@/modules/tagging/hooks/useTaggingShortcuts", () => ({
  useTaggingShortcuts: vi.fn(),
}));
vi.mock("@/shared/hooks/useHudAcceptedPromptState", () => ({
  useHudAcceptedPromptState: vi.fn(),
}));
vi.mock("@/shared/components/Toast", () => ({
  useToast: vi.fn(),
}));
vi.mock("@/shared/utils/electronPipSatellite", () => ({
  hasPipQuery: vi.fn().mockReturnValue(false),
}));
vi.mock("@/shared/utils/hudApiBaseUrl", () => ({
  getRuntimeApiConfig: vi.fn().mockReturnValue({ baseUrl: "http://localhost:3000" }),
}));
vi.mock("@/shared/utils/singleFlightByKey", () => ({
  singleFlightByKey: vi.fn((_key: string, factory: () => Promise<unknown>) => factory()),
}));
vi.mock("@/shared/utils/fetchWithAuth", () => ({
  fetchWithAuth: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));

import { App } from "./App";
import { useAuth } from "@/modules/auth/hooks/useAuthStore";
import { useTranscriptHud } from "@/modules/transcript/context/TranscriptHudContext";
import { useSessionStore } from "@/modules/context/hooks/useSessionStore";
import { useHudContextApi } from "@/modules/context/hooks/useHudContextApi";
import { useNoteApi } from "@/modules/context/hooks/useNoteApi";
import { useNoteTagApi } from "@/modules/context/hooks/useNoteTagApi";
import { useSessionList } from "@/modules/context/hooks/useSessionList";
import { useTranscriptStream } from "@/modules/transcript/hooks/useTranscriptStream";
import { useTranscriptMainBridge, useTranscriptPipBridge } from "@/modules/transcript/hooks/useTranscriptBridge";
import { useMicCapture } from "@/modules/transcript/hooks/useMicCapture";
import { useBrowserFirstVoice } from "@/modules/transcript/hooks/useBrowserFirstVoice";
import { useSystemAudioCapture } from "@/modules/transcript/hooks/useSystemAudioCapture";
import { usePromptSuggestions } from "@/modules/prompts/hooks/usePromptSuggestions";
import { useTimelineMarkers } from "@/modules/timeline/hooks/useTimelineMarkers";
import { useTaggingShortcuts } from "@/modules/tagging/hooks/useTaggingShortcuts";
import { useHudAcceptedPromptState } from "@/shared/hooks/useHudAcceptedPromptState";
import { useToast } from "@/shared/components/Toast";
import { hasPipQuery } from "@/shared/utils/electronPipSatellite";

const baseSession = {
  sessionId: "s1",
  sessionStatus: "active",
  metadata: { title: "Test Session", facilitator: "", audience: "", role: "" },
  notes: [],
  tags: [],
  availableTags: [],
  focusedTagId: null,
  selectedTranscriptId: null,
  focusTag: vi.fn(),
  selectTranscript: vi.fn(),
  setSessionId: vi.fn(),
  setSessionStatus: vi.fn(),
  updateMetadata: vi.fn(),
  addNote: vi.fn(),
  removeNote: vi.fn(),
  updateNotes: vi.fn(),
  upsertTag: vi.fn(),
  setTags: vi.fn(),
  applyServerHudSnapshot: vi.fn(),
  updateNoteTags: vi.fn(),
};

const baseTranscript = {
  items: [],
  prompts: [],
  signals: [],
  status: "connecting" as const,
  sendChunk: vi.fn().mockReturnValue(false),
  createTag: vi.fn().mockReturnValue(false),
  sendAudioChunk: vi.fn().mockResolvedValue(false),
  transcribing: false,
  errorMessage: undefined,
};

function setupMocks(pipMode = false) {
  vi.mocked(hasPipQuery).mockReturnValue(pipMode);
  vi.mocked(useAuth).mockReturnValue({ accessToken: "tok", refreshAccessToken: vi.fn().mockResolvedValue("tok"), user: { id: "u1" } } as never);
  vi.mocked(useTranscriptHud).mockReturnValue({ setHudSocketStatus: vi.fn(), setHudSocketError: vi.fn() } as never);
  vi.mocked(useSessionStore).mockReturnValue(baseSession as never);
  vi.mocked(useHudContextApi).mockReturnValue({ patchContext: vi.fn().mockResolvedValue(undefined) } as never);
  vi.mocked(useNoteApi).mockReturnValue({
    createNote: vi.fn().mockResolvedValue({ id: "n1", body: "", label: "", linkedTagIds: [] }),
    updateNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    listNotes: vi.fn().mockResolvedValue([]),
  } as never);
  vi.mocked(useNoteTagApi).mockReturnValue({
    addTagToNote: vi.fn().mockResolvedValue(undefined),
    removeTagFromNote: vi.fn().mockResolvedValue(undefined),
  } as never);
  vi.mocked(useSessionList).mockReturnValue({
    loading: false,
    listLoadSucceeded: true,
    sessions: [{ id: "s1", title: "Test Session", status: "active", createdAt: "t", updatedAt: "t" }],
    createSession: vi.fn().mockResolvedValue({ id: "s1" }),
    fetchSessionSnapshot: vi.fn().mockResolvedValue(null),
    lastActiveSessionId: "s1",
  } as never);
  vi.mocked(useTranscriptStream).mockReturnValue(baseTranscript as never);
  vi.mocked(useTranscriptMainBridge).mockReturnValue(undefined);
  vi.mocked(useTranscriptPipBridge).mockReturnValue({
    items: [],
    prompts: [],
    signals: [],
    status: "connecting",
    sendChunk: vi.fn().mockReturnValue(false),
  } as never);
  vi.mocked(useMicCapture).mockReturnValue({ isListening: false, isSupported: true, error: undefined, start: vi.fn(), stop: vi.fn() } as never);
  vi.mocked(useBrowserFirstVoice).mockReturnValue({ speechListening: false, isActive: false, supported: true, toggle: vi.fn() });
  vi.mocked(useSystemAudioCapture).mockReturnValue({ isListening: false, isSupported: true, error: undefined, start: vi.fn(), stop: vi.fn() });
  vi.mocked(usePromptSuggestions).mockReturnValue({ prompts: [] } as never);
  vi.mocked(useTimelineMarkers).mockReturnValue([] as never);
  vi.mocked(useTaggingShortcuts).mockReturnValue(undefined);
  vi.mocked(useHudAcceptedPromptState).mockReturnValue({
    acceptedMessages: [],
    dismissedPromptIds: new Set<string>(),
    handleHudPromptAccept: vi.fn(),
    handleHudPromptDismissId: vi.fn(),
  } as never);
  vi.mocked(useToast).mockReturnValue({ toast: vi.fn() } as never);
}

const theme = createTheme();
function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ThemeProvider, { theme }, children);
}

beforeEach(() => {
  setupMocks(false);
});

describe("App — normal mode", () => {
  it("renders without crashing", () => {
    const { container } = render(React.createElement(App), { wrapper: Wrapper });
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the session title from metadata", () => {
    const { container } = render(React.createElement(App), { wrapper: Wrapper });
    expect(container.textContent).toContain("Test Session");
  });

  it("renders the main panel stubs", () => {
    const { container } = render(React.createElement(App), { wrapper: Wrapper });
    expect(container.querySelector('[data-testid="transcript-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="context-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="floating-hud"]')).toBeTruthy();
  });

  it("shows transcript status chip when not connected", () => {
    vi.mocked(useTranscriptStream).mockReturnValue({ ...baseTranscript, status: "connecting" } as never);
    const { container } = render(React.createElement(App), { wrapper: Wrapper });
    expect(container.textContent).toContain("connecting");
  });
});

describe("App — PIP mode", () => {
  beforeEach(() => {
    setupMocks(true);
  });

  it("renders FloatingPulseHudPanel in PIP mode", () => {
    const { container } = render(React.createElement(App), { wrapper: Wrapper });
    expect(container.querySelector('[data-testid="floating-hud-panel"]')).toBeTruthy();
  });

  it("does not render the main layout panels in PIP mode", () => {
    const { container } = render(React.createElement(App), { wrapper: Wrapper });
    expect(container.querySelector('[data-testid="transcript-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="context-panel"]')).toBeNull();
  });
});
