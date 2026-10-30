import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "@/locale/i18n";
import useGenericGetQuery from "@kace/hooks/useGenericGetQuery";
import AssociatedClassifications from "./AssociatedClassifications";

vi.mock("@kace/hooks/useGenericGetQuery", () => ({ default: vi.fn() }));

const ID = "11111111-1111-4111-8111-111111111111";

const queryState = (state) =>
    vi.mocked(useGenericGetQuery).mockReturnValue({ data: undefined, isLoading: false, isError: false, ...state });

describe("AssociatedClassifications", () => {
    beforeEach(() => {
        vi.mocked(useGenericGetQuery).mockReset();
    });

    it("cachea por configuración y extrae la lista de la respuesta", () => {
        queryState({ data: [] });

        render(<AssociatedClassifications configurationId={ID} />);

        const [{ keyQuery, url, select }] = vi.mocked(useGenericGetQuery).mock.calls[0];
        expect(keyQuery).toContain(ID);
        expect(url).toBe(`/folio-configurations/${ID}/classifications`);
        expect(select({ data: { data: { classifications: [{ id: "c1" }] } } })).toEqual([{ id: "c1" }]);
        expect(select({})).toEqual([]);
    });

    // Mientras carga no puede decir "ninguna clasificación la usa": no sería cierto todavía.
    it("mientras carga no muestra el estado vacío", () => {
        queryState({ isLoading: true });

        render(<AssociatedClassifications configurationId={ID} />);

        expect(screen.getByTestId("folio_classifications_loading")).toBeInTheDocument();
        expect(screen.queryByTestId("folio_classifications_empty")).not.toBeInTheDocument();
    });

    it("si la petición falla lo dice, distinto del estado vacío", () => {
        queryState({ isError: true });

        render(<AssociatedClassifications configurationId={ID} />);

        expect(screen.getByRole("alert")).toHaveTextContent(i18n.t("folioConfigurations.classifications.loadError"));
        expect(screen.queryByTestId("folio_classifications_empty")).not.toBeInTheDocument();
    });

    it("muestra el estado vacío solo cuando la respuesta llega sin clasificaciones", () => {
        queryState({ data: [] });

        render(<AssociatedClassifications configurationId={ID} />);

        expect(screen.getByTestId("folio_classifications_empty")).toBeInTheDocument();
    });

    it("lista las clasificaciones asociadas", () => {
        queryState({ data: [{ id: "c1", description: "Soporte / Facturación" }] });

        render(<AssociatedClassifications configurationId={ID} />);

        expect(screen.getByTestId("folio_classification_c1")).toHaveTextContent("Soporte / Facturación");
    });
});
