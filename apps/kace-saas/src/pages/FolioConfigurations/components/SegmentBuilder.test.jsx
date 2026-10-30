import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/locale/i18n";
import SegmentBuilder from "./SegmentBuilder";
import { SEGMENT_DEFAULTS } from "../data/constants";

// Radix Select los llama al abrir su lista; jsdom no los implementa.
Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
    setPointerCapture: { configurable: true, value: () => {} },
});

vi.mock("@/pages/Actions/hooks/useModelsData", () => ({
    default: () => ({ opcionesBuilder: [], loading: false }),
}));

const sequence = { type: "sequence", length: 6, pad_char: "0" };
const literal = (value) => ({ type: "literal", value });

/** Holds the list like FolioConfigurationForm does and exposes every emitted value. */
const renderBuilder = (initial) => {
    const changes = [];
    const Harness = () => {
        const [segments, setSegments] = useState(initial);
        return (
            <SegmentBuilder
                segments={segments}
                onChange={(next) => {
                    changes.push(next);
                    setSegments(next);
                }}
            />
        );
    };
    render(<Harness />);
    return { changes, last: () => changes.at(-1) };
};

describe("SegmentBuilder", () => {
    it("añade un literal vacío sin compartir el objeto de valores por defecto", async () => {
        const user = userEvent.setup();
        const { last } = renderBuilder([sequence]);

        await user.click(screen.getByTestId("folio_segment_add"));
        await user.click(screen.getByTestId("folio_segment_add"));

        expect(last()).toEqual([sequence, literal(""), literal("")]);
        expect(last()[1]).not.toBe(last()[2]);
        expect(last()[1]).not.toBe(SEGMENT_DEFAULTS.literal);
    });

    it("mueve un segmento y no deja salir de los extremos", async () => {
        const user = userEvent.setup();
        const { last, changes } = renderBuilder([literal("A"), sequence]);

        expect(screen.getByTestId("folio_segment_up_0")).toBeDisabled();
        expect(screen.getByTestId("folio_segment_down_1")).toBeDisabled();

        await user.click(screen.getByTestId("folio_segment_down_0"));

        expect(changes).toHaveLength(1);
        expect(last()).toEqual([sequence, literal("A")]);
    });

    it("elimina el segmento indicado", async () => {
        const user = userEvent.setup();
        const { last } = renderBuilder([literal("A"), sequence, literal("B")]);

        await user.click(screen.getByTestId("folio_segment_remove_1"));

        expect(last()).toEqual([literal("A"), literal("B")]);
    });

    it("avisa cuando no hay exactamente un consecutivo", async () => {
        const user = userEvent.setup();
        renderBuilder([literal("A"), sequence]);

        expect(screen.queryByTestId("folio_segment_sequence_error")).not.toBeInTheDocument();

        await user.click(screen.getByTestId("folio_segment_remove_1"));

        expect(screen.getByRole("alert")).toHaveAttribute("data-testid", "folio_segment_sequence_error");
    });

    it("al cambiar de tipo usa los valores por defecto del nuevo tipo y no arrastra los anteriores", async () => {
        const user = userEvent.setup();
        const { last } = renderBuilder([literal("RAD-"), sequence]);

        await user.click(screen.getByTestId("folio_segment_type_0"));
        await user.click(screen.getByRole("option", { name: i18n.t("folioConfigurations.segments.types.date") }));

        expect(last()[0]).toEqual(SEGMENT_DEFAULTS.date);
        expect(last()[0]).not.toHaveProperty("value");
    });

    it("asocia cada etiqueta con su control", () => {
        renderBuilder([literal("A"), sequence]);

        expect(screen.getAllByLabelText(i18n.t("folioConfigurations.segments.value"))[0]).toHaveValue("A");
        expect(screen.getByLabelText(i18n.t("folioConfigurations.segments.length"))).toHaveValue(6);
        expect(screen.getByLabelText(i18n.t("folioConfigurations.segments.padChar"))).toHaveValue("0");
        expect(screen.getAllByLabelText(i18n.t("folioConfigurations.segments.type"))).toHaveLength(2);
    });
});
