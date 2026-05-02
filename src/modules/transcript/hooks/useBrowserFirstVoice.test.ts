import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/modules/transcript/utils/browserSpeechRecognition", () => ({
  getSpeechRecognitionConstructor: vi.fn(),
  isBrowserSpeechRecognitionSupported: vi.fn().mockReturnValue(false),
}));

import {
  getSpeechRecognitionConstructor,
  isBrowserSpeechRecognitionSupported,
} from "@/modules/transcript/utils/browserSpeechRecognition";
import { useBrowserFirstVoice } from "./useBrowserFirstVoice";

class MockRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  onresult: ((e: {
    resultIndex: number;
    results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
  }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  static instances: MockRecognition[] = [];
  constructor() {
    MockRecognition.instances.push(this);
  }
}

type MicStub = {
  isListening: boolean;
  isSupported: boolean;
  error: string | undefined;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

function makeMic(overrides: Partial<MicStub> = {}): MicStub {
  return {
    isListening: false,
    isSupported: true,
    error: undefined,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    ...overrides,
  };
}

type MockCtor = ReturnType<typeof getSpeechRecognitionConstructor>;

beforeEach(() => {
  vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(null);
  vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(false);
  MockRecognition.instances = [];
  delete (window as Window & { api?: unknown }).api;
});

describe("useBrowserFirstVoice — state defaults", () => {
  it("speechListening and isActive start false", () => {
    const { result } = renderHook(() =>
      useBrowserFirstVoice({ mic: makeMic() as never, disabled: false, getSpeakerId: () => "" }),
    );
    expect(result.current.speechListening).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  it("supported=false when both browser speech API and mic are unavailable", () => {
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(false);
    const { result } = renderHook(() =>
      useBrowserFirstVoice({ mic: makeMic({ isSupported: false }) as never, disabled: false, getSpeakerId: () => "" }),
    );
    expect(result.current.supported).toBe(false);
  });

  it("supported=true when isBrowserSpeechRecognitionSupported returns true", () => {
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const { result } = renderHook(() =>
      useBrowserFirstVoice({ mic: makeMic({ isSupported: false }) as never, disabled: false, getSpeakerId: () => "" }),
    );
    expect(result.current.supported).toBe(true);
  });

  it("supported=true when mic.isSupported is true", () => {
    const { result } = renderHook(() =>
      useBrowserFirstVoice({ mic: makeMic({ isSupported: true }) as never, disabled: false, getSpeakerId: () => "" }),
    );
    expect(result.current.supported).toBe(true);
  });
});

describe("useBrowserFirstVoice — toggle", () => {
  it("does nothing when disabled=true", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const { result } = renderHook(() =>
      useBrowserFirstVoice({
        mic: makeMic() as never,
        onDictatedText: vi.fn(),
        disabled: true,
        getSpeakerId: () => "",
      }),
    );
    act(() => result.current.toggle());
    expect(MockRecognition.instances).toHaveLength(0);
    expect(result.current.speechListening).toBe(false);
  });

  it("starts speech recognition in non-Electron browser", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const { result } = renderHook(() =>
      useBrowserFirstVoice({
        mic: makeMic() as never,
        onDictatedText: vi.fn(),
        disabled: false,
        getSpeakerId: () => "sp",
      }),
    );
    act(() => result.current.toggle());
    expect(MockRecognition.instances).toHaveLength(1);
    expect(MockRecognition.instances[0].start).toHaveBeenCalled();
    expect(result.current.speechListening).toBe(true);
  });

  it("stops recognition when called while already listening", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const { result } = renderHook(() =>
      useBrowserFirstVoice({
        mic: makeMic() as never,
        onDictatedText: vi.fn(),
        disabled: false,
        getSpeakerId: () => "sp",
      }),
    );
    act(() => result.current.toggle()); // start
    const rec = MockRecognition.instances[0];
    act(() => result.current.toggle()); // stop
    expect(rec.stop).toHaveBeenCalled();
    expect(result.current.speechListening).toBe(false);
  });

  it("calls mic.start() in Electron shell if mic is supported", () => {
    (window as unknown as { api?: unknown }).api = {};
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(null);
    const mic = makeMic({ isSupported: true });
    const { result } = renderHook(() =>
      useBrowserFirstVoice({
        mic: mic as never,
        onDictatedText: vi.fn(),
        disabled: false,
        getSpeakerId: () => "sp",
      }),
    );
    act(() => result.current.toggle());
    expect(mic.start).toHaveBeenCalled();
  });
});

describe("useBrowserFirstVoice — speech events", () => {
  it("onresult delivers trimmed final transcript to onDictatedText", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const onDictatedText = vi.fn();
    const { result } = renderHook(() =>
      useBrowserFirstVoice({
        mic: makeMic() as never,
        onDictatedText,
        disabled: false,
        getSpeakerId: () => "sp",
      }),
    );
    act(() => result.current.toggle());
    const rec = MockRecognition.instances[0];
    act(() => {
      rec.onresult!({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: true, 0: { transcript: "  hello world  " } } },
      });
    });
    expect(onDictatedText).toHaveBeenCalledWith("hello world");
  });

  it("onresult skips non-final results", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const onDictatedText = vi.fn();
    const { result } = renderHook(() =>
      useBrowserFirstVoice({
        mic: makeMic() as never,
        onDictatedText,
        disabled: false,
        getSpeakerId: () => "sp",
      }),
    );
    act(() => result.current.toggle());
    act(() => {
      MockRecognition.instances[0].onresult!({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: false, 0: { transcript: "interim" } } },
      });
    });
    expect(onDictatedText).not.toHaveBeenCalled();
  });

  it("onerror 'no-speech' is ignored (stays listening)", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const { result } = renderHook(() =>
      useBrowserFirstVoice({
        mic: makeMic() as never,
        onDictatedText: vi.fn(),
        disabled: false,
        getSpeakerId: () => "sp",
      }),
    );
    act(() => result.current.toggle());
    act(() => { MockRecognition.instances[0].onerror!({ error: "no-speech" }); });
    expect(result.current.speechListening).toBe(true);
  });

  it("onerror 'network' stops recognition", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const { result } = renderHook(() =>
      useBrowserFirstVoice({
        mic: makeMic() as never,
        onDictatedText: vi.fn(),
        disabled: false,
        getSpeakerId: () => "sp",
      }),
    );
    act(() => result.current.toggle());
    act(() => { MockRecognition.instances[0].onerror!({ error: "network" }); });
    expect(result.current.speechListening).toBe(false);
  });
});

describe("useBrowserFirstVoice — lifecycle", () => {
  it("stops speech recognition on unmount", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const { result, unmount } = renderHook(() =>
      useBrowserFirstVoice({
        mic: makeMic() as never,
        onDictatedText: vi.fn(),
        disabled: false,
        getSpeakerId: () => "sp",
      }),
    );
    act(() => result.current.toggle());
    const rec = MockRecognition.instances[0];
    unmount();
    expect(rec.stop).toHaveBeenCalled();
  });

  it("stops speech when disabled changes from false→true", () => {
    vi.mocked(getSpeechRecognitionConstructor).mockReturnValue(MockRecognition as unknown as MockCtor);
    vi.mocked(isBrowserSpeechRecognitionSupported).mockReturnValue(true);
    const mic = makeMic();
    const { result, rerender } = renderHook(
      ({ disabled }: { disabled: boolean }) =>
        useBrowserFirstVoice({ mic: mic as never, onDictatedText: vi.fn(), disabled, getSpeakerId: () => "sp" }),
      { initialProps: { disabled: false } },
    );
    act(() => result.current.toggle());
    expect(result.current.speechListening).toBe(true);
    act(() => rerender({ disabled: true }));
    expect(result.current.speechListening).toBe(false);
  });
});
