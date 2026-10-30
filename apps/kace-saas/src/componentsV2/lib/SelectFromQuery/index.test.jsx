import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SelectFromQuery from "./index";

const TRANSLATIONS = {
    "app.text.noResults": "No results available",
    "app.text.noSearchResults": "No matches found",
};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => TRANSLATIONS[key] ?? key }),
}));

vi.mock("@/hooks/useOptionsList", () => ({
    default: vi.fn(() => ({
        options: [],
        isLoading: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        onSearch: vi.fn(),
    })),
}));

const selectFieldProps = vi.fn();

vi.mock("@kace_v2/shared/ui/molecules/SelectField", () => ({
    default: (props) => {
        selectFieldProps(props);
        return null;
    },
}));

const renderSelect = (props = {}) => render(<SelectFromQuery url="groups/search" {...props} />);

const lastProps = () => selectFieldProps.mock.calls.at(-1)[0];

describe("SelectFromQuery empty-list messages", () => {
    beforeEach(() => {
        selectFieldProps.mockClear();
    });

    it("falls back to the generic translations when the consumer omits the props", () => {
        renderSelect();

        expect(lastProps().noResultsMessage).toBe("No results available");
        expect(lastProps().noSearchResultsMessage).toBe("No matches found");
    });

    it("lets explicit consumer messages win over the defaults", () => {
        renderSelect({
            noResultsMessage: "No hay grupos disponibles",
            noSearchResultsMessage: "No se encontraron grupos",
        });

        expect(lastProps().noResultsMessage).toBe("No hay grupos disponibles");
        expect(lastProps().noSearchResultsMessage).toBe("No se encontraron grupos");
    });

    it("keeps an explicit empty string so a consumer can suppress the message", () => {
        renderSelect({ noResultsMessage: "", noSearchResultsMessage: "" });

        expect(lastProps().noResultsMessage).toBe("");
        expect(lastProps().noSearchResultsMessage).toBe("");
    });
});
