import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { GeneralSetupForm } from "./GeneralSetupForm";

const stableData = {};

vi.mock("@kace/utils", () => ({
    joiFormikAdapter: () => undefined,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "generalSetup.form.title.channelhub": "Channel Hub",
                "generalSetup.form.title.sub_channelhub": "Configure Channel Hub integration settings",
                "generalSetup.form.labels.create_rules_channel_hub_flow_id": "Restflow to create Channel Hub rules",
                "generalSetup.form.labels.account_channel_hub_flow_id": "Restflow to create Channel Hub account",
            })[key] ?? key,
    }),
}));

vi.mock("@/routes/routes", () => ({
    routes: [{ to: "/dashboard", name: "Dashboard" }],
}));

vi.mock("@/hooks/useAuxiliariesOptions", () => ({
    default: () => ({ auxiliariesRules: [] }),
}));

vi.mock("@/hooks/useGenericSearchInfiniteQuery", () => ({
    default: () => ({
        data: [],
        isLoading: false,
        fetchNextPage: vi.fn(),
        isFetchingNextPage: false,
    }),
}));

vi.mock("@/hooks/useDebounced", () => ({
    default: (callback) => callback,
}));

vi.mock("../hooks/useOneScriptOptions", () => ({
    useOneScriptOptions: () => ({
        processOneScriptOptions: [],
        isLoadingOneScript: false,
        fetchNextOneScript: vi.fn(),
        hasNextPageOneScript: false,
        isFetchingNextPageOneScript: false,
        onSearchOneSCript: vi.fn(),
    }),
}));

vi.mock("../../../components/core/Cards/FormCard", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../../components/core/Cards/section-form", () => ({
    default: ({ children, title, subTitle }) => (
        <section>
            <h2>{title}</h2>
            {subTitle ? <p>{subTitle}</p> : null}
            {children}
        </section>
    ),
}));

vi.mock("./GeneralSetupFormComponents/CardModulesTab", () => ({
    CardModulesTab: ({ children, title, description }) => (
        <article>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
            {children}
        </article>
    ),
}));

vi.mock("./GeneralSetupFormComponents/CheckBoxContainer", () => ({
    CheckBoxContainer: ({ text }) => <span>{text}</span>,
}));

vi.mock("./GeneralSetupFormComponents/GeneralSetupTabsContainer", () => ({
    GeneralSetupTabsContainer: () => <div data-testid="general-setup-tabs" />,
}));

vi.mock("../../../components/core/switchState/SwitchStateAdmin", () => ({
    SwitchStateAdmin: () => <div data-testid="switch-state-admin" />,
}));

vi.mock("../../../components/core/SelectByUrl/SelectByUrl", () => ({
    SelectByUrl: ({ label }) => <span>{label}</span>,
}));

vi.mock("@/components/core/SelectContainer/SelectSingleSearch", () => ({
    SelectSingleSearch: ({ title }) => <span>{title}</span>,
}));

vi.mock("./GeneralSetupFormComponents/FilesSelect", () => ({
    FilesSelect: () => <div data-testid="files-select" />,
}));

vi.mock("./GeneralSetupFormComponents/WorkQueueSortingRules", () => ({
    default: () => <div data-testid="work-queue-sorting-rules" />,
}));

vi.mock("@kace_v2/shared/ui/molecules/SelectField", () => ({
    default: ({ label }) => <span>{label}</span>,
}));

vi.mock("@/componentsV2/core/MultiSelect", () => ({
    default: ({ selectedData = [], options = [], placeholder }) => (
        <div>
            {placeholder}
            {[...selectedData, ...options].map((item) => item.label ?? item.value ?? item.id).join(",")}
        </div>
    ),
}));

vi.mock("@/componentsV2/lib/SelectFromQuery", () => ({
    default: ({ label }) => <span>{label}</span>,
}));

vi.mock("@kace/ui-shared", () => ({
    KField: ({ children }) => <div>{children}</div>,
    InputForm: ({ label, name }) => (
        <label>
            {label}
            <input name={name} />
        </label>
    ),
    SelectForm: ({ label, name, options = [] }) => (
        <label>
            {label}
            <select name={name}>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    ),
}));

describe("GeneralSetupForm", () => {
    it("does not render the redundant global Channel Hub REST flow configuration", () => {
        render(
            <MemoryRouter>
                <GeneralSetupForm dataHandler={vi.fn()} data={stableData} isSending={false} />
            </MemoryRouter>,
        );

        expect(screen.queryByText("Channel Hub")).not.toBeInTheDocument();
        expect(screen.queryByText("Restflow to create Channel Hub rules")).not.toBeInTheDocument();
        expect(screen.queryByText("Restflow to create Channel Hub account")).not.toBeInTheDocument();
    });
});
