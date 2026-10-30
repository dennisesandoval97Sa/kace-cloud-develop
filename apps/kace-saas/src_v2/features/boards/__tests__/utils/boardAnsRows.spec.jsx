import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { getAnsColorMap, getAnsColumnKeys, wrapRowAns } from "@kace_v2/features/boards/utils/boardAnsRows.util";

describe("getAnsColumnKeys", () => {
    it("returns alias or field for is_ans columns and filters falsy", () => {
        const columns = [
            { is_ans: true, alias: "ans_alias", field: "ans_field" },
            { is_ans: true, alias: "", field: "ans_field_only" },
            { is_ans: false, alias: "skip_me", field: "skip_field" },
            { is_ans: true, alias: "", field: "" },
        ];
        expect(getAnsColumnKeys(columns)).toEqual(["ans_alias", "ans_field_only"]);
    });

    it("returns empty array when no columns", () => {
        expect(getAnsColumnKeys()).toEqual([]);
    });
});

describe("getAnsColorMap", () => {
    it("indexes color buckets by ans id", () => {
        const items = [
            {
                id: "ans-1",
                color_ans_inicial: "#111111",
                color_ans_intermedio: "#222222",
                color_ans_final: "#333333",
            },
            {
                id: "ans-2",
                color_ans_inicial: "#444444",
                color_ans_intermedio: "#555555",
                color_ans_final: "#666666",
            },
        ];
        expect(getAnsColorMap(items)).toEqual({
            "ans-1": { 1: "#111111", 2: "#222222", 3: "#333333" },
            "ans-2": { 1: "#444444", 2: "#555555", 3: "#666666" },
        });
    });

    it("falls back to defaults for missing color fields", () => {
        const map = getAnsColorMap([{ id: "ans-x" }]);
        expect(map["ans-x"]).toEqual({ 1: "#bdde86", 2: "#ea6718", 3: "#e61e1e" });
    });

    it("returns empty map when no items", () => {
        expect(getAnsColorMap([])).toEqual({});
    });
});

describe("wrapRowAns", () => {
    const colorsByAnsId = {
        "ans-1": { 1: "#aaaaaa", 2: "#bbbbbb", 3: "#cccccc" },
        "ans-2": { 1: "#dddddd", 2: "#eeeeee", 3: "#ffffff" },
    };

    const renderCell = (cell) => {
        const { container } = render(cell);
        return container.querySelector("span");
    };

    it("returns the row unchanged when keys is empty", () => {
        const row = { ans_id: "ans-1", state: 1 };
        expect(wrapRowAns(row, [], colorsByAnsId)).toBe(row);
    });

    it("uses per-row colors when present (priority over catalog)", () => {
        const row = {
            ans_id: "ans-2",
            state: 1,
            color_ans_inicial: "#000001",
            color_ans_intermedio: "#000002",
            color_ans_final: "#000003",
        };
        const result = wrapRowAns(row, ["state"], colorsByAnsId);
        const span = renderCell(result.state);
        expect(span.getAttribute("style")).toContain("background-color: rgb(0, 0, 1)");
    });

    it("falls back to colorsByAnsId[ans_id] when row has no per-row colors", () => {
        const row = { ans_id: "ans-2", state: 2 };
        const result = wrapRowAns(row, ["state"], colorsByAnsId);
        const span = renderCell(result.state);
        expect(span.getAttribute("style")).toContain("background-color: rgb(238, 238, 238)");
    });

    it("falls back to medicion_ans_id when ans_id is missing", () => {
        const row = { medicion_ans_id: "ans-1", state: 3 };
        const result = wrapRowAns(row, ["state"], colorsByAnsId);
        const span = renderCell(result.state);
        expect(span.getAttribute("style")).toContain("background-color: rgb(204, 204, 204)");
    });

    it("falls back to the first ANS bucket when no ids match", () => {
        const row = { ans_id: "missing", state: 1 };
        const result = wrapRowAns(row, ["state"], colorsByAnsId);
        const span = renderCell(result.state);
        expect(span.getAttribute("style")).toContain("background-color: rgb(170, 170, 170)");
    });

    it("leaves the cell untouched when value is not a finite position", () => {
        const row = { ans_id: "ans-1", state: "n/a" };
        const result = wrapRowAns(row, ["state"], colorsByAnsId);
        expect(result.state).toBe("n/a");
    });

    it("calls t() for the aria-label and falls back when t is not provided", () => {
        const t = vi.fn((_, opts) => `tr-${opts.position}`);
        const row = { ans_id: "ans-1", state: 2 };
        const result = wrapRowAns(row, ["state"], colorsByAnsId, t);
        const span = renderCell(result.state);
        expect(t).toHaveBeenCalledWith("boards.ans.position", expect.objectContaining({ position: 2 }));
        expect(span.getAttribute("aria-label")).toBe("tr-2");

        const noTResult = wrapRowAns(row, ["state"], colorsByAnsId);
        const noTSpan = renderCell(noTResult.state);
        expect(noTSpan.getAttribute("aria-label")).toBe("ANS position 2");
    });
});
