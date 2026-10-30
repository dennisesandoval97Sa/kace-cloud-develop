import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SelectByListLevels, parseClassificationValue } from "./SelectByListLevels";
import { apiService } from "@kace/utils";

vi.mock("@kace/utils", () => ({
    CLASSIFICATION_LEVELS_SERVICE: "/classifications-levels",
    apiService: {
        get: vi.fn(),
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "app.text.selectLevel": "Seleccionar nivel",
                "app.text.optionsPlaceholder": "Seleccionar opción",
                "select.options": "Opciones",
                "globalConfigLabels.clasificaciones.nivel1": "Nivel 1",
                "globalConfigLabels.clasificaciones.nivel2": "Nivel 2",
                "globalConfigLabels.clasificaciones.nivel3": "Nivel 3",
            })[key] ?? key,
    }),
}));

Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
    setPointerCapture: { configurable: true, value: () => {} },
});

const renderWithQueryClient = (ui) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("parseClassificationValue helper", () => {
    it.each([
        ["clasificaciones.nivel1/MEXICO", { level: "nivel1", classification: "MEXICO" }],
        ["nivel1/MEXICO", { level: "nivel1", classification: "MEXICO" }],
        ["clasificaciones.nivel3/null", { level: "nivel3", classification: "" }],
        ["nivel2/", { level: "nivel2", classification: "" }],
        ["clasificaciones.nivel1", { level: "nivel1", classification: "" }],
        ["nivel5", { level: "nivel5", classification: "" }],
        ["", { level: "", classification: "" }],
        [null, { level: "", classification: "" }],
        [undefined, { level: "", classification: "" }],
        [
            { field: "clasificaciones.nivel1", value: "MEXICO" },
            { level: "nivel1", classification: "MEXICO" },
        ],
        [
            { field: "clasificaciones.nivel1", value: "nivel1/TEST" },
            { level: "nivel1", classification: "TEST" },
        ],
        ["clasificaciones.nivel1/nivel1/TEST", { level: "nivel1", classification: "TEST" }],
    ])("correctly parses %j into %j", (input, expected) => {
        expect(parseClassificationValue(input)).toEqual(expected);
    });
});

describe("SelectByListLevels component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiService.get.mockResolvedValue({
            data: {
                data: {
                    items: ["MEXICO", "COLOMBIA", "CHILE"],
                },
            },
        });
    });

    it("hydrates correctly with qualified clasificaciones.nivel1/MEXICO value", async () => {
        renderWithQueryClient(<SelectByListLevels value="clasificaciones.nivel1/MEXICO" onChange={vi.fn()} />);

        // Should call API only for nivel1 (NOT clasificaciones.nivel1)
        expect(apiService.get).toHaveBeenCalledWith("/classifications-levels/nivel1", expect.anything());
        expect(apiService.get).not.toHaveBeenCalledWith(expect.stringContaining("clasificaciones."), expect.anything());

        // Level trigger should display Nivel 1
        expect(screen.getByTestId("select_list_categories")).toHaveTextContent("Nivel 1");
    });

    it("does not call API if value has no valid level", () => {
        renderWithQueryClient(<SelectByListLevels value="" onChange={vi.fn()} />);
        expect(apiService.get).not.toHaveBeenCalled();
    });

    it("updates level and options when value prop changes dynamically (preset switch)", async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        const { rerender } = render(
            <QueryClientProvider client={queryClient}>
                <SelectByListLevels value="clasificaciones.nivel1/MEXICO" onChange={vi.fn()} />
            </QueryClientProvider>,
        );

        expect(screen.getByTestId("select_list_categories")).toHaveTextContent("Nivel 1");

        apiService.get.mockResolvedValueOnce({
            data: {
                data: {
                    items: ["SOPORTE", "VENTAS"],
                },
            },
        });

        rerender(
            <QueryClientProvider client={queryClient}>
                <SelectByListLevels value="clasificaciones.nivel2/SOPORTE" onChange={vi.fn()} />
            </QueryClientProvider>,
        );

        await waitFor(() => {
            expect(apiService.get).toHaveBeenCalledWith("/classifications-levels/nivel2", expect.anything());
            expect(screen.getByTestId("select_list_categories")).toHaveTextContent("Nivel 2");
        });
    });

    it("emits level/ when selecting a new level", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithQueryClient(<SelectByListLevels value="" onChange={onChange} />);

        await user.click(screen.getByTestId("btn_select_levels"));
        await user.click(await screen.findByRole("option", { name: "Nivel 1" }));

        expect(onChange).toHaveBeenCalledWith("nivel1/");
    });
});
