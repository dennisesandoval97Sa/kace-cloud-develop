import { Form, Formik } from "formik";
import { useTranslation } from "react-i18next";
import { KField, InputForm as Input } from "@kace/ui-shared";
import InputCard from "../../../components/core/Cards/InputCard";
import { PropTypes } from "prop-types";
import { HelpsSchemaForm } from "../../../schemas/HelpsSchema";
import { joiFormikAdapter } from "../../../utils/main";
import { DescriptionEditor } from "./DescriptionEditor";
import { SelectColor } from "../../../components/core/SelectColor/select-color";
import FormCard from "../../../components/core/Cards/FormCard";
import SectionForm from "../../../components/core/Cards/section-form";
import HelpsAttachments from "./HelpsAttachments";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";

const HelpsForm = ({
    dataHandler,
    data = {},
    isSending = false,
    isEditMode = false,
    persistedHelpId,
    pendingAttachments = [],
    onPendingAttachmentsChange = () => {},
}) => {
    const { t } = useTranslation();

    return (
        <Formik
            enableReinitialize={true}
            initialValues={data}
            validationSchema={joiFormikAdapter(HelpsSchemaForm)}
            onSubmit={(values, { setErrors, setStatus }) => {
                return dataHandler(
                    {
                        ...values,
                        ...(isEditMode && data?.help_id ? { id: data.help_id } : {}),
                    },
                    setErrors,
                    setStatus,
                );
            }}
        >
            {({ setFieldValue, initialValues, touched, errors, status }) => {
                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} isSending={isSending} title={t("app.title.helps")} status={status}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm id="help_form_title" dataTestId="help_form_title">
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="titulo"
                                                label={`${t("helps.form.title")} *`}
                                                placeholder="Titulo"
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <DescriptionEditor
                                        setValue={(name, value) => {
                                            setFieldValue(name, value);
                                        }}
                                        value={initialValues.descripcion}
                                        error={errors.descripcion}
                                        touched={touched.descripcion}
                                    />
                                </SectionForm>
                                {data.id && (
                                    <SectionForm>
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin name="is_active" tipo="boolean" />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                )}
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm>
                                    <SelectColor
                                        title={t("states.form.color")}
                                        name="color"
                                        className="flex flex-col items-start justify-start text-start gap-2"
                                    />
                                </SectionForm>
                                <SectionForm>
                                    <HelpsAttachments
                                        helpId={data?.help_id || persistedHelpId}
                                        deferredUpload={!isEditMode}
                                        pendingAttachments={pendingAttachments}
                                        onPendingAttachmentsChange={onPendingAttachmentsChange}
                                    />
                                </SectionForm>
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};

HelpsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
    isEditMode: PropTypes.bool,
    persistedHelpId: PropTypes.string,
    pendingAttachments: PropTypes.array,
    onPendingAttachmentsChange: PropTypes.func,
};

export default HelpsForm;
