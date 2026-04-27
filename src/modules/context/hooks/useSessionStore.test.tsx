import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { SessionStoreProvider, useSessionStore } from "./useSessionStore";
import type { TranscriptTag } from "@/modules/tagging/types";

function wrapper({ children }: PropsWithChildren) {
  return <SessionStoreProvider>{children}</SessionStoreProvider>;
}

const TAG: TranscriptTag = { id: "t1", tagId: "insight", timestamp: "2024-01-01T00:00:00.000Z" };

// ---------------------------------------------------------------------------
// Stable action refs (the key regression guard for defect #13)
//
// Each action uses useCallback(fn, []) so its reference never changes between
// renders. These tests will fail if any action is accidentally moved back to
// useMemo([state]) or useCallback([state]).
// ---------------------------------------------------------------------------

describe("useSessionStore — all action refs are stable across state changes", () => {
  it("setTags reference is unchanged after setTags is called", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const before = result.current.setTags;
    act(() => { result.current.setTags([TAG]); });
    expect(result.current.setTags).toBe(before);
  });

  it("upsertTag reference is unchanged after upsertTag is called", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const before = result.current.upsertTag;
    act(() => { result.current.upsertTag(TAG); });
    expect(result.current.upsertTag).toBe(before);
  });

  it("setSessionId reference is unchanged after setSessionId is called", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const before = result.current.setSessionId;
    act(() => { result.current.setSessionId("new-session"); });
    expect(result.current.setSessionId).toBe(before);
  });

  it("focusTag reference is unchanged after focusTag is called", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const before = result.current.focusTag;
    act(() => { result.current.focusTag("tag-id-2"); });
    expect(result.current.focusTag).toBe(before);
  });

  it("updateMetadata reference is unchanged after metadata is updated", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const before = result.current.updateMetadata;
    act(() => { result.current.updateMetadata({ title: "New Title" }); });
    expect(result.current.updateMetadata).toBe(before);
  });

  it("updateNotes reference is unchanged after notes are updated", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const before = result.current.updateNotes;
    act(() => { result.current.updateNotes([{ id: "n1", body: "note" }]); });
    expect(result.current.updateNotes).toBe(before);
  });

  it("selectTranscript reference is unchanged after a selection", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const before = result.current.selectTranscript;
    act(() => { result.current.selectTranscript("item-id-1"); });
    expect(result.current.selectTranscript).toBe(before);
  });

  it("all seven action refs survive multiple independent state changes", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });

    const snapshot = {
      setTags: result.current.setTags,
      upsertTag: result.current.upsertTag,
      setSessionId: result.current.setSessionId,
      focusTag: result.current.focusTag,
      updateMetadata: result.current.updateMetadata,
      updateNotes: result.current.updateNotes,
      selectTranscript: result.current.selectTranscript,
    };

    act(() => {
      result.current.setSessionId("s-1");
      result.current.updateMetadata({ title: "T", facilitator: "F" });
      result.current.setTags([TAG]);
    });

    expect(result.current.setTags).toBe(snapshot.setTags);
    expect(result.current.upsertTag).toBe(snapshot.upsertTag);
    expect(result.current.setSessionId).toBe(snapshot.setSessionId);
    expect(result.current.focusTag).toBe(snapshot.focusTag);
    expect(result.current.updateMetadata).toBe(snapshot.updateMetadata);
    expect(result.current.updateNotes).toBe(snapshot.updateNotes);
    expect(result.current.selectTranscript).toBe(snapshot.selectTranscript);
  });
});

// ---------------------------------------------------------------------------
// State changes — verify the actions actually update state correctly
// ---------------------------------------------------------------------------

describe("useSessionStore — state mutations", () => {
  it("setSessionId updates sessionId", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    act(() => { result.current.setSessionId("test-session"); });
    expect(result.current.sessionId).toBe("test-session");
  });

  it("setTags replaces the tags array", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    act(() => { result.current.setTags([TAG]); });
    expect(result.current.tags).toEqual([TAG]);
  });

  it("upsertTag appends a tag when the id is new", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const newTag: TranscriptTag = { id: "t2", tagId: "risk", timestamp: "2024-01-02T00:00:00.000Z" };
    act(() => { result.current.upsertTag(newTag); });
    expect(result.current.tags).toContainEqual(newTag);
  });

  it("upsertTag replaces a tag with the same id", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const updated: TranscriptTag = { id: "t1", tagId: "updated", timestamp: "2024-01-01T00:01:00.000Z" };
    act(() => { result.current.setTags([TAG]); });
    act(() => { result.current.upsertTag(updated); });
    expect(result.current.tags).toHaveLength(1);
    expect(result.current.tags[0]).toEqual(updated);
  });

  it("focusTag sets focusedTagId", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    act(() => { result.current.focusTag("tag-xyz"); });
    expect(result.current.focusedTagId).toBe("tag-xyz");
  });

  it("updateMetadata patches only the specified fields", () => {
    const { result } = renderHook(() => useSessionStore(), { wrapper });
    const originalFacilitator = result.current.metadata.facilitator;
    act(() => { result.current.updateMetadata({ title: "Patched Title" }); });
    expect(result.current.metadata.title).toBe("Patched Title");
    expect(result.current.metadata.facilitator).toBe(originalFacilitator); // unchanged
  });
});
