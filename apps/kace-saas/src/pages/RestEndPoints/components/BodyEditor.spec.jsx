import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BodyEditor } from "./BodyEditor";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) => {
            const value =
                {
                    "restEndPoint.bodyType.json": "JSON",
                    "restEndPoint.bodyType.contextReference": "Context reference",
                    "restEndPoint.bodyType.contextReferenceLabel": "{{label}} context reference",
                    "restEndPoint.bodyType.contextReferencePlaceholder": "context.some.path",
                    "restEndPoint.bodyType.plainText": "Plain text",
                    "restEndPoint.bodyType.plainTextPlaceholder": "Enter plain text body...",
                    "restEndPoint.label.body": "Body",
                    "jsonEditor.editor": "Editor",
                    "jsonEditor.raw": "JSON Raw",
                    "jsonEditor.undo": "Undo",
                    "jsonEditor.redo": "Redo",
                    "jsonEditor.copy": "Copy",
                    "jsonEditor.jsonEmpty": "JSON Empty",
                    "jsonEditor.addProperty": "Add property",
                }[key] ?? key;

            return value.replace("{{label}}", options?.label ?? "");
        },
    }),
}));

const setupStatefulBodyEditor = ({ initialBodyValue = "{}", initialBodyType = "json" } = {}) => {
    const setFieldValue = vi.fn();

    function Harness() {
        const [values, setValues] = useState({
            body: initialBodyValue,
            body_type: initialBodyType,
        });

        const handleSetFieldValue = (field, value) => {
            setFieldValue(field, value);
            setValues((currentValues) => ({
                ...currentValues,
                [field]: value,
            }));
        };

        return (
            <>
                <BodyEditor
                    bodyValue={values.body}
                    bodyType={values.body_type}
                    setFieldValue={handleSetFieldValue}
                    label="Body"
                />
                <output data-testid="body-value">{values.body}</output>
                <output data-testid="body-type">{values.body_type}</output>
            </>
        );
    }

    render(<Harness />);

    return { setFieldValue };
};

const setupReinitializingBodyEditor = () => {
    function Harness() {
        const [values, setValues] = useState({
            body: "context.foo",
            body_type: "json",
        });

        const handleSetFieldValue = (field, value) => {
            setValues((currentValues) => ({
                ...currentValues,
                [field]: value,
            }));
        };

        return (
            <>
                <button
                    type="button"
                    onClick={() =>
                        setValues({
                            body: '{"ruleName":"support"}',
                            body_type: "json",
                        })
                    }
                >
                    Load regular JSON endpoint
                </button>
                <BodyEditor
                    bodyValue={values.body}
                    bodyType={values.body_type}
                    setFieldValue={handleSetFieldValue}
                    label="Body"
                />
            </>
        );
    }

    render(<Harness />);
};

describe("BodyEditor", () => {
    it("shows a JSON body context reference instead of JSON Empty", () => {
        render(
            <BodyEditor
                bodyValue="context.channel_hub_tag_request"
                bodyType="json"
                setFieldValue={vi.fn()}
                label="Body"
            />,
        );

        expect(screen.getByRole("button", { name: "Context reference" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Context reference" })).toHaveClass("bg-primary");
        const contextReferenceInput = screen.getByLabelText("Body context reference");
        expect(contextReferenceInput).toHaveValue("context.channel_hub_tag_request");
        expect(contextReferenceInput).toHaveAttribute("name", "body_context_reference");
        expect(contextReferenceInput).toHaveAttribute("autocomplete", "off");
        expect(contextReferenceInput).toHaveAttribute("spellcheck", "false");
        expect(screen.queryByText("JSON Empty")).not.toBeInTheDocument();
    });

    it("keeps context reference mode after selecting it from JSON while the path is partial", async () => {
        const user = userEvent.setup();
        const { setFieldValue } = setupStatefulBodyEditor({ initialBodyValue: '{"ruleName":"support"}' });

        await user.click(screen.getByRole("button", { name: "Context reference" }));

        const contextReferenceButton = screen.getByRole("button", { name: "Context reference" });
        expect(contextReferenceButton).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "JSON" })).toHaveAttribute("aria-pressed", "false");
        expect(screen.getByLabelText("Body context reference")).toHaveValue("context.");
        expect(screen.getByTestId("body-type")).toHaveTextContent("json");
        expect(screen.getByTestId("body-value")).toHaveTextContent("context.");
        expect(screen.queryByRole("tab", { name: "JSON Raw" })).not.toBeInTheDocument();
        expect(setFieldValue).toHaveBeenCalledWith("body_type", "json");
        expect(setFieldValue).toHaveBeenCalledWith("body", "context.");
    });

    it("keeps context reference mode while clearing and editing an existing context path", async () => {
        const user = userEvent.setup();
        setupStatefulBodyEditor({ initialBodyValue: "context.channel_hub_tag" });

        const input = screen.getByLabelText("Body context reference");
        await user.clear(input);

        expect(screen.getByRole("button", { name: "Context reference" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText("Body context reference")).toHaveValue("");
        expect(screen.queryByRole("tab", { name: "JSON Raw" })).not.toBeInTheDocument();

        await user.type(screen.getByLabelText("Body context reference"), "context.");

        expect(screen.getByRole("button", { name: "Context reference" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText("Body context reference")).toHaveValue("context.");
        expect(screen.getByTestId("body-type")).toHaveTextContent("json");
        expect(screen.getByTestId("body-value")).toHaveTextContent("context.");
    });

    it("resets to JSON mode when external props switch from context reference to regular JSON", async () => {
        const user = userEvent.setup();
        setupReinitializingBodyEditor();

        expect(screen.getByRole("button", { name: "Context reference" })).toHaveAttribute("aria-pressed", "true");

        await user.click(screen.getByRole("button", { name: "Load regular JSON endpoint" }));

        expect(screen.getByRole("button", { name: "JSON" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("tab", { name: "JSON Raw" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Body context reference")).not.toBeInTheDocument();
    });

    it("updates Formik body value when editing the context reference", async () => {
        const setFieldValue = vi.fn();
        const user = userEvent.setup();

        render(
            <BodyEditor
                bodyValue="context.channel_hub_tag"
                bodyType="json"
                setFieldValue={setFieldValue}
                label="Body"
            />,
        );

        const input = screen.getByLabelText("Body context reference");
        await user.clear(input);
        await user.type(input, "context.channel_hub_tag_request");

        expect(setFieldValue).toHaveBeenLastCalledWith("body", "context.channel_hub_tag_request");
    });

    it("keeps plain text and regular JSON bodies in their modes", () => {
        const { unmount } = render(
            <BodyEditor bodyValue="plain text body" bodyType="plain_text" setFieldValue={vi.fn()} label="Body" />,
        );

        expect(screen.getByRole("button", { name: "Plain text" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByDisplayValue("plain text body")).toBeInTheDocument();

        unmount();

        render(<BodyEditor bodyValue='{"ruleName":"support"}' bodyType="json" setFieldValue={vi.fn()} label="Body" />);

        expect(screen.getByRole("button", { name: "JSON" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("tab", { name: "JSON Raw" })).toBeInTheDocument();
        expect(screen.queryByLabelText("Body context reference")).not.toBeInTheDocument();
    });

    it("switches from context reference to JSON object mode", async () => {
        const setFieldValue = vi.fn();
        const user = userEvent.setup();

        render(
            <BodyEditor
                bodyValue="context.channel_hub_tag_request"
                bodyType="json"
                setFieldValue={setFieldValue}
                label="Body"
            />,
        );

        await user.click(screen.getByRole("button", { name: "JSON" }));

        expect(setFieldValue).toHaveBeenCalledWith("body_type", "json");
        expect(setFieldValue).toHaveBeenCalledWith("body", "{}");
    });
});
