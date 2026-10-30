/* eslint-disable react/prop-types */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClassificationsForm from "./ClassificationsForm";

vi.mock("@kace/utils", () => ({
    joiFormikAdapter: () => undefined,
    FOLIO_CONFIGURATIONS_SERVICE: "/folio-configurations",
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => ({ cases: { case_enable_subcases: false } }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const selectByProviderCalls = [];

vi.mock("@kace/ui-shared", () => ({
    InputForm: () => null,
    KField: ({ children }) => children,
    SelectByProvider: (props) => {
        selectByProviderCalls.push(props);
        return <div data-testid={`sbp-${props.name}`} />;
    },
}));

vi.mock("../../../components/core/Cards/FormCard", () => ({
    default: ({ children }) => (
        <div>
            {children}
            <button type="submit">Update</button>
        </div>
    ),
}));

vi.mock("../../../components/core/Cards/InputCard", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../../components/core/Cards/section-form", () => ({
    default: ({ children }) => <section>{children}</section>,
}));

vi.mock("./InputLevels", () => ({
    InputLevels: () => null,
}));

vi.mock("./ListLevels", () => ({
    ListLevels: ({ errors, listLevels, setFieldValues, values }) => (
        <>
            <div data-testid="classification-levels">{JSON.stringify(listLevels)}</div>
            <div data-testid="classification-level-errors">{JSON.stringify(errors)}</div>
            <div data-testid="classification-level-one">{values.nivel1}</div>
            <button type="button" onClick={() => setFieldValues("nivel1", "Local edit")}>
                Edit level locally
            </button>
        </>
    ),
}));

vi.mock("./MultiSelectTemplate", () => ({
    MultiSelectTemplate: ({ listValues, setListValues }) => (
        <>
            <div data-testid="selected-templates">{JSON.stringify(listValues)}</div>
            <button type="button" onClick={() => setListValues([])}>
                Deselect templates
            </button>
        </>
    ),
}));

vi.mock("../../../components/core/switchState/SwitchStateAdmin", () => ({
    SwitchStateAdmin: () => null,
}));

const CLASSIFICATION = {
    id: "11111111-1111-4111-8111-111111111111",
    nivel1: "Test1",
    flujo_id: "22222222-2222-4222-8222-222222222222",
    ans_id: "33333333-3333-4333-8333-333333333333",
};

describe("ClassificationsForm hydration", () => {
    it("shows each persisted level once when the same classification data is delivered again", async () => {
        const { rerender } = render(
            <ClassificationsForm
                dataHandler={vi.fn()}
                data={{ ...CLASSIFICATION }}
                dataTemplates={[]}
                templateSeed={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId("classification-levels")).toHaveTextContent('["Test1"]');
        });

        rerender(
            <ClassificationsForm
                dataHandler={vi.fn()}
                data={{ ...CLASSIFICATION }}
                dataTemplates={[]}
                templateSeed={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId("classification-levels")).toHaveTextContent('["Test1"]');
        });
    });

    it("blocks update and identifies persisted levels with the same normalized name", async () => {
        const dataHandler = vi.fn();
        render(
            <ClassificationsForm
                dataHandler={dataHandler}
                data={{ ...CLASSIFICATION, nivel2: " test1 " }}
                dataTemplates={[]}
                templateSeed={[]}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Update" }));

        await waitFor(() => {
            expect(dataHandler).not.toHaveBeenCalled();
            expect(screen.getByTestId("classification-level-errors")).toHaveTextContent(
                "classification.form.alerts.sameName",
            );
        });
    });

    it("preserves an unsaved level edit when the same classification rerenders with refreshed data", async () => {
        const props = {
            dataHandler: vi.fn(),
            dataTemplates: [],
            templateSeed: [],
        };
        const { rerender } = render(<ClassificationsForm {...props} data={{ ...CLASSIFICATION }} />);

        fireEvent.click(screen.getByRole("button", { name: "Edit level locally" }));
        await waitFor(() => {
            expect(screen.getByTestId("classification-level-one")).toHaveTextContent("Local edit");
        });

        rerender(<ClassificationsForm {...props} data={{ ...CLASSIFICATION, nivel1: "Refetched server value" }} />);

        expect(screen.getByTestId("classification-level-one")).toHaveTextContent("Local edit");
    });

    it("trims level names before submitting without changing their capitalization", async () => {
        const dataHandler = vi.fn();
        render(
            <ClassificationsForm
                dataHandler={dataHandler}
                data={{ ...CLASSIFICATION, nivel1: " Test Level " }}
                dataTemplates={[]}
                templateSeed={[]}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Update" }));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(expect.objectContaining({ nivel1: "Test Level" }), []);
        });
    });

    it("does not show a chip for persisted template IDs absent from templateSeed", async () => {
        const ORPHAN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
        render(
            <ClassificationsForm
                dataHandler={vi.fn()}
                data={{ ...CLASSIFICATION }}
                dataTemplates={[ORPHAN_ID]}
                templateSeed={[]}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId("selected-templates")).toHaveTextContent("[]");
            expect(screen.getByTestId("selected-templates")).not.toHaveTextContent(ORPHAN_ID);
        });
    });

    it("enables search, infinite scroll, and alphabetical order on flow, ans, group and folio selects", async () => {
        selectByProviderCalls.length = 0;
        render(
            <ClassificationsForm
                dataHandler={vi.fn()}
                data={{ ...CLASSIFICATION, default_group_id: "44444444-4444-4444-8444-444444444444" }}
                dataTemplates={[]}
                templateSeed={[]}
            />,
        );

        await waitFor(() => {
            expect([...new Set(selectByProviderCalls.map((c) => c.name))].sort()).toEqual([
                "ans_id",
                "default_group_id",
                "flujo_id",
                "folio_config_id",
            ]);
        });

        const latestByName = selectByProviderCalls.reduce((acc, call) => {
            acc[call.name] = call;
            return acc;
        }, {});

        for (const call of Object.values(latestByName)) {
            expect(call.enableSearch).toBe(true);
            expect(call.enableInfiniteScroll).toBe(true);
            expect(call.enableAlphabeticalOrder).toBe(true);
            expect(call.clearable).toBe(true);
        }
    });

    it("does not restore a deselected template when the same edit form rerenders", async () => {
        const TEMPLATE_A = {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            descripcion: "Template A",
        };
        const props = {
            dataHandler: vi.fn(),
            data: { ...CLASSIFICATION },
            dataTemplates: [TEMPLATE_A.id],
            templateSeed: [TEMPLATE_A],
        };
        const { rerender } = render(<ClassificationsForm {...props} />);

        await waitFor(() => {
            expect(screen.getByTestId("selected-templates")).toHaveTextContent("Template A");
        });
        fireEvent.click(screen.getByRole("button", { name: "Deselect templates" }));
        await waitFor(() => {
            expect(screen.getByTestId("selected-templates")).toHaveTextContent("[]");
        });

        rerender(<ClassificationsForm {...props} />);

        await waitFor(() => {
            expect(screen.getByTestId("selected-templates")).toHaveTextContent("[]");
        });
    });
});
