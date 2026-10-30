/* eslint-disable react/prop-types */
import { cloneElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useField } from "formik";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MappersCreateForm from "./MappersCreateForm";

vi.mock("react-i18next", async (importOriginal) => ({
    ...(await importOriginal()),
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("@/components/ui-shared", () => {
    const Container = ({ children }) => <div>{children}</div>;

    return {
        KField: ({ children }) => {
            const [field, meta] = useField(children.props.name);
            return cloneElement(children, { field, meta });
        },
        InputFormModal: ({ label, field = {}, meta = {}, ...props }) => (
            <label>
                {label}
                <input {...field} {...props} />
                {meta.touched && meta.error ? <span>{meta.error}</span> : null}
            </label>
        ),
        FormikStatusMessages: ({ formikStatus }) =>
            formikStatus ? <div data-testid="formik-status">{String(formikStatus)}</div> : null,
        Button: ({ children, ...props }) => <button {...props}>{children}</button>,
        Dialog: ({ open, children }) => (open ? <div role="dialog">{children}</div> : null),
        DialogContent: Container,
        DialogDescription: Container,
        DialogFooter: Container,
        DialogHeader: Container,
        DialogTitle: Container,
        Label: ({ children, ...props }) => <label {...props}>{children}</label>,
    };
});

vi.mock("@/components/ui-shared/src/components/table-component/DataTableContainer", () => ({
    DataTableContainer: ({ dataTable = [], rowActions }) => (
        <div data-testid="rules-table">
            <span data-testid="rules-count">{dataTable.length}</span>
            {dataTable.map((rule, index) => (
                <div key={rule._idx ?? index}>
                    <span>{rule.target_entity}</span>
                    <button type="button" data-testid={`edit-rule-${index}`} onClick={() => rowActions?.onEdit?.(rule)}>
                        Edit
                    </button>
                    <button
                        type="button"
                        data-testid={`delete-rule-${index}`}
                        onClick={() => rowActions?.onDelete?.(rule)}
                    >
                        Delete
                    </button>
                </div>
            ))}
        </div>
    ),
}));

vi.mock("@/components/core/Cards/FormCard", () => ({
    default: ({ children }) => (
        <div>
            {children}
            <button type="submit">Submit mapper</button>
        </div>
    ),
}));

vi.mock("@/components/core/Cards/InputCard", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/components/core/Cards/section-form", () => ({
    default: ({ children, title }) => (
        <section>
            <h2>{title}</h2>
            {children}
        </section>
    ),
}));

vi.mock("@/componentsV2/core/MultiSelect", () => ({
    default: ({ clearable, id, onClearSelection, onSelectOption, placeholder, selectedData }) => (
        <div>
            <button
                id={id}
                type="button"
                data-testid="rest-flow-select"
                onClick={() => onSelectOption({ id: "flow-1", value: "flow-1", label: "Primary flow" })}
            >
                {placeholder}
            </button>
            {clearable && selectedData.length > 0 ? (
                <button type="button" onClick={onClearSelection}>
                    Clear REST flow
                </button>
            ) : null}
        </div>
    ),
}));

vi.mock("@/hooks/useDebounced", () => ({
    default: (callback) => callback,
}));

vi.mock("@/hooks/useGenericSearchInfiniteQuery", () => ({
    default: () => ({
        data: [{ id: "flow-1", value: "flow-1", label: "Primary flow" }],
        isLoading: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
    }),
}));

vi.mock("./MappersFieldActions", () => ({
    default: () => null,
}));

describe("MappersCreateForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows required name and REST flow errors and does not submit an empty mapper", async () => {
        const user = userEvent.setup();
        const dataHandler = vi.fn();

        render(<MappersCreateForm dataHandler={dataHandler} />);

        expect(screen.getByLabelText("broker.mappers.placeholder.rest_flow_id *")).toBe(
            screen.getByTestId("rest-flow-select"),
        );
        await user.click(screen.getByRole("button", { name: "Submit mapper" }));

        expect(dataHandler).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getAllByText("Required")).toHaveLength(2);
        });
    });

    it("submits a valid mapper without mapping rules", async () => {
        const user = userEvent.setup();
        const dataHandler = vi.fn();

        render(<MappersCreateForm dataHandler={dataHandler} />);

        await user.type(screen.getByRole("textbox", { name: "broker.mappers.placeholder.name *" }), "Cases mapper");
        await user.click(screen.getByTestId("rest-flow-select"));
        await user.click(screen.getByRole("button", { name: "Submit mapper" }));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: "Cases mapper",
                    rest_flow_id: "flow-1",
                    rules: [],
                }),
                expect.any(Function),
                expect.any(Function),
            );
        });
    });

    it("shows guidance for required mapper fields and complete added rules", () => {
        render(<MappersCreateForm dataHandler={vi.fn()} />);

        expect(screen.getByText("broker.mappers.requiredFieldsGuidance")).toBeInTheDocument();
    });

    it("keeps required rule markers attached without changing accessible labels", async () => {
        const user = userEvent.setup();

        render(<MappersCreateForm dataHandler={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "broker.mappers.rules.addRule" }));

        [
            "broker.mappers.rules.targetEntity",
            "broker.mappers.rules.targetField",
            "broker.mappers.rules.sourceField",
        ].forEach((label) => {
            const input = screen.getByRole("textbox", { name: `${label} *` });

            expect(input.closest("label")?.textContent).toContain(`${label}\u00a0*`);
        });
    });

    it("clears an edited REST flow and blocks submit with an inline error", async () => {
        const user = userEvent.setup();
        const dataHandler = vi.fn();

        render(
            <MappersCreateForm
                dataHandler={dataHandler}
                data={{
                    id: "991f1a99-1d75-4b7d-8bd7-379ab919bb70",
                    name: "Cases mapper",
                    rest_flow_id: "flow-1",
                    rules: [],
                }}
            />,
        );

        await user.click(await screen.findByRole("button", { name: "Clear REST flow" }));
        await user.click(screen.getByRole("button", { name: "Submit mapper" }));

        expect(dataHandler).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(screen.getByText("Required")).toBeInTheDocument();
        });
    });

    it("discards a new rule when the dialog is cancelled", async () => {
        const user = userEvent.setup();

        render(<MappersCreateForm dataHandler={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "broker.mappers.rules.addRule" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByTestId("rules-count")).toHaveTextContent("1");

        await user.click(screen.getByRole("button", { name: "broker.mappers.rules.cancel" }));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByTestId("rules-count")).toHaveTextContent("0");
    });

    it("restores an existing rule when editing is cancelled", async () => {
        const user = userEvent.setup();
        const data = {
            id: "991f1a99-1d75-4b7d-8bd7-379ab919bb70",
            name: "Cases mapper",
            queue: "",
            rest_flow_id: "flow-1",
            rules: [
                {
                    id: "8d26a147-6cb6-4534-b44e-a3b9f51a12cd",
                    target_entity: "case",
                    target_field: "title",
                    source_field: "payload.title",
                },
            ],
        };

        render(<MappersCreateForm dataHandler={vi.fn()} data={data} />);

        await user.click(screen.getByTestId("edit-rule-0"));
        const targetField = screen.getByRole("textbox", { name: "broker.mappers.rules.targetField *" });
        await user.clear(targetField);
        await user.type(targetField, "description");
        await user.click(screen.getByRole("button", { name: "broker.mappers.rules.cancel" }));

        await user.click(screen.getByTestId("edit-rule-0"));
        expect(screen.getByRole("textbox", { name: "broker.mappers.rules.targetField *" })).toHaveValue("title");
    });

    it("edits and restores the original rule while the rules table is filtered", async () => {
        const user = userEvent.setup();
        const data = {
            id: "991f1a99-1d75-4b7d-8bd7-379ab919bb70",
            name: "Cases mapper",
            queue: "",
            rest_flow_id: "flow-1",
            rules: [
                {
                    target_entity: "contact",
                    target_field: "email",
                    source_field: "payload.email",
                },
                {
                    target_entity: "case",
                    target_field: "title",
                    source_field: "payload.title",
                },
            ],
        };

        render(<MappersCreateForm dataHandler={vi.fn()} data={data} />);

        await user.type(screen.getByRole("textbox", { name: "broker.mappers.rules.filter" }), "case");
        await user.click(screen.getByTestId("edit-rule-0"));

        const targetField = screen.getByRole("textbox", { name: "broker.mappers.rules.targetField *" });
        expect(targetField).toHaveValue("title");

        await user.clear(targetField);
        await user.type(targetField, "description");
        await user.click(screen.getByRole("button", { name: "broker.mappers.rules.cancel" }));
        await user.click(screen.getByTestId("edit-rule-0"));

        expect(screen.getByRole("textbox", { name: "broker.mappers.rules.targetField *" })).toHaveValue("title");
    });

    it("deletes the original rule while the rules table is filtered", async () => {
        const user = userEvent.setup();
        const data = {
            id: "991f1a99-1d75-4b7d-8bd7-379ab919bb70",
            name: "Cases mapper",
            queue: "",
            rest_flow_id: "flow-1",
            rules: [
                {
                    target_entity: "contact",
                    target_field: "email",
                    source_field: "payload.email",
                },
                {
                    target_entity: "case",
                    target_field: "title",
                    source_field: "payload.title",
                },
            ],
        };

        render(<MappersCreateForm dataHandler={vi.fn()} data={data} />);

        const rulesFilter = screen.getByRole("textbox", { name: "broker.mappers.rules.filter" });
        await user.type(rulesFilter, "case");
        await user.click(screen.getByTestId("delete-rule-0"));
        await user.clear(rulesFilter);

        expect(screen.getByText("contact")).toBeInTheDocument();
        expect(screen.queryByText("case")).not.toBeInTheDocument();
    });

    it("keeps the dialog open when an added rule is incomplete", async () => {
        const user = userEvent.setup();

        render(<MappersCreateForm dataHandler={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "broker.mappers.rules.addRule" }));
        await user.type(screen.getByRole("textbox", { name: "broker.mappers.rules.targetEntity *" }), "case");
        await user.click(screen.getByRole("button", { name: "broker.mappers.rules.save" }));

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getAllByText("Required")).toHaveLength(2);
    });
});
