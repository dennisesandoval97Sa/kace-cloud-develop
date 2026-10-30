import { Form, Formik } from "formik";
import { joiFormikAdapter } from "@kace/utils";
import { DialogFooter, Button } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { caseCloseSchema } from "../../../../../../schemas/CasoSchema";
import useCaseClose from "./hooks/useCaseClose";
import { CloseCaseFields } from "./CloseCaseFields";

const CloseCase = () => {
    const { t } = useTranslation();
    const { handleCaseClose, isPending } = useCaseClose();
    return (
        <Formik
            enableReinitialize={true}
            initialValues={{ motivo_baja: "" }}
            validationSchema={joiFormikAdapter(caseCloseSchema)}
            onSubmit={(values, { setErrors, setStatus }) => {
                handleCaseClose(values, setErrors, setStatus);
            }}
        >
            <Form autoComplete="off" id="form_close_case" data-testid="form_close_case">
                <CloseCaseFields />
                <DialogFooter className="sm:justify-end">
                    <Button
                        disabled={isPending}
                        type="submit"
                        id="button_submit_close_case"
                        data-testid="button_submit_close_case"
                    >
                        {t(isPending ? "button.sending" : "button.send")}
                    </Button>
                </DialogFooter>
            </Form>
        </Formik>
    );
};

export default CloseCase;
