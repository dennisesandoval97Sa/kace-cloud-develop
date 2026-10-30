/* eslint-disable react/prop-types */
import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USERS_SEARCH_URL = "/users/search";
const CLASSIFICATIONS_SEARCH_URL = "/classifications/search";

const genericSearchMock = vi.fn();
const selectPropsSpy = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/services/genericSearch", () => ({
    genericSearch: (...args) => genericSearchMock(...args),
}));

vi.mock("@/services/genericView", () => ({
    genericView: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useInfiniteQuery: () => ({
        data: { pages: [] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
    }),
    useQuery: () => ({ data: undefined }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: { error: (...args) => toastErrorMock(...args) },
}));

vi.mock("formik", () => ({
    useFormikContext: () => ({ values: { entity: "cases" } }),
}));

let levelsSelectMock = [{ name: "cases.responsable_id", type: "list", data: "casos" }];

/*
 * Stable references: the real useActionsData memoizes these; returning fresh literals here
 * would retrigger effects that depend on them and spin the component into a render loop.
 */
const ARRAY_ALL_LEVELS = [];
const actionsDataResult = {
    get arrayAllLevels() {
        return ARRAY_ALL_LEVELS;
    },
    get levelsSelect() {
        return levelsSelectMock;
    },
    loadingLevelsData: false,
};

vi.mock("../../hooks/useActionsData", () => ({
    default: () => actionsDataResult,
}));

vi.mock("./ActionsDefaultSelect", () => ({ default: () => <div data-testid="actions-default-select" /> }));
vi.mock("./FieldSelectorCustom", () => ({ FieldSelectorCustom: () => <div /> }));

vi.mock("@kace_v2/shared/ui/molecules/Select", () => ({
    default: (props) => {
        selectPropsSpy(props);
        return <div data-testid="builder-select" />;
    },
}));

vi.mock("@kace/ui-shared", () => ({
    ComboBox: () => <div />,
    Input: () => <div />,
}));

const { InputValueCustom } = await import("./InputValueCustom");

const renderComponent = (field = "cases.responsable_id") =>
    render(
        <InputValueCustom
            handleOnChange={vi.fn()}
            value=""
            field={field}
            operator="equal"
            rule={{ type: "options_list", value_type: "text", field, operator: "equal" }}
        />,
    );

const selectProps = () => selectPropsSpy.mock.calls[0][0];

describe("InputValueCustom - builder entity picker", () => {
    beforeEach(() => {
        genericSearchMock.mockReset();
        genericSearchMock.mockResolvedValue({ data: [] });
        selectPropsSpy.mockClear();
        toastErrorMock.mockClear();
        levelsSelectMock = [{ name: "cases.responsable_id", type: "list", data: "casos" }];
    });

    it("wires a multi-field responsable search into the Select and formats labels as the full name", async () => {
        genericSearchMock.mockResolvedValue({
            data: [{ id: "u1", nombres: "Ana", apellido1: null, apellido2: "Gómez" }],
        });
        renderComponent();

        const props = selectProps();
        expect(props.searchPlaceholder).toBe("actions.querybuilder.responsablePlaceholder");
        expect(props.noSearchResultsMessage).toBe("actions.querybuilder.noSearchResults");

        const options = await props.onSearch("perez");

        expect(genericSearchMock).toHaveBeenCalledTimes(3);
        const searchedFields = genericSearchMock.mock.calls.map(([, filter]) => filter.at(-1).field).sort();
        expect(searchedFields).toEqual(["apellido1", "apellido2", "nombres"]);
        for (const [url, filter] of genericSearchMock.mock.calls) {
            expect(url).toBe(USERS_SEARCH_URL);
            expect(filter).toContainEqual({
                field: "usuarios.deleted_at",
                operator: "null",
                value: "null",
                type: "AND",
            });
        }
        // label skips the missing surname (no double space)
        expect(options).toEqual([{ value: "u1", label: "Ana Gómez" }]);
    });

    it("toasts and returns nothing when every field-search fails", async () => {
        genericSearchMock.mockRejectedValue(new Error("network error"));
        renderComponent();

        const options = await selectProps().onSearch("perez");

        expect(options).toEqual([]);
        expect(toastErrorMock).toHaveBeenCalledWith("actions.querybuilder.searchError");
    });

    it("uses a single-field search and no custom placeholder for cases.estadoActual", async () => {
        levelsSelectMock = [{ name: "cases.estadoActual", type: "list", data: "casos" }];
        renderComponent("cases.estadoActual");

        await selectProps().onSearch("abierto");

        expect(genericSearchMock).toHaveBeenCalledTimes(1);
        expect(genericSearchMock.mock.calls[0][1]).toContainEqual({
            field: "nombre",
            operator: "ilike",
            value: "abierto",
            type: "AND",
        });
        expect(genericSearchMock.mock.calls[0][1]).toHaveLength(1);
        expect(selectProps().searchPlaceholder).toBeUndefined();
    });

    it("targets the classifications endpoint for clasificaciones.description", async () => {
        levelsSelectMock = [{ name: "clasificaciones.description", type: "list", data: "classifications" }];
        renderComponent("clasificaciones.description");

        await selectProps().onSearch("hardware");

        expect(genericSearchMock.mock.calls[0][0]).toBe(CLASSIFICATIONS_SEARCH_URL);
        expect(genericSearchMock.mock.calls[0][1]).toContainEqual({
            field: "description",
            operator: "ilike",
            value: "hardware",
            type: "AND",
        });
    });

    it("falls back to the ComboBox when the field is not mapped to a builder Select", () => {
        levelsSelectMock = [{ name: "clasificaciones.level1", type: "list", data: "classifications" }];
        renderComponent("clasificaciones.level1");

        expect(selectPropsSpy).not.toHaveBeenCalled();
    });
});
