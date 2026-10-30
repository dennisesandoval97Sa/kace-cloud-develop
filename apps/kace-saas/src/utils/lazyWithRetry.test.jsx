import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Component, Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { lazyWithRetry, reloadOnceForStaleChunk, RELOAD_FLAG } from "./lazyWithRetry.js";

class TestErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        return this.state.hasError ? <div>boundary-error</div> : this.props.children;
    }
}

describe("lazyWithRetry", () => {
    let reloadMock;
    let originalLocation;

    beforeEach(() => {
        sessionStorage.clear();
        originalLocation = window.location;
        reloadMock = vi.fn();
        Object.defineProperty(window, "location", {
            configurable: true,
            value: { ...originalLocation, reload: reloadMock },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, "location", {
            configurable: true,
            value: originalLocation,
        });
    });

    describe("reloadOnceForStaleChunk", () => {
        it("recarga y marca el guard la primera vez", () => {
            expect(reloadOnceForStaleChunk()).toBe(true);
            expect(reloadMock).toHaveBeenCalledTimes(1);
            expect(sessionStorage.getItem(RELOAD_FLAG)).toBe("true");
        });

        it("no vuelve a recargar si el guard ya está puesto", () => {
            sessionStorage.setItem(RELOAD_FLAG, "true");
            expect(reloadOnceForStaleChunk()).toBe(false);
            expect(reloadMock).not.toHaveBeenCalled();
        });
    });

    it("recarga una sola vez cuando falla el import de un chunk", async () => {
        const failing = () => Promise.reject(new Error("Failed to fetch dynamically imported module"));
        const Lazy = lazyWithRetry(failing);

        render(
            <Suspense fallback={<div>loading</div>}>
                <Lazy />
            </Suspense>,
        );

        await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
        expect(sessionStorage.getItem(RELOAD_FLAG)).toBe("true");
        expect(screen.getByText("loading")).toBeInTheDocument();
    });

    it("propaga el error al error boundary si ya se recargó antes", async () => {
        sessionStorage.setItem(RELOAD_FLAG, "true");
        const failing = () => Promise.reject(new Error("boom"));
        const Lazy = lazyWithRetry(failing);

        render(
            <TestErrorBoundary>
                <Suspense fallback={<div>loading</div>}>
                    <Lazy />
                </Suspense>
            </TestErrorBoundary>,
        );

        await waitFor(() => expect(screen.getByText("boundary-error")).toBeInTheDocument());
        expect(reloadMock).not.toHaveBeenCalled();
    });

    it("limpia el guard cuando el chunk carga correctamente", async () => {
        sessionStorage.setItem(RELOAD_FLAG, "true");
        const ok = () => Promise.resolve({ default: () => <div>cargado</div> });
        const Lazy = lazyWithRetry(ok);

        render(
            <Suspense fallback={<div>loading</div>}>
                <Lazy />
            </Suspense>,
        );

        await waitFor(() => expect(screen.getByText("cargado")).toBeInTheDocument());
        expect(sessionStorage.getItem(RELOAD_FLAG)).toBeNull();
        expect(reloadMock).not.toHaveBeenCalled();
    });
});
