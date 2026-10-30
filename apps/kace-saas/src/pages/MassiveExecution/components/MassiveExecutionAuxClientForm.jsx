import { Button, GeneralLoader, Label, Switch } from "@/components/ui-shared";
import JSONEditor from "@/componentsV2/lib/JSONEditor";
import { schemaToInternal, transformNonEmptyToJSON } from "@/componentsV2/lib/JSONEditor/helpers";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import { MassiveDeletionSchema } from "@/schemas/MassiveDeletionSchema";
import { joiFormikAdapter } from "@/utils/main";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { Form, Formik } from "formik";
import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import MassiveExecutionAuxClient from "@/pages/MassiveExecution/components/MassiveExecutionAuxClient";

const MassiveExecutionAuxClientForm = ({ dataHandler }) => {
    const { t } = useTranslation();
    const [simpleView, setSimpleView] = useState(true);
    const formikRef = useRef(null);
    const auxClientRef = useRef(null);

    const { data: auxClientSearch = [] } = useGenericSearchQuery({
        url: URL_AND_KEYS.auxDefinitions.url + "/search",
        keyQuery: ["auxiliariesList"],
        filter: [
            {
                field: "name",
                value: "clients",
                type: "AND",
                operator: "eq",
            },
        ],
    });

    const { data: auxClientsRules, isFetched } = useGenericViewQuery({
        url: `${URL_AND_KEYS.schemas.url}/${auxClientSearch?.data?.[0]?.schema_id}/rules`,
        keyQuery: ["aux_client_rules"],
        enabled: !!auxClientSearch?.data?.[0]?.schema_id?.length,
    });

    const handleAuxClientChange = useCallback((criteria) => {
        if (formikRef.current) {
            formikRef.current.setFieldValue("properties", criteria);
        }
    }, []);

    useEffect(() => {
        if (!formikRef.current) return;
        if (simpleView) {
            formikRef.current.resetForm({ values: { properties: {} } });
        } else {
            const schemaAsJson = auxClientsRules?.data_structure
                ? schemaToInternal(auxClientsRules.data_structure)
                : [];
            formikRef.current.resetForm({ values: { properties: schemaAsJson } });
        }
    }, [simpleView, auxClientsRules]);

    const initialSchema = auxClientsRules?.data_structure ? schemaToInternal(auxClientsRules.data_structure) : [];

    return !isFetched ? (
        <GeneralLoader />
    ) : (
        <Formik
            innerRef={formikRef}
            initialValues={{ properties: initialSchema }}
            validationSchema={simpleView ? null : joiFormikAdapter(MassiveDeletionSchema)}
            onSubmit={async (_, { setSubmitting }) => {
                const currentValues = formikRef.current.values;
                const properties = simpleView
                    ? (auxClientRef.current?.getCriteria() ?? currentValues.properties)
                    : transformNonEmptyToJSON(currentValues.properties);

                if (simpleView && (!properties || Object.keys(properties).length === 0)) {
                    setSubmitting(false);
                    return;
                }

                await dataHandler(properties);
                setSubmitting(false);
            }}
        >
            {({ isSubmitting }) => {
                return (
                    <Form className="w-full grid grid-cols-1 md:grid-cols-2 gap-x-2 gap-y-2" autoComplete="off">
                        {simpleView ? (
                            <div className="col-span-2">
                                <MassiveExecutionAuxClient ref={auxClientRef} onChange={handleAuxClientChange} />
                            </div>
                        ) : (
                            <div className="col-span-2">
                                <div className="flex items-center text-gray-700">
                                    <small>{t("massiveExecution.filterBuildDescription")}</small>
                                </div>
                                <JSONEditor
                                    namePrefix="properties"
                                    allowArrays={true}
                                    allowObjects={true}
                                    enableTypeChange={false}
                                    enablePropertyRename={false}
                                    enableAddingProperty={false}
                                    enableStructureModifications={false}
                                />
                            </div>
                        )}
                        <div className="col-span-2">
                            <Button type="submit" disabled={isSubmitting}>
                                {t("massiveExecution.button.filter")}
                            </Button>
                        </div>
                    </Form>
                );
            }}
        </Formik>
    );
};

export default MassiveExecutionAuxClientForm;
