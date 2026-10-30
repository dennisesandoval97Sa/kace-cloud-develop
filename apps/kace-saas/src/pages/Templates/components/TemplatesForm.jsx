import { InputForm as Input, KField, SelectForm as Select } from "@kace/ui-shared";
import { joiFormikAdapter } from "@kace/utils";
import { Form, Formik } from "formik";
import { PropTypes } from "prop-types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import SectionForm from "../../../components/core/Cards/section-form";
import { RichEditor } from "../../../components/core/Editor/Editor";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { TemplatesCreateSchema } from "../../../schemas/TemplateSchema";
import TemplateAttachments from "./TemplateAttachments";
import { DropdownMenuModel } from "@/components/core/Editor/Dropdown/DropdownMenuModel";
import TemplateRecipientInput from "./TemplateRecipientInput";
import useTemplateAttachments from "../hooks/useTemplateAttachments";

const BOOLEAN_TEMPLATE_FIELDS = ["incluye_adjuntos", "enviar_adjuntos_del_caso"];

const normalizeBooleanTemplateValue = (value) => {
    if (value === "" || value === null || value === undefined) return false;
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
};

const TemplatesForm = ({
    dataHandler,
    data = {},
    isSending = false,
    pendingFiles = [],
    onPendingFilesChange = () => {},
    onPendingFilesProcessingChange = () => {},
}) => {
    const { t } = useTranslation();
    const { saveAttachmentsTemplate } = useTemplateAttachments();
    const [templateData, setTemplateData] = useState(data);

    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                setTemplateData((state) => ({
                    ...state,
                    [key]: BOOLEAN_TEMPLATE_FIELDS.includes(key) ? normalizeBooleanTemplateValue(value) : value || "",
                }));
            });
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={templateData}
            validationSchema={joiFormikAdapter(TemplatesCreateSchema)}
            onSubmit={(values, { setErrors, setStatus }) => {
                dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ values, setFieldValue, initialValues }) => {
                /*
                 * templateId is undefined while creating (no id yet, generated
                 * server-side) — the Toolbar falls back to a local object-URL preview
                 * for that case and TemplatesUpdateHandler resolves it into a real
                 * attachment once the template is created.
                 */
                const imageUpload = {
                    templateId: data?.id,
                    keyService: "template",
                    saveAttachment: saveAttachmentsTemplate,
                };

                return (
                    <Form className="flex w-full justify-center" autoComplete="off" validateOnMount={false}>
                        <FormCard isId={data?.id} title={t("app.title.templates")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm title={t("template.form.title.informacion")}>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="descripcion"
                                                label={t("template.form.labels.descripcion")}
                                                placeholder={t("template.form.labels.descripcion")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Select
                                                name="tipo"
                                                label={t("template.form.labels.tipo")}
                                                options={[
                                                    {
                                                        value: "1",
                                                        label: "Email",
                                                    },
                                                ]}
                                                id={`template_form_opt_type_email`}
                                                data-testid="template_form_opt_type_email"
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>

                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="asunto"
                                                label={t("template.form.labels.asunto")}
                                                placeholder={t("template.form.labels.asunto")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard className="flex flex-row items-center gap-2">
                                        <DropdownMenuModel
                                            handleSelectChange={(value) => {
                                                setFieldValue("asunto", `${values.asunto}{{${value}}}`);
                                            }}
                                        />
                                    </InputCard>
                                </SectionForm>

                                <SectionForm
                                    title={t("template.form.title.cuerpo")}
                                    subTitle={t("template.form.hints.cuerpo_allowed_tags")}
                                    subTitleLabel={t("template.form.hints.cuerpo_allowed_tags_label")}
                                    subTitleAsTooltip
                                >
                                    <InputCard className="min-h-80">
                                        <KField>
                                            <RichEditor
                                                value={initialValues.cuerpo}
                                                setValue={setFieldValue}
                                                name="cuerpo"
                                                showFields
                                                imageUpload={imageUpload}
                                                allowHtmlSource
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm title={t("template.form.title.destinatarios")}>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="destinatario"
                                                label={t("template.form.labels.destinatario")}
                                                placeholder={t("template.form.labels.destinatario")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <TemplateRecipientInput name="campo_destino" targetName="destinatario" />
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="copia"
                                                label={t("template.form.labels.copia")}
                                                placeholder={t("template.form.labels.copia")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <TemplateRecipientInput name="campo_copia" targetName="copia" />
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="copia_oculta"
                                                label={t("template.form.labels.copia_oculta")}
                                                placeholder={t("template.form.labels.copia_oculta")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <TemplateRecipientInput name="campo_copia_oculta" targetName="copia_oculta" />
                                </SectionForm>
                                <SectionForm
                                    title={t("template.form.title.adjunto")}
                                    subTitle={t("template.form.hints.adjunto_valid_filename")}
                                    subTitleLabel={t("template.form.hints.adjunto_valid_filename_label")}
                                    subTitleAsTooltip
                                >
                                    <InputCard full>
                                        <SwitchStateAdmin
                                            name="incluye_adjuntos"
                                            title={t("template.form.labels.incluye_adjuntos")}
                                            tipo="boolean"
                                        />
                                    </InputCard>
                                    <InputCard full>
                                        <SwitchStateAdmin
                                            name="enviar_adjuntos_del_caso"
                                            title={t("template.form.labels.enviar_adjuntos_del_caso")}
                                            tipo="boolean"
                                        />
                                    </InputCard>
                                    <InputCard>
                                        <TemplateAttachments
                                            templateId={data?.id}
                                            isActive={
                                                values.incluye_adjuntos === true || values.incluye_adjuntos === "true"
                                            }
                                            pendingFiles={pendingFiles}
                                            onPendingFilesChange={onPendingFilesChange}
                                            onPendingFilesProcessingChange={onPendingFilesProcessingChange}
                                            saveAttachmentsTemplate={saveAttachmentsTemplate}
                                        />
                                    </InputCard>
                                </SectionForm>
                                {data.id && (
                                    <SectionForm>
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin name="status" />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                )}
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};
TemplatesForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    attachments: PropTypes.array,
    deleteAttachment: PropTypes.func,
    getAttachment: PropTypes.func,
    isSending: PropTypes.bool,
    pendingFiles: PropTypes.array,
    onPendingFilesChange: PropTypes.func,
    onPendingFilesProcessingChange: PropTypes.func,
};

export default TemplatesForm;
