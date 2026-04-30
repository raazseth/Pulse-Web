import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PropsWithChildren } from "react";




vi.mock("@/modules/auth/api/authApi", () => ({
  apiLogin: vi.fn(),
  apiRegister: vi.fn(),
  apiRefresh: vi.fn(),
  apiLogout: vi.fn(),
  persistRefreshTokenFromPair: vi.fn(),
  clearStoredRefreshToken: vi.fn(),
}));

vi.mock("@/shared/services/sessionIdb", () => ({
  deleteTranscriptDatabase: vi.fn().mockResolvedValue(undefined),
}));

import { apiLogin, apiRefresh, apiLogout } from "@/modules/auth/api/authApi";
import { deleteTranscriptDatabase } from "@/shared/services/sessionIdb";
import { AuthProvider, useAuth } from "./useAuthStore";
import type { AuthUser, TokenPair } from "@/modules/auth/types";

const mockLogin = vi.mocked(apiLogin);
const mockRefresh = vi.mocked(apiRefresh);
const mockLogout = vi.mocked(apiLogout);
const mockDeleteTranscriptDatabase = vi.mocked(deleteTranscriptDatabase);

const FAKE_USER: AuthUser = {
  id: "u1",
  email: "test@example.com",
  name: "Test User",
  createdAt: "2024-01-01T00:00:00.000Z",
};

const FAKE_TOKENS: TokenPair = {
  accessToken: "access-abc",
  
};

function wrapper({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}





function getStoredUser() {
  const raw = localStorage.getItem("pulse_user");
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  
  mockRefresh.mockRejectedValue(new Error("no cookie"));
});

afterEach(() => {
  localStorage.clear();
});





describe("AuthProvider — initial state (apiRefresh fails — no valid cookie)", () => {
  it("starts with null user and accessToken after failed refresh", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("always calls apiRefresh on mount (cookie-based — no pre-check)", async () => {
    renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    expect(mockRefresh).toHaveBeenCalledOnce();
  });
});

describe("AuthProvider — initial state (apiRefresh succeeds — valid cookie present)", () => {
  it("restores user and accessToken from a successful mount refresh", async () => {
    mockRefresh.mockResolvedValueOnce({ accessToken: "restored-token", user: FAKE_USER });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    expect(result.current.user).toEqual(FAKE_USER);
    expect(result.current.accessToken).toBe("restored-token");
    expect(result.current.isLoading).toBe(false);
  });
});





describe("AuthProvider — login", () => {
  it("sets user and accessToken in state after successful login", async () => {
    mockLogin.mockResolvedValueOnce({ user: FAKE_USER, tokens: FAKE_TOKENS });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.login("test@example.com", "pass");
    });

    expect(result.current.user).toEqual(FAKE_USER);
    expect(result.current.accessToken).toBe("access-abc");
  });

  it("persists user to localStorage", async () => {
    mockLogin.mockResolvedValueOnce({ user: FAKE_USER, tokens: FAKE_TOKENS });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    await act(async () => { await result.current.login("x@x.com", "pw"); });

    expect(getStoredUser()).toEqual(FAKE_USER);
  });

  it("does NOT store refresh token in any JS storage (it's an httpOnly cookie)", async () => {
    mockLogin.mockResolvedValueOnce({ user: FAKE_USER, tokens: FAKE_TOKENS });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});
    await act(async () => { await result.current.login("x@x.com", "pw"); });

    
    expect(sessionStorage.getItem("pulse_refresh_token")).toBeNull();
    expect(localStorage.getItem("pulse_refresh_token")).toBeNull();
    
    expect(localStorage.getItem("pulse_access_token")).toBeNull();
  });
});





describe("AuthProvider — refreshAccessToken", () => {
  it("returns new access token and updates state on success", async () => {
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {}); 

    mockRefresh.mockResolvedValueOnce({ accessToken: "new-access-2", user: FAKE_USER });

    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.refreshAccessToken();
    });

    expect(returned).toBe("new-access-2");
    expect(result.current.accessToken).toBe("new-access-2");
  });

  it("returns null and clears state when apiRefresh rejects (cookie absent/expired)", async () => {
    mockRefresh.mockRejectedValue(new Error("expired"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {}); 

    let returned: string | null = "sentinel";
    await act(async () => {
      returned = await result.current.refreshAccessToken();
    });

    expect(returned).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
  });
});





describe("AuthProvider — logout", () => {
  it("clears user and accessToken from state and localStorage", async () => {
    mockRefresh.mockResolvedValueOnce({ accessToken: "acc", user: FAKE_USER });
    mockLogout.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => { await result.current.logout(); });

    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it("calls apiLogout with no arguments (server reads cookie server-side)", async () => {
    mockRefresh.mockResolvedValueOnce({ accessToken: "acc", user: FAKE_USER });
    mockLogout.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => { await result.current.logout(); });

    expect(mockLogout).toHaveBeenCalledOnce();
    expect(mockLogout).toHaveBeenCalledWith();
  });

  it("clears per-user HUD localStorage keys and wipes transcript IDB", async () => {
    mockRefresh.mockResolvedValueOnce({ accessToken: "acc", user: FAKE_USER });
    mockLogout.mockResolvedValueOnce(undefined);

    localStorage.setItem("pulse_user", JSON.stringify(FAKE_USER));
    localStorage.setItem("pulse-hud-session:u1", JSON.stringify({ sessionId: "s1" }));
    localStorage.setItem("pulse-hud-last-session:u1", "s1");
    localStorage.setItem("pulse-hud-session", "legacy");

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {});

    await act(async () => {
      await result.current.logout();
    });

    expect(localStorage.getItem("pulse-hud-session:u1")).toBeNull();
    expect(localStorage.getItem("pulse-hud-last-session:u1")).toBeNull();
    expect(localStorage.getItem("pulse-hud-session")).toBeNull();
    expect(mockDeleteTranscriptDatabase).toHaveBeenCalled();
  });
});





