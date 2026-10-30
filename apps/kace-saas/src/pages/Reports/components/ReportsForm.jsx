import { Form, Formik } from "formik";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import FormCard from "@/components/core/Cards/FormCard";

import { MAX_DAYS_RANGE } from "../data/constants";
import { ConditionsSection } from "./ConditionsSection";
import { DateSelectWithValidation } from "./DateSelectWithValidation";
import { ReportSelect } from "./ReportSelect";
import { ReportMessage } from "./ReportMessage";
import { PeriodFieldSelect } from "./PeriodFieldSelect";

const ReportsForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();
    const [dateRange, setDateRange] = useState({
        from: data?.period?.initialDate || "",
        to: data?.period?.endDate || "",
    });

    // Sync dateRange with data when it changes
    useEffect(() => {
        if (data?.period?.initialDate || data?.period?.endDate) {
            setDateRange({
                from: data.period.initialDate || "",
                to: data.period.endDate || "",
            });
        }
    }, [data?.period?.initialDate, data?.period?.endDate]);

    const formatDate = (date) => {
        if (!date) return "";
        if (date instanceof Date) {
            return date.toISOString();
        }
        const dateObj = new Date(date);
        if (!isNaN(dateObj)) {
            return dateObj.toISOString();
        }
        return date;
    };

    const handleSubmit = (values, { setFormikErrors, setFormikStatus }) => {
        /*
         * Validar que el campo del período esté seleccionado
         */
        if (!values?.period?.field) {
            toast.error(t("reports.form.periodFieldRequired", "Por favor selecciona el campo de filtrado del período"));
            return;
        }

        /*
         * Validar que las condiciones tengan campo y operador cuando están presentes
         */
        const hasInvalidConditions = (values.conditions || []).some((c) => !c.field || !c.condition);
        if (hasInvalidConditions) {
            toast.error(t("reports.form.conditionFieldRequired", "Todas las condiciones deben tener campo y operador"));
            return;
        }

        const LIST_OPERATORS = ["in", "notIn"];
        const hasEmptyListCondition = (values.conditions || []).some(
            (c) => LIST_OPERATORS.includes(c.condition) && (!Array.isArray(c.value) || c.value.length === 0),
        );
        if (hasEmptyListCondition) {
            toast.error(
                t(
                    "reports.form.emptyListCondition",
                    "Las condiciones 'En lista' y 'No en lista' deben tener al menos un valor seleccionado",
                ),
            );
            return;
        }

        /*
         * Validar que ambas fechas estén presentes
         */
        if (!dateRange.from || !dateRange.to) {
            toast.error(t("reports.form.missingDatesError", "Por favor selecciona un rango de fechas completo"));
            return;
        }

        /*
         * Validar que el rango no sea mayor a MAX_DAYS_RANGE días
         */
        const from = new Date(dateRange.from instanceof Date ? dateRange.from : new Date(dateRange.from));
        const to = new Date(dateRange.to instanceof Date ? dateRange.to : new Date(dateRange.to));
        const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
        const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
        const diffDays = Math.round(Math.abs(utcTo - utcFrom) / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays > MAX_DAYS_RANGE) {
            toast.error(
                t("reports.form.dateRangeExceeded", {
                    max: MAX_DAYS_RANGE,
                    selected: diffDays,
                }),
                { duration: 5000 },
            );
            return;
        }

        // Formatear las condiciones según la estructura requerida
        const formattedConditions = (values.conditions || []).map((condition) => ({
            field: condition.field || "",
            operator: condition.condition || "",
            value: Array.isArray(condition.value)
                ? condition.value.map((item) => (typeof item === "string" ? item : (item.value ?? item.id)))
                : condition.value || null,
            type: "AND",
        }));

        // Construir el payload con la estructura exacta requerida
        const payload = {
            name: values.report || "",
            period: {
                field: values.period?.field,
                initialDate: formatDate(dateRange.from),
                endDate: formatDate(dateRange.to),
            },
            conditions: formattedConditions,
        };

        dataHandler(payload, setFormikErrors, setFormikStatus);
    };

    return (
        <Formik enableReinitialize={true} initialValues={data} onSubmit={handleSubmit}>
            {({ values, setFieldValue, errors, initialValues, resetForm }) => {
                const hasReportSelected = values.report && values.report !== "";

                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} title={t("app.title.reports")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <ReportSelect
                                    initialValues={initialValues}
                                    setFieldValue={setFieldValue}
                                    values={values}
                                    errors={errors}
                                    setDateRange={setDateRange}
                                    resetForm={resetForm}
                                />

                                {!hasReportSelected && <ReportMessage />}

                                {hasReportSelected && (
                                    <>
                                        <PeriodFieldSelect reportName={values.report} />
                                        <DateSelectWithValidation
                                            setFieldValue={setFieldValue}
                                            dateRange={dateRange}
                                            setDateRange={setDateRange}
                                            formatDate={formatDate}
                                        />
                                        <ConditionsSection
                                            conditions={values.conditions || []}
                                            setFieldValue={setFieldValue}
                                            reportName={values.report}
                                        />
                                    </>
                                )}
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};

ReportsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};

export default ReportsForm;
