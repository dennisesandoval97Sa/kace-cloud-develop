import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import GroupForm from "./GroupForm";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (k) => k, i18n: { language: "en" } }),
}));
vi.mock("../../../hooks/useConfigAgentData", () => ({
    default: () => ({ groupsConfig: {} }),
}));
vi.mock("@kace_v2/shared/hooks/useOneScript", () => ({
    default: () => ({ oneScriptRef: { current: null }, oneScriptURL: "" }),
}));
vi.mock("../../../utils/postGroupUsersToOneScript", () => ({
    postGroupUsersToOneScript: vi.fn(),
}));

vi.mock("../../../components/core/Cards/InputCard", () => ({
    default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../../components/core/Cards/section-form", () => ({
    default: ({ children }) => <div>{children}</div>,
}));
vi.mock("../../../components/core/Cards/FormCard", () => ({
    default: ({ children }) => <div>{children}</div>,
}));
/* eslint-disable react/prop-types */
vi.mock("../../../components/core/selector-admin", () => ({
    SelectorAdmin: () => <div />,
}));
vi.mock("../../../components/core/switchState/SwitchStateAdmin", () => ({
    SwitchStateAdmin: () => <div />,
}));
vi.mock("./InputIps", () => ({
    InputIps: () => <div />,
}));
vi.mock("./ListIps", () => ({
    ListIps: () => <div />,
}));
vi.mock("../../../components/core/FormOneScript/FormOneScript", () => ({
    FormOneScript: () => <div />,
}));
vi.mock("@kace/ui-shared", async () => {
    const { useField } = await vi.importActual("formik");
    return {
        InputForm: () => <input />,
        KField: ({ children }) => <div>{children}</div>,
        SelectByProvider: ({ name, initialValue }) => {
            const [field] = useField(name);
            return (
                <div
                    data-testid={`select-${name}`}
                    data-value={field.value ?? ""}
                    data-initial={JSON.stringify(initialValue)}
                />
            );
        },
    };
});

vi.mock("../../../components/core/SelectByUrl/SelectByUrl", () => ({
    SelectByUrl: () => <div />,
}));

vi.mock("../../../components/core/multiselector/MultiSelectUsers", () => ({
    MultiSelectUsers: ({ listValues = [], values = [] }) => (
        <div
            data-testid="multi-select-users"
            data-list-values={JSON.stringify(listValues)}
            data-values={JSON.stringify(values)}
        >
            {listValues.map((v) => (
                <span key={v.id} data-testid={`chip-${v.id}`}>
                    {v.label}
                </span>
            ))}
        </div>
    ),
}));

const makeRelatedUsers = (users) => ({
    users: users.map((u) => ({ usuario_id: u.id, nombre: u.label })),
    count: users.length,
});

const dataUsersFor = (users) => ({
    users: users.map((u) => ({ id: u.id, label: u.label, value: u.label })),
    count: users.length,
});

const baseProps = (overrides = {}) => ({
    dataHandler: vi.fn(),
    relatedUsers: makeRelatedUsers([]),
    data: {},
    isSending: false,
    dataUsers: dataUsersFor([]),
    ...overrides,
});

describe("GroupForm — listValues sync with relatedUsers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("clears listValues when relatedUsers becomes empty after being populated (re-mount with fresh data)", async () => {
        const initialUsers = [
            { id: "u1", label: "Felipe" },
            { id: "u2", label: "Andres" },
        ];

        const { rerender } = render(
            <GroupForm
                {...baseProps({
                    relatedUsers: makeRelatedUsers(initialUsers),
                    dataUsers: dataUsersFor(initialUsers),
                })}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId("chip-u1")).toBeInTheDocument();
            expect(screen.getByTestId("chip-u2")).toBeInTheDocument();
        });

        rerender(
            <GroupForm
                {...baseProps({
                    relatedUsers: makeRelatedUsers([]),
                    dataUsers: dataUsersFor([]),
                })}
            />,
        );

        await waitFor(() => {
            expect(screen.queryByTestId("chip-u1")).not.toBeInTheDocument();
            expect(screen.queryByTestId("chip-u2")).not.toBeInTheDocument();
        });
    });
});

describe("GroupForm — horario_id from loaded group", () => {
    const GROUP_ID = "10000000-0000-4000-8000-000000000001";
    const SCHEDULE_ID = "30000000-0000-4000-8000-000000000001";

    const renderWithGroup = (group) =>
        render(<GroupForm {...baseProps({ data: { id: GROUP_ID, nombre: "Soporte", ...group } })} />);

    const initialValueOf = (select) => JSON.parse(select.dataset.initial);

    it("leaves horario_id empty when the API reports the saved schedule as unavailable (horario_id null)", async () => {
        renderWithGroup({ horario_id: null, horario_description: "" });

        await waitFor(() => {
            const select = screen.getByTestId("select-horario_id");
            expect(select.dataset.value).toBe("");
            expect(initialValueOf(select)).toEqual({ id: null, description: "" });
        });
    });

    it("keeps horario_id when the saved schedule still exists", async () => {
        renderWithGroup({ horario_id: SCHEDULE_ID, horario_description: "Horario A" });

        await waitFor(() => {
            const select = screen.getByTestId("select-horario_id");
            expect(select.dataset.value).toBe(SCHEDULE_ID);
            expect(initialValueOf(select)).toEqual({ id: SCHEDULE_ID, description: "Horario A" });
        });
    });
});
