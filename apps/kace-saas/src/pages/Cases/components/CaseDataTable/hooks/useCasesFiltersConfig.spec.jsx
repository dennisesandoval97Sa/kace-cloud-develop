import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useCasesFiltersConfig from "./useCasesFiltersConfig";

const renderConfig = (initialProps) => renderHook((props) => useCasesFiltersConfig(props), { initialProps });

const findAction = (result, id) => result.current.casesFiltersConfig.find((filter) => filter.id === id);

describe("useCasesFiltersConfig", () => {
    it("uses the latest handleApplyFilters and viewPrefix after a rerender", () => {
        const firstApply = vi.fn();
        const latestApply = vi.fn();

        const { result, rerender } = renderConfig({
            handleApplyFilters: firstApply,
            viewPrefix: "cases.",
            isCustomViewEnabled: false,
        });

        rerender({
            handleApplyFilters: latestApply,
            viewPrefix: "",
            isCustomViewEnabled: true,
        });

        findAction(result, "open_cases").action();

        expect(firstApply).not.toHaveBeenCalled();
        expect(latestApply).toHaveBeenCalledWith({
            open_cases: {
                field: "fecha_resolucion",
                operator: "null",
                type: "AND",
                value: "null",
            },
        });
    });

    it("uses the latest handleClearFilters after a rerender", () => {
        const firstClear = vi.fn();
        const latestClear = vi.fn();

        const { result, rerender } = renderConfig({ handleClearFilters: firstClear });

        rerender({ handleClearFilters: latestClear });

        findAction(result, "all_cases").action();

        expect(firstClear).not.toHaveBeenCalled();
        expect(latestClear).toHaveBeenCalledTimes(1);
    });

    it("prefixes closed_cases with the current viewPrefix", () => {
        const handleApplyFilters = vi.fn();

        const { result } = renderConfig({ handleApplyFilters, viewPrefix: "cases." });

        findAction(result, "closed_cases").action();

        expect(handleApplyFilters).toHaveBeenCalledWith({
            closed_cases: {
                field: "cases.fecha_resolucion",
                operator: "notNull",
                type: "AND",
                value: "null",
            },
        });
    });

    it("drops inactive_users when the custom view is enabled", () => {
        const { result, rerender } = renderConfig({ isCustomViewEnabled: false });

        expect(findAction(result, "inactive_users")).toBeDefined();

        rerender({ isCustomViewEnabled: true });

        expect(findAction(result, "inactive_users")).toBeUndefined();
    });
});
