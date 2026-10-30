import { PropTypes } from "prop-types";
import { Formik, Form, getIn } from "formik";
import { useEffect, useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import { GenerateCsvCreateSchemaForm } from "../../../schemas/GenerateCsvSchema";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import SectionForm from "../../../components/core/Cards/section-form";
import {
    KField,
    InputForm as Input,
    TextAreaForm as Textarea,
    FormikStatusMessages,
    SelectForm as Select,
    DatePicker,
} from "@kace/ui-shared";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { useTranslation } from "react-i18next";
import { SelectorAdmin } from "../../../components/core/selector-admin";

const GenerateCsvForm = ({ dataHandler, data = {}, isSending = false }) => {
    const [formData, setFormData] = useState(data);
    const [views, setViews] = useState([]);

    const { t } = useTranslation();

    useEffect(() => {
        if (data?.next_execution_at) {
            const date = new Date(data.next_execution_at);
            const hours = String(date.getUTCHours() - 5).padStart(2, "0");
            const minutes = String(date.getUTCMinutes()).padStart(2, "0");
            data.start_time = `${hours}:${minutes}`;
        }
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                setFormData((state) => ({
                    ...state,
                    [key]: value || "",
                }));
            });
            setViews(data?.views || []);
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(GenerateCsvCreateSchemaForm)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ values, setFieldValue, errors, touched, status }) => {
                // NO-SONAR: se requiere utilizar el hook con la funcion setFieldValue de Formik
                useEffect(() => {
                    setFieldValue("views", views);
                }, [views, setFieldValue]);
                return (
                    <>
                        <Form className="flex w-full justify-center" autoComplete="off">
                            <FormCard isId={!!data?.id} title={t("app.title.generateCsv")} isSending={isSending}>
                                <div className="flex flex-col col-span-3 gap-8">
                                    <FormikStatusMessages formikStatus={status} />
                                    <SectionForm
                                        title={t("generateCsv.form.information")}
                                        id="generate_csv_info"
                                        dataTestId="generate_csv_info"
                                    >
                                        <InputCard>
                                            <KField>
                                                <Textarea
                                                    name="description"
                                                    label={t("generateCsv.form.description")}
                                                    placeholder={t("generateCsv.placeholder.description")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <SelectorAdmin
                                            values={views}
                                            setValues={setViews}
                                            label="generateCsv.form.views"
                                            meta={{
                                                touched: Boolean(getIn(touched, "views")),
                                                error: getIn(errors, "views"),
                                            }}
                                        />
                                    </SectionForm>
                                    <SectionForm
                                        title={t("generateCsv.form.filterView")}
                                        id="generate_csv_filterview"
                                        dataTestId="generate_csv_filterview"
                                    >
                                        <Select
                                            name="time_filter[field]"
                                            label={t("generateCsv.form.field")}
                                            className="flex flex-col items-start justify-start text-start"
                                            options={[
                                                {
                                                    value: "created_at",
                                                    label: t("gridMain.columns.Created at"),
                                                },
                                                {
                                                    value: "updated_at",
                                                    label: t("gridMain.columns.Updated at"),
                                                },
                                                {
                                                    value: "fecha",
                                                    label: t("gridMain.columns.Date"),
                                                },
                                            ]}
                                        />
                                        <div className="flex items-end gap-x-4">
                                            <InputCard className="w-full">
                                                <Select
                                                    name="time_filter[unit]"
                                                    label={t("generateCsv.form.unit")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                    options={[
                                                        {
                                                            value: "hours",
                                                            label: "Horas",
                                                        },
                                                        {
                                                            value: "days",
                                                            label: "Días",
                                                        },
                                                        {
                                                            value: "weeks",
                                                            label: "Semana",
                                                        },
                                                        {
                                                            value: "months",
                                                            label: "Meses",
                                                        },
                                                    ]}
                                                />
                                            </InputCard>
                                            <InputCard className="w-full">
                                                <KField>
                                                    <Input
                                                        type="number"
                                                        name="time_filter.interval"
                                                        label={t("generateCsv.form.interval")}
                                                        placeholder={t("generateCsv.form.interval")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                        </div>
                                        <InputCard>
                                            <Select
                                                name="time_filter[reference]"
                                                label={t("generateCsv.form.reference")}
                                                error={Boolean(
                                                    getIn(errors, "time_filter.reference") &&
                                                    getIn(touched, "time_filter.reference"),
                                                )}
                                                className="flex flex-col items-start justify-start text-start"
                                                options={[
                                                    {
                                                        value: "now",
                                                        label: "Ahora",
                                                    },
                                                    {
                                                        value: "start_of_day",
                                                        label: "Inicio del día",
                                                    },
                                                    {
                                                        value: "start_of_month",
                                                        label: "Inicio del mes",
                                                    },
                                                ]}
                                            />
                                        </InputCard>
                                    </SectionForm>
                                </div>
                                <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                    <SectionForm
                                        title={t("generateCsv.form.export")}
                                        id="generate_csv_export"
                                        dataTestId="generate_csv_export"
                                    >
                                        <div className="flex items-end gap-x-4">
                                            <InputCard className="w-full">
                                                <Select
                                                    name="frequency"
                                                    label={t("generateCsv.form.frequency")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                    options={[
                                                        {
                                                            value: "hours",
                                                            label: "Horas",
                                                        },
                                                        {
                                                            value: "days",
                                                            label: "Días",
                                                        },
                                                        {
                                                            value: "weeks",
                                                            label: "Semanas",
                                                        },
                                                        {
                                                            value: "months",
                                                            label: "Meses",
                                                        },
                                                    ]}
                                                />
                                            </InputCard>
                                            <InputCard className="w-full">
                                                <KField>
                                                    <Input
                                                        type="number"
                                                        name="interval"
                                                        label={t("generateCsv.form.interval")}
                                                        placeholder={t("generateCsv.form.interval")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                        </div>
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    type="text"
                                                    name="storage_path"
                                                    label={t("generateCsv.form.storage_path")}
                                                    placeholder={t("generateCsv.form.storage_path")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    type="text"
                                                    name="details[formatting][separator]"
                                                    label={t("generateCsv.form.separator")}
                                                    placeholder=","
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <div className="flex items-center justify-center gap-x-4">
                                            <InputCard className="w-full">
                                                <DatePicker
                                                    onChange={(values) => setFieldValue("next_execution_at", values)}
                                                    value={values.next_execution_at}
                                                    placeholder={t("genericTexts.initialDate")}
                                                    label={t("generateCsv.form.next_execution_at")}
                                                    error={errors.next_execution_at && touched.next_execution_at}
                                                    errorMessage={errors.next_execution_at}
                                                    showTimeSelect
                                                    dateFormat="Pp"
                                                    customInput={
                                                        <Input name="next_execution_at" className="cursor-pointer" />
                                                    }
                                                />
                                            </InputCard>
                                            <InputCard className="w-full h-full">
                                                <KField>
                                                    <Input
                                                        id="start_time"
                                                        name="start_time"
                                                        label=""
                                                        placeholder={t("timeSlots.placeholder.start_time")}
                                                        type="time"
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                        </div>
                                    </SectionForm>
                                    {data.id && (
                                        <SectionForm id="generate_csv_state" dataTestId="generate_csv_state">
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
                    </>
                );
            }}
        </Formik>
    );
};
GenerateCsvForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
export default GenerateCsvForm;
