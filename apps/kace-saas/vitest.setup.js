import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";
import "./src/locale/i18n.js";

/*
 * jsdom comparte sessionStorage/localStorage entre tests de un mismo archivo:
 * sin esto, el estado persistido de UI se filtra de un test a otro.
 */
beforeEach(() => {
    try {
        window.sessionStorage.clear();
        window.localStorage.clear();
    } catch {
        // storage no disponible en este entorno
    }
});

global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));
