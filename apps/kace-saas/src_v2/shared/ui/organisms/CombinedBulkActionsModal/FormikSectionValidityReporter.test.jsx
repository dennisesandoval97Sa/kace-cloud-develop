import { render, waitFor } from "@testing-library/react";
import { Formik } from "formik";
import { describe, expect, it, vi } from "vitest";
import FormikSectionValidityReporter from "./FormikSectionValidityReporter";

describe("FormikSectionValidityReporter", () => {
    it("reports invalid when the section is intended and Formik has errors", async () => {
        const onInvalidChange = vi.fn();

        render(
            <Formik
                initialValues={{ motivo_baja: "" }}
                initialErrors={{ motivo_baja: "Invalid characters" }}
                onSubmit={() => {}}
            >
                <FormikSectionValidityReporter
                    sectionKey="close"
                    isIntended={() => true}
                    onInvalidChange={onInvalidChange}
                />
            </Formik>,
        );

        await waitFor(() => expect(onInvalidChange).toHaveBeenCalledWith("close", true));
    });

    it("does not treat empty optional sections as invalid", async () => {
        const onInvalidChange = vi.fn();

        render(
            <Formik
                initialValues={{ transicion_id: "" }}
                initialErrors={{ transicion_id: "Required" }}
                onSubmit={() => {}}
            >
                <FormikSectionValidityReporter
                    sectionKey="change_state"
                    isIntended={(values) => Boolean(values.transicion_id)}
                    onInvalidChange={onInvalidChange}
                />
            </Formik>,
        );

        await waitFor(() => expect(onInvalidChange).toHaveBeenCalledWith("change_state", false));
    });

    it("uses the schema against current values so stale Formik errors do not stick", async () => {
        const onInvalidChange = vi.fn();
        const schema = { validate: vi.fn(() => ({ error: undefined })) };

        render(
            <Formik
                initialValues={{ tipo: "1", usuario_id: "", grupo_id: "22222222-2222-4222-8222-222222222222" }}
                initialErrors={{ grupo_id: "stale" }}
                onSubmit={() => {}}
            >
                <FormikSectionValidityReporter
                    sectionKey="reassign"
                    schema={schema}
                    isIntended={(values) => Boolean(values.tipo)}
                    onInvalidChange={onInvalidChange}
                />
            </Formik>,
        );

        await waitFor(() => expect(onInvalidChange).toHaveBeenCalledWith("reassign", false));
        expect(schema.validate).toHaveBeenCalled();
    });
});
