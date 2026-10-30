import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RouteErrorBoundary from "./RouteErrorBoundary.jsx";
import i18n from "../../locale/i18n.js";

const Boom = () => {
    throw new Error("chunk load failed");
};

describe("RouteErrorBoundary", () => {
    let consoleErrorSpy;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it("renderiza los hijos cuando no hay error", () => {
        render(
            <RouteErrorBoundary>
                <div>contenido ok</div>
            </RouteErrorBoundary>,
        );
        expect(screen.getByText("contenido ok")).toBeInTheDocument();
    });

    it("muestra el mensaje traducido (no las claves crudas) cuando un hijo falla", () => {
        expect(i18n.t("text.unexpectedError")).not.toBe("text.unexpectedError");
        expect(i18n.t("text.reloadSuggestion")).not.toBe("text.reloadSuggestion");
        expect(i18n.t("text.reload")).not.toBe("text.reload");

        render(
            <RouteErrorBoundary>
                <Boom />
            </RouteErrorBoundary>,
        );

        expect(screen.getByText(i18n.t("text.unexpectedError"))).toBeInTheDocument();
        expect(screen.getByText(i18n.t("text.reloadSuggestion"))).toBeInTheDocument();
        expect(screen.getByRole("button", { name: i18n.t("text.reload") })).toBeInTheDocument();
        expect(screen.queryByText("text.unexpectedError")).not.toBeInTheDocument();
    });

    it("recarga la página al pulsar el botón", async () => {
        const originalLocation = window.location;
        const reloadMock = vi.fn();
        Object.defineProperty(window, "location", {
            configurable: true,
            value: { ...originalLocation, reload: reloadMock },
        });
        const user = userEvent.setup();

        render(
            <RouteErrorBoundary>
                <Boom />
            </RouteErrorBoundary>,
        );

        await user.click(screen.getByRole("button", { name: i18n.t("text.reload") }));
        expect(reloadMock).toHaveBeenCalledTimes(1);

        Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    });
});
