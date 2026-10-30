import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Form, Formik } from "formik";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Button } from "@/components/ui-shared";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { transformToJSON } from "@/componentsV2/lib/JSONEditor/helpers";
import MassiveExecutionAuxClientForm from "./MassiveExecutionAuxClientForm";
import DataTableEntityFilter from "./DataTableEntityFilter";
import FormikMassiveExecutionSelector from "./FormikMassiveExecutionSelector";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { useEffect } from "react";
import { sendInformation } from "@/services/generic-send-information";
import { ROUTES } from "@/config/routesDictionary";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildClientsSearchQuery } from "../utils/clientsDataTable";

const MassiveExecutionClientTab = ({ setFilters }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { mutate, isPending, isSuccess } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.actionJobs.key,
    });

    const initialActionValues = {
        filters: [],
        action_type: "restflow",
        restflow_id: "",
        restflow_context: { properties: [] },
    };

    const handleActionSubmit = (values, { setSubmitting }) => {
        const cleanJsonContext = transformToJSON(values.restflow_context.properties);
        /*
         * Misma consulta que la vista previa: el backend resuelve `filter_clients` con base
         * `clients`, asi que el lote ejecutado coincide con lo que el usuario vio.
         */
        const { filter, relationship } = buildClientsSearchQuery(values.filters);

        const combinedPayload = {
            search_filter: {
                filter,
                limit: 0,
                offset: 0,
                relationship,
            },
            type: "filter_clients",
            restflow_id: values.restflow_id,
            restflow_context: cleanJsonContext,
        };

        const data = genericHandleSendInformation({
            values: combinedPayload,
            urlService: URL_AND_KEYS.actionJobs.url,
        });

        mutate(data);
        setSubmitting(false);
    };

    useEffect(() => {
        if (isSuccess) {
            (async () => {
                try {
                    await sendInformation({
                        url: `${URL_AND_KEYS.actionJobs.url}/process-queue`,
                    });
                    navigate(ROUTES.MASSIVE_EXECUTION.path);
                } catch (error) {
                    toast.error(t("app.alerts.dontAction"));
                }
            })();
        }
    }, [isSuccess, navigate]);

    return (
        <div>
            <Formik initialValues={initialActionValues} onSubmit={handleActionSubmit}>
                {({ values, setFieldValue }) => {
                    const handleFilterChangeAndPreview = (filtersFromComponent) => {
                        setFilters(filtersFromComponent);
                        setFieldValue("filters", filtersFromComponent);
                    };

                    return (
                        <>
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="item-aux-clients">
                                    <AccordionTrigger>
                                        <div className="flex gap-4">
                                            <b>{t("massiveExecution.form.title.filterBy")}:</b>
                                            {t("massiveExecution.form.title.auxClient")}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <MassiveExecutionAuxClientForm
                                            dataHandler={(values) => {
                                                if (!values || Object.keys(values).length === 0) {
                                                    return;
                                                }
                                                const auxFilters = [
                                                    {
                                                        field: "data",
                                                        operator: "jsonContains",
                                                        type: "AND",
                                                        value: JSON.stringify(values),
                                                    },
                                                ];
                                                handleFilterChangeAndPreview(auxFilters);
                                            }}
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="item-clients" className="border-none">
                                    <AccordionTrigger>
                                        <div className="flex gap-4">
                                            <b>{t("massiveExecution.form.title.filterBy")}:</b>
                                            {t("massiveExecution.form.title.client")}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {t("massiveExecution.clientFilterDescription")}
                                        </p>
                                        <DataTableEntityFilter
                                            onApply={handleFilterChangeAndPreview}
                                            onClear={() => handleFilterChangeAndPreview([])}
                                            excludeColumns={[
                                                "id",
                                                "created_by",
                                                "deleted_by",
                                                "updated_by",
                                                "created_at",
                                                "deleted_at",
                                                "updated_at",
                                                "status",
                                            ]}
                                            fieldPrefix="clients."
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>

                            {!!values?.filters?.length && (
                                <Form autoComplete="off">
                                    <FormikMassiveExecutionSelector tab="clients" />
                                    <div className="mt-4">
                                        <Button
                                            type="submit"
                                            disabled={!values?.filters?.length || !values.restflow_id || isPending}
                                        >
                                            {t("button.executeActions")}
                                        </Button>
                                    </div>
                                </Form>
                            )}
                        </>
                    );
                }}
            </Formik>
        </div>
    );
};

MassiveExecutionClientTab.propTypes = {
    setFilters: PropTypes.func.isRequired,
};

export default MassiveExecutionClientTab;
