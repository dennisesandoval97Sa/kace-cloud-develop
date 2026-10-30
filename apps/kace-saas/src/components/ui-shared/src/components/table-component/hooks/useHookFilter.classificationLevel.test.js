import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createNivelFieldTransformer } from "../../../../../../pages/Cases/components/CaseDataTable/utils/transformNivelFilters";
import { URL_AND_KEYS } from "../../../../../../utils/urlAndKeys";

const dispatchSpy = vi.fn();
const toastWarningSpy = vi.hoisted(() => vi.fn());

vi.mock("react-redux", () => ({
    useDispatch: () => dispatchSpy,
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({ fetchQuery: vi.fn(), setQueryData: vi.fn() }),
}));

vi.mock("sonner", () => ({
    toast: { info: vi.fn(), warning: toastWarningSpy, promise: vi.fn() },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../../../../../hooks/useUserInformation", () => ({
    default: () => ({ user: null }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => [] }),
}));

const { default: useHookFilter } = await import("./useHookFilter");

describe("useHookFilter — classification level ('por nivel') filtering", () => {
    beforeEach(() => {
        dispatchSpy.mockClear();
        toastWarningSpy.mockClear();
    });

    it("resolves the column for the level the user actually picked (nivel3), not the fixed 'nivel1' field key", async () => {
        const nameTable = {
            ...URL_AND_KEYS.cases,
            transformFilterField: createNivelFieldTransformer({ isCustomView: false }),
        };

        const { result } = renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
                baseFilters: [],
            }),
        );

        await act(async () => {
            await result.current.onSubmit({ nivel1: "nivel3/ValorSeleccionado" }, false);
        });

        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        const dispatchedAction = dispatchSpy.mock.calls[0][0];
        const [appliedFilter] = dispatchedAction.payload;

        expect(appliedFilter.column).toBe("clasificaciones.nivel3");
        expect(appliedFilter.value).toBe("ValorSeleccionado");
    });

    it("still resolves nivel1 correctly (regression guard for the original single-level case)", async () => {
        const nameTable = {
            ...URL_AND_KEYS.cases,
            transformFilterField: createNivelFieldTransformer({ isCustomView: false }),
        };

        const { result } = renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
                baseFilters: [],
            }),
        );

        await act(async () => {
            await result.current.onSubmit({ nivel1: "nivel1/ValorRaiz" }, false);
        });

        const dispatchedAction = dispatchSpy.mock.calls[0][0];
        const [appliedFilter] = dispatchedAction.payload;

        expect(appliedFilter.column).toBe("clasificaciones.nivel1");
        expect(appliedFilter.value).toBe("ValorRaiz");
    });

    it("leaves the field untransformed in custom-view mode (flat columns, no clasificaciones join)", async () => {
        const nameTable = {
            ...URL_AND_KEYS.cases,
            transformFilterField: createNivelFieldTransformer({ isCustomView: true }),
        };

        const { result } = renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
                baseFilters: [],
            }),
        );

        await act(async () => {
            await result.current.onSubmit({ nivel1: "nivel5/ValorCustom" }, false);
        });

        const dispatchedAction = dispatchSpy.mock.calls[0][0];
        const [appliedFilter] = dispatchedAction.payload;

        expect(appliedFilter.column).toBe("nivel5");
        expect(appliedFilter.value).toBe("ValorCustom");
    });

    it("leaves free-text filter values containing '/' untouched (not misread as a nivelX/Valor pair)", async () => {
        const nameTable = {
            ...URL_AND_KEYS.cases,
            transformFilterField: createNivelFieldTransformer({ isCustomView: false }),
        };

        const { result } = renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
                baseFilters: [],
            }),
        );

        await act(async () => {
            await result.current.onSubmit({ descripcion: "soporte 24/7" }, false);
        });

        const dispatchedAction = dispatchSpy.mock.calls[0][0];
        const [appliedFilter] = dispatchedAction.payload;

        expect(appliedFilter.column).not.toBe("soporte 24");
        expect(appliedFilter.value).toBe("soporte 24/7");
    });

    it("drops the filter when the picked level exceeds maxLevel in custom-view mode (view doesn't have that column)", async () => {
        const nameTable = {
            ...URL_AND_KEYS.cases,
            transformFilterField: createNivelFieldTransformer({ isCustomView: true, maxLevel: 5 }),
        };

        const { result } = renderHook(() =>
            useHookFilter({
                nameHelper: [],
                nameTable,
                setValue: vi.fn(),
                reset: vi.fn(),
                fieldsCustomerFilters: null,
                baseFilters: [],
            }),
        );

        await act(async () => {
            await result.current.onSubmit({ nivel1: "nivel7/ValorFueraDeRango" }, false);
        });

        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(toastWarningSpy).toHaveBeenCalledWith("app.text.someFiltersDiscarded");
    });
});
