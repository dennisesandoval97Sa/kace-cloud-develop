import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useInactivityLogout from "./useInactivityLogout";

const SESSION_EXPIRATION_KEY = "sessionExpiration";

describe("useInactivityLogout", () => {
    let onLogout;
    let onContinue;

    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        onLogout = vi.fn().mockResolvedValue(undefined);
        onContinue = vi.fn().mockResolvedValue(undefined);
        vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it("does not write sessionExpiration while disabled", () => {
        renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: false,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(localStorage.getItem(SESSION_EXPIRATION_KEY)).toBeNull();
    });

    it("initializes sessionExpiration when enabled", () => {
        renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        const exp = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));
        expect(Number.isFinite(exp)).toBe(true);
        expect(exp - Date.now()).toBeGreaterThan(29 * 60 * 1000);
    });

    it("does not open modal when warningMinutes is 0", () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 5,
                warningMinutes: 0,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        act(() => {
            vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);
        });
        expect(result.current.showModal).toBe(false);

        act(() => {
            vi.advanceTimersByTime(2 * 1000);
        });
        expect(result.current.showModal).toBe(false);
    });

    it("opens modal when session time left is within warning_logout_time of inactivity_time", () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        act(() => {
            vi.advanceTimersByTime(25 * 60 * 1000);
        });
        expect(result.current.showModal).toBe(false);

        act(() => {
            vi.advanceTimersByTime(60 * 1000);
        });
        expect(result.current.showModal).toBe(true);
    });

    it("keeps modal open with countdown while in warning window", () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        act(() => {
            vi.advanceTimersByTime(26 * 60 * 1000);
        });
        expect(result.current.showModal).toBe(true);

        act(() => {
            vi.advanceTimersByTime(10 * 1000);
        });
        expect(result.current.showModal).toBe(true);
        expect(result.current.countdown).toBeGreaterThan(0);
    });

    it("handleContinue extends session and allows modal again when time re-enters warning window", async () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        act(() => {
            vi.advanceTimersByTime(26 * 60 * 1000);
        });
        expect(result.current.showModal).toBe(true);

        const before = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));
        await act(async () => {
            result.current.handleContinue();
        });
        const after = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));
        expect(after).toBeGreaterThan(before);
        expect(result.current.showModal).toBe(false);
        expect(onContinue).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(26 * 60 * 1000);
        });
        expect(result.current.showModal).toBe(true);
    });

    it("handleCloseModal does not extend sessionExpiration and never reopens modal", () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        const target = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));

        act(() => {
            vi.advanceTimersByTime(26 * 60 * 1000);
        });
        expect(result.current.showModal).toBe(true);

        act(() => {
            result.current.handleCloseModal();
        });
        expect(Number(localStorage.getItem(SESSION_EXPIRATION_KEY))).toBe(target);
        expect(result.current.showModal).toBe(false);

        act(() => {
            vi.advanceTimersByTime(30 * 60 * 1000);
        });
        expect(result.current.showModal).toBe(false);
    });

    it("does not bump session on click while modal is open", () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        act(() => {
            vi.advanceTimersByTime(26 * 60 * 1000);
        });
        const target = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));
        expect(result.current.showModal).toBe(true);

        act(() => {
            document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        expect(Number(localStorage.getItem(SESSION_EXPIRATION_KEY))).toBe(target);
    });

    it("bumps session on click when modal is closed", () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        const before = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));
        act(() => {
            vi.advanceTimersByTime(50);
            document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        const after = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));
        expect(after).toBeGreaterThan(before);
        expect(result.current.showModal).toBe(false);
    });

    it("resets session when inactivity or warning minutes change while enabled", () => {
        const { rerender } = renderHook(
            ({ inactivityMinutes, warningMinutes }) =>
                useInactivityLogout({
                    inactivityMinutes,
                    warningMinutes,
                    enabled: true,
                    onLogout,
                    onContinue,
                    oneScriptOrigin: "https://origin.test",
                }),
            {
                initialProps: { inactivityMinutes: 30, warningMinutes: 5 },
            },
        );

        const first = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));
        act(() => {
            rerender({ inactivityMinutes: 45, warningMinutes: 5 });
        });
        const second = Number(localStorage.getItem(SESSION_EXPIRATION_KEY));
        expect(Math.abs(second - first)).toBeGreaterThan(1);
    });

    it("invokes onLogout once when session expires", async () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 30,
                warningMinutes: 5,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        localStorage.setItem(SESSION_EXPIRATION_KEY, String(Date.now() + 500));
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        expect(onLogout).toHaveBeenCalledTimes(1);
        expect(result.current.showModal).toBe(false);
    });

    it("does not open modal while time left exceeds warning window", () => {
        const { result } = renderHook(() =>
            useInactivityLogout({
                inactivityMinutes: 5,
                warningMinutes: 4,
                enabled: true,
                onLogout,
                onContinue,
                oneScriptOrigin: "https://origin.test",
            }),
        );

        act(() => {
            vi.advanceTimersByTime(30 * 1000);
        });
        expect(result.current.showModal).toBe(false);

        act(() => {
            vi.advanceTimersByTime(31 * 1000);
        });
        expect(result.current.showModal).toBe(true);
    });
});
