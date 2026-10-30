import { Form, Formik } from "formik";
import { useTranslation } from "react-i18next";
import { joiFormikAdapter } from "@kace/utils";
import { DialogFooter, Button } from "@kace/ui-shared";
import { initialValuesReassing } from "../../../../data/Constants";
import { casoReassignSchemaForm } from "../../../../../../schemas/CasoSchema";
import { useReassignCase } from "./hooks/useReassignCase";
import { ReassignCaseFields } from "./ReassignCaseFields";

export const ReassignCase = () => {
    const { t } = useTranslation();

    const { handleReassignUser, handleReassignGroup, isPending } = useReassignCase();

    return (
        <Formik
            enableReinitialize
            initialValues={initialValuesReassing}
            validationSchema={joiFormikAdapter(casoReassignSchemaForm)}
            onSubmit={(values) => {
                if (values.tipo === "1") {
                    handleReassignGroup(values);
                } else {
                    handleReassignUser(values);
                }
            }}
        >
            {({ errors, touched, values, setFieldValue }) => (
                <Form
                    className="grid gap-4 py-4"
                    autoComplete="off"
                    id="form_reassign_case"
                    data-testid="form_reassign_case"
                >
                    <ReassignCaseFields
                        errors={errors}
                        touched={touched}
                        values={values}
                        setFieldValue={setFieldValue}
                    />
                    <DialogFooter className="sm:justify-end">
                        <Button
                            disabled={isPending}
                            type="submit"
                            id="button_submit_reassign_case"
                            data-testid="button_submit_reassign_case"
                        >
                            {t(isPending ? "button.sending" : "button.send")}
                        </Button>
                    </DialogFooter>
                </Form>
            )}
        </Formik>
    );
};
