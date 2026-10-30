/* eslint-disable react/prop-types */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import useSelectByProviderQuery from "@/hooks/useSelectByProviderQuery";
import { SelectByProvider } from "./SelectByProvider";

const hookState = {
    options: [{ value: "1", label: "Alpha" }],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: true,
    fetchNextPage: vi.fn(),
    setSearchTerm: vi.fn(),
};

const legacyQueryResult = {
    data: { data: [{ id: "1", nombre: "A" }] },
    isLoading: false,
};

vi.mock("@/hooks/useSelectByProviderQuery", () => ({
    default: vi.fn(() => hookState),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: vi.fn(() => legacyQueryResult),
}));

vi.mock("formik", () => ({
    useFormikContext: () => ({
        values: { flujo_id: "1" },
        setFieldValue: vi.fn(),
        setFieldTouched: vi.fn(),
    }),
}));

vi.mock("./Select/Select", () => ({
    Select: (props) => (
        <div
            data-testid="select-mock"
            data-has-fetch={String(typeof props.fetchNextPage === "function")}
            data-has-search={String(typeof props.onSearchChange === "function")}
            data-clearable={String(Boolean(props.clearable))}
            data-disable-until-ready={String(Boolean(props.disableUntilReady))}
            data-has-next-page={String(Boolean(props.hasNextPage))}
            data-options={JSON.stringify(props.options)}
        >
            <button type="button" data-testid="select-next-page" onClick={props.fetchNextPage} />
        </div>
    ),
}));

vi.mock("@kace/ui-shared", () => ({
    KField: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../../../services/genericSearch", () => ({
    genericSearch: vi.fn(),
}));

describe("SelectByProvider opt-in", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not call enhanced hook when flags are off", () => {
        render(<SelectByProvider name="flujo_id" url="/flows" />);

        expect(useSelectByProviderQuery).not.toHaveBeenCalled();
        const select = screen.getByTestId("select-mock");
        expect(select.dataset.hasFetch).toBe("true");
        expect(select.dataset.disableUntilReady).toBe("false");
        expect(select.dataset.clearable).toBe("false");
    });

    it("uses hook and passes search/scroll props when flags are on", () => {
        render(
            <SelectByProvider name="flujo_id" url="/flows" enableSearch enableInfiniteScroll enableAlphabeticalOrder />,
        );

        expect(useSelectByProviderQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "flujo_id",
                enableSearch: true,
                enableInfiniteScroll: true,
                enableAlphabeticalOrder: true,
                selectedValue: "1",
            }),
        );
        const select = screen.getByTestId("select-mock");
        expect(select.dataset.hasFetch).toBe("true");
        expect(select.dataset.hasSearch).toBe("true");
        expect(select.dataset.disableUntilReady).toBe("true");
        expect(select.dataset.clearable).toBe("false");
        expect(select.dataset.options).toContain("Alpha");
    });

    it("passes clearable when explicitly enabled", () => {
        render(
            <SelectByProvider
                name="flujo_id"
                url="/flows"
                enableSearch
                enableInfiniteScroll
                enableAlphabeticalOrder
                clearable
            />,
        );

        expect(screen.getByTestId("select-mock").dataset.clearable).toBe("true");
    });

    it("keeps the legacy path when handlerOptionsTypes is present with flags", () => {
        const handlerOptionsTypes = vi.fn();
        render(
            <SelectByProvider
                name="flujo_id"
                url="/flows"
                enableSearch
                enableInfiniteScroll
                handlerOptionsTypes={handlerOptionsTypes}
            />,
        );

        expect(useSelectByProviderQuery).not.toHaveBeenCalled();
        expect(screen.getByTestId("select-mock").dataset.hasFetch).toBe("true");
    });
});

describe("SelectByProvider legacy options", () => {
    const horarioA = { id: "1", codigo: "A", description: "Horario A" };

    const renderedOptions = () => JSON.parse(screen.getByTestId("select-mock").dataset.options);

    const mockPages = (pages) => {
        vi.mocked(useQuery).mockImplementation(({ queryKey }) => pages[queryKey[2]] ?? { isLoading: true });
    };

    afterEach(() => {
        vi.mocked(useQuery).mockImplementation(() => legacyQueryResult);
    });

    it("adds the initial value as option when it is not in the results", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                initialValue={{ id: "2", description: "Horario B" }}
            />,
        );

        expect(renderedOptions()).toEqual([
            { value: "2", label: "Horario B" },
            { value: "1", label: "Horario A" },
        ]);
    });

    it("does not add an empty initial value (e.g. a group whose schedule was deleted)", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                initialValue={{ id: null, description: "" }}
            />,
        );

        expect(renderedOptions()).toEqual([{ value: "1", label: "Horario A" }]);
    });

    it("does not map the default empty initial value with nested valueFrom/labelFrom paths", () => {
        mockPages([{ data: { data: [{ estado: { id: "1", nombre: "Abierto" } }] }, isLoading: false }]);

        render(<SelectByProvider name="estado_id" url="/states" valueFrom="estado.id" labelFrom="estado.nombre" />);

        expect(renderedOptions()).toEqual([{ value: "1", label: "Abierto" }]);
    });

    it("does not add a phantom null option when only the label of the initial value survives", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                initialValue={{ id: null, description: "Turno Nocturno" }}
            />,
        );

        expect(renderedOptions()).toEqual([{ value: "1", label: "Horario A" }]);
    });

    it("does not duplicate the initial value when the results return its id with another type", () => {
        mockPages([{ data: { data: [{ id: 2, description: "Horario B" }, horarioA] }, isLoading: false }]);

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                initialValue={{ id: "2", description: "Horario B" }}
            />,
        );

        expect(renderedOptions()).toEqual([
            { value: 2, label: "Horario B" },
            { value: "1", label: "Horario A" },
        ]);
    });

    it("adds the saved value when initialValue arrives after the options were loaded", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);
        const props = { name: "horario_id", url: "/schedules", labelFrom: "description" };

        const { rerender } = render(<SelectByProvider {...props} initialValue={{}} />);
        rerender(<SelectByProvider {...props} initialValue={{ id: "2", description: "Horario B" }} />);

        expect(renderedOptions()).toEqual([
            { value: "2", label: "Horario B" },
            { value: "1", label: "Horario A" },
        ]);
    });

    it("detects the initial value already in the results through valueFrom, not id", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                valueFrom="codigo"
                labelFrom="description"
                initialValue={{ id: "other-id", codigo: "A", description: "Horario A" }}
            />,
        );

        expect(renderedOptions()).toEqual([{ value: "A", label: "Horario A" }]);
    });

    it("does not mutate the query data nor the dataOptions prop", () => {
        const queryItems = [horarioA];
        mockPages([{ data: { data: queryItems }, isLoading: false }]);
        const initialValue = { id: "2", description: "Horario B" };

        render(
            <SelectByProvider name="horario_id" url="/schedules" labelFrom="description" initialValue={initialValue} />,
        );
        const dataOptions = [horarioA];
        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                initialValue={initialValue}
                dataOptions={dataOptions}
            />,
        );

        expect(queryItems).toEqual([horarioA]);
        expect(dataOptions).toEqual([horarioA]);
    });

    it("keeps the earlier pages when the infinite scroll loads the next one", () => {
        const firstPage = Array.from({ length: 2 }, (_, index) => ({ id: `p0-${index}`, nombre: `Primera ${index}` }));
        const secondPage = [{ id: "p1-0", nombre: "Segunda 0" }];
        mockPages([
            { data: { data: firstPage }, isLoading: false },
            { data: { data: secondPage }, isLoading: false },
        ]);

        render(<SelectByProvider name="flujo_id" url="/flows" queryLimit={2} />);
        act(() => {
            fireEvent.click(screen.getByTestId("select-next-page"));
        });

        expect(renderedOptions().map(({ value }) => value)).toEqual(["p0-0", "p0-1", "p1-0"]);
    });

    it("does not repeat an option when the next page returns its id with another type", () => {
        mockPages([
            {
                data: {
                    data: [
                        { id: "1", nombre: "Uno" },
                        { id: "2", nombre: "Dos" },
                    ],
                },
                isLoading: false,
            },
            {
                data: {
                    data: [
                        { id: 2, nombre: "Dos" },
                        { id: "3", nombre: "Tres" },
                    ],
                },
                isLoading: false,
            },
        ]);

        render(<SelectByProvider name="flujo_id" url="/flows" queryLimit={2} />);
        act(() => {
            fireEvent.click(screen.getByTestId("select-next-page"));
        });

        expect(renderedOptions().map(({ value }) => value)).toEqual(["1", "2", "3"]);
    });

    it("keeps the loaded options when the next page resolves to the result already shown", () => {
        const firstPage = {
            data: {
                data: [
                    { id: "1", nombre: "Uno" },
                    { id: "2", nombre: "Dos" },
                ],
            },
            isLoading: false,
        };
        mockPages([firstPage, firstPage]);

        render(<SelectByProvider name="flujo_id" url="/flows" queryLimit={2} />);
        act(() => {
            fireEvent.click(screen.getByTestId("select-next-page"));
        });

        expect(renderedOptions().map(({ value }) => value)).toEqual(["1", "2"]);
    });

    it("does not repeat the initial value when the next page is loaded", () => {
        const firstPage = [
            { id: "p0-0", nombre: "Primera 0" },
            { id: "p0-1", nombre: "Primera 1" },
        ];
        mockPages([
            { data: { data: firstPage }, isLoading: false },
            { data: { data: [{ id: "p1-0", nombre: "Segunda 0" }] }, isLoading: false },
        ]);

        render(
            <SelectByProvider
                name="flujo_id"
                url="/flows"
                queryLimit={2}
                initialValue={{ id: "selected", nombre: "Seleccionado" }}
            />,
        );
        act(() => {
            fireEvent.click(screen.getByTestId("select-next-page"));
        });

        expect(renderedOptions().map(({ value }) => value)).toEqual(["selected", "p0-0", "p0-1", "p1-0"]);
    });

    it("drops the previous saved value when initialValue changes to another one", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);
        const props = { name: "horario_id", url: "/schedules", labelFrom: "description" };

        const { rerender } = render(
            <SelectByProvider {...props} initialValue={{ id: "2", description: "Horario B" }} />,
        );
        rerender(<SelectByProvider {...props} initialValue={{ id: "3", description: "Horario C" }} />);

        expect(renderedOptions()).toEqual([
            { value: "3", label: "Horario C" },
            { value: "1", label: "Horario A" },
        ]);
    });

    it("shows the new label when only the label of the saved value changes", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);
        const props = { name: "horario_id", url: "/schedules", labelFrom: "description" };

        const { rerender } = render(
            <SelectByProvider {...props} initialValue={{ id: "2", description: "Horario B" }} />,
        );
        rerender(<SelectByProvider {...props} initialValue={{ id: "2", description: "Horario B renombrado" }} />);

        expect(renderedOptions()).toEqual([
            { value: "2", label: "Horario B renombrado" },
            { value: "1", label: "Horario A" },
        ]);
    });

    it("offers the saved value while the first page is still loading", () => {
        mockPages([]);

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                initialValue={{ id: "2", description: "Horario B" }}
            />,
        );

        expect(renderedOptions()).toEqual([{ value: "2", label: "Horario B" }]);
    });

    it("keeps the saved value on top when a later page brings it", () => {
        const firstPage = [
            { id: "p0-0", nombre: "Primera 0" },
            { id: "p0-1", nombre: "Primera 1" },
        ];
        mockPages([
            { data: { data: firstPage }, isLoading: false },
            { data: { data: [{ id: "selected", nombre: "Seleccionado" }] }, isLoading: false },
        ]);

        render(
            <SelectByProvider
                name="flujo_id"
                url="/flows"
                queryLimit={2}
                initialValue={{ id: "selected", nombre: "Seleccionado" }}
            />,
        );
        act(() => {
            fireEvent.click(screen.getByTestId("select-next-page"));
        });

        expect(renderedOptions().map(({ value }) => value)).toEqual(["selected", "p0-0", "p0-1"]);
    });

    it("keeps the saved value at its place when the first page lists it", () => {
        mockPages([
            {
                data: {
                    data: [horarioA, { id: "2", description: "Horario B" }],
                },
                isLoading: false,
            },
        ]);

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                initialValue={{ id: "2", description: "Horario B" }}
            />,
        );

        expect(renderedOptions().map(({ value }) => value)).toEqual(["1", "2"]);
    });

    it("does not add a blank option for a saved value without label", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                initialValue={{ id: "2", description: "" }}
            />,
        );

        expect(renderedOptions()).toEqual([{ value: "1", label: "Horario A" }]);
    });

    it("lets handlerOptionsTypes own the options even with a saved initialValue", () => {
        mockPages([{ data: { data: [horarioA] }, isLoading: false }]);
        const handlerOptionsTypes = vi.fn((_data, setOptions) => setOptions([{ value: "h", label: "Del handler" }]));

        render(
            <SelectByProvider
                name="horario_id"
                url="/schedules"
                labelFrom="description"
                handlerOptionsTypes={handlerOptionsTypes}
                initialValue={{ id: "2", description: "Horario B" }}
            />,
        );

        expect(handlerOptionsTypes).toHaveBeenCalledWith([horarioA], expect.any(Function), "horario_id");
        expect(renderedOptions()).toEqual([{ value: "h", label: "Del handler" }]);
    });
});
