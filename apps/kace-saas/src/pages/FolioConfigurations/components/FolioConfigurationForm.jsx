import { Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { joiFormikAdapter } from "@kace/utils";
import {
    InputForm as Input,
    KField,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@kace/ui-shared";
import FormCard from "../../../components/core/Cards/FormCard";
import SectionForm from "../../../components/core/Cards/section-form";
import InputCard from "../../../components/core/Cards/InputCard";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { FolioConfigurationSchemaForm } from "../../../schemas/FolioConfigurationSchema";
import { INITIAL_VALUES_FOLIO_CONFIGURATION, OVERFLOW_POLICIES, RESET_POLICIES } from "../data/constants";
import SegmentBuilder from "./SegmentBuilder";
import FolioPreview from "./FolioPreview";
import AssociatedClassifications from "./AssociatedClassifications";
import { getSegmentsProblem } from "../utils/segments";

export const FolioConfigurationForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();
    const [formValues, setFormValues] = useState(INITIAL_VALUES_FOLIO_CONFIGURATION);
    const [segments, setSegments] = useState(INITIAL_VALUES_FOLIO_CONFIGURATION.segments);

    useEffect(() => {
        if (data && data.nombre !== undefined) {
            setSegments(data.segments ?? INITIAL_VALUES_FOLIO_CONFIGURATION.segments);
            setFormValues({ ...INITIAL_VALUES_FOLIO_CONFIGURATION, ...data });
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(FolioConfigurationSchemaForm)}
            onSubmit={(values, { setErrors, setStatus }) => {
                // Same rule the preview uses, so the user finds out here instead of after a failed save.
                const problem = getSegmentsProblem(segments);
                if (problem) {
                    toast.warning(t(problem));
                    return;
                }
                dataHandler({ ...values, segments }, setErrors, setStatus);
            }}
        >
            {({ values, setFieldValue, status }) => (
                <Form className="flex w-full justify-center h-full overflow-auto" autoComplete="off">
                    <FormCard
                        isId={data?.id}
                        isSending={isSending}
                        title={t("navbar.folioConfigurations")}
                        status={status}
                    >
                        <div className="flex flex-col col-span-3 gap-8 h-full">
                            <SectionForm title={t("folioConfigurations.form.information")}>
                                <InputCard>
                                    <KField>
                                        <Input
                                            type="text"
                                            name="nombre"
                                            label={t("folioConfigurations.form.nombre")}
                                            placeholder={t("folioConfigurations.form.nombrePlaceholder")}
                                            className="flex flex-col items-start justify-start text-start mx-2 mb-2"
                                        />
                                    </KField>
                                    <KField>
                                        <Input
                                            type="text"
                                            name="descripcion"
                                            label={t("folioConfigurations.form.descripcion")}
                                            className="flex flex-col items-start justify-start text-start mx-2 mb-2"
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>

                        <div className="flex flex-col col-span-2 gap-8 h-full">
                            <SectionForm title={t("folioConfigurations.form.counter")}>
                                <InputCard>
                                    <KField>
                                        <Input
                                            type="number"
                                            name="start_value"
                                            min={0}
                                            label={t("folioConfigurations.form.startValue")}
                                            className="flex flex-col items-start justify-start text-start mx-2 mb-2"
                                            onChange={(e) => setFieldValue("start_value", Number(e.target.value))}
                                        />
                                    </KField>
                                    <div className="flex flex-col gap-2 mx-2 mb-2">
                                        <label className="text-xs text-muted-foreground">
                                            {t("folioConfigurations.form.resetPolicy")}
                                        </label>
                                        <Select
                                            value={values.reset_policy}
                                            onValueChange={(v) => setFieldValue("reset_policy", v)}
                                        >
                                            <SelectTrigger data-testid="folio_reset_policy">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {RESET_POLICIES.map((policy) => (
                                                    <SelectItem key={policy} value={policy}>
                                                        {t(`folioConfigurations.resetPolicies.${policy}`)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-2 mx-2 mb-2">
                                        <label className="text-xs text-muted-foreground">
                                            {t("folioConfigurations.form.overflowPolicy")}
                                        </label>
                                        <Select
                                            value={values.overflow_policy}
                                            onValueChange={(v) => setFieldValue("overflow_policy", v)}
                                        >
                                            <SelectTrigger data-testid="folio_overflow_policy">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {OVERFLOW_POLICIES.map((policy) => (
                                                    <SelectItem key={policy} value={policy}>
                                                        {t(`folioConfigurations.overflowPolicies.${policy}`)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </InputCard>
                            </SectionForm>
                        </div>

                        {data?.id && (
                            <div className="flex flex-col col-span-1 gap-8 h-full">
                                <SectionForm title={t("app.forms.status")}>
                                    <InputCard>
                                        <KField>
                                            <SwitchStateAdmin name="status" />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                            </div>
                        )}

                        <div className="flex flex-col col-span-5 gap-4">
                            <SectionForm title={t("folioConfigurations.form.segments")}>
                                <SegmentBuilder segments={segments} onChange={setSegments} />
                            </SectionForm>

                            <FolioPreview
                                configurationId={data?.id}
                                segments={segments}
                                resetPolicy={values.reset_policy}
                                startValue={Number(values.start_value)}
                                overflowPolicy={values.overflow_policy}
                            />
                        </div>

                        {data?.id && (
                            <div className="flex flex-col col-span-5">
                                <SectionForm title={t("folioConfigurations.form.classifications")}>
                                    <AssociatedClassifications configurationId={data.id} />
                                </SectionForm>
                            </div>
                        )}
                    </FormCard>
                </Form>
            )}
        </Formik>
    );
};

FolioConfigurationForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
