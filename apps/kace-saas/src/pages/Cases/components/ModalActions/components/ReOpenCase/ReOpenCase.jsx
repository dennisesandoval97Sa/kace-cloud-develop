import { Formik, Form } from "formik";
import { useTranslation } from "react-i18next";
import { KField, DialogFooter, Button, GeneralLoader, TextAreaForm } from "@kace/ui-shared";
import { initialValuesReopenCase } from "../../../../data/Constants";
import { SelectByUrl } from "../../../../../../components/core/SelectByUrl/SelectByUrl";
import useSelectedCase from "../../hooks/useSelectedCase";
import { useReopenCase } from "./hooks/useReOpenCase";
import { joiFormikAdapter } from "../../../../../../utils/main";
import { reOpenCaseSchema } from "../../../../../../schemas/CasoSchema";
import { URL_AND_KEYS } from "../../../../../../utils/urlAndKeys";
import { genericView } from "../../../../../../services/genericView";
import { useEffect, useState } from "react";

export const ReOpenCase = () => {
    const { t } = useTranslation();

    const { caseSelect } = useSelectedCase();
    const caseId = caseSelect?.data?.id;

    const [transitionId, setTransitionId] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!caseId) return;
        const getCase = async () => {
            try {
                setLoading(true);
                const caseDetail = await genericView(`${URL_AND_KEYS.cases.url}/${caseId}`);
                setTransitionId(caseDetail.transicion_id);
            } catch {
                // NO-SONAR: Si ocurre un error al obtener los detalles del caso, se establece el transitionId como vacío sin interrumpir el flujo.
                setTransitionId("");
            } finally {
                setLoading(false);
            }
        };
        getCase();
    }, [caseId, setLoading]);

    const { handleReopenCase, isPending } = useReopenCase();

    const typeForm = (data) => {
        const flow = data.filter((item) => item.key === "flujo");

        const { nodes, edges } = flow[0].value.data.json_flujo;

        const values = nodes
            .filter((node) => node.data.label !== "inicio")
            .map((node) => {
                const edge = edges.find((e) => e.target === node.id);
                return {
                    label: node.data.label,
                    value: edge?.kace_transition ?? null,
                };
            })
            .filter((item) => item.value !== null);

        return values;
    };

    return (
        <Formik
            enableReinitialize={true}
            validationSchema={joiFormikAdapter(reOpenCaseSchema)}
            initialValues={initialValuesReopenCase}
            onSubmit={(values) => {
                handleReopenCase(values);
            }}
        >
            {({ errors, touched, values, setFieldValue }) => {
                return (
                    <Form autoComplete="off">
                        {loading && <GeneralLoader />}
                        {transitionId && (
                            <div>
                                <div className="grid gap-4 pb-2">
                                    <KField>
                                        <SelectByUrl
                                            name="transicion_id"
                                            url={`${URL_AND_KEYS.transitions.url}/${transitionId}`}
                                            value={values.transicion_id}
                                            keyQuery={[URL_AND_KEYS.transitions.url, transitionId]}
                                            setFieldValue={setFieldValue}
                                            itemLabel="nombre"
                                            label={t("generalSetup.form.labels.state")}
                                            valueFrom="id"
                                            error={errors.id}
                                            touched={touched.id}
                                            method="get"
                                            typeForm={typeForm}
                                        />
                                    </KField>
                                </div>
                                <div className="grid gap-4 pb-2">
                                    <KField>
                                        <TextAreaForm
                                            name="descripcion"
                                            label={t("template.form.labels.descripcion")}
                                            placeholder={t("case.placeholder.reopenDescription")}
                                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </KField>
                                </div>
                                <DialogFooter className="sm:justify-end">
                                    <Button disabled={isPending || !caseId} type="submit">
                                        {t(isPending ? "button.sending" : "button.send")}
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                    </Form>
                );
            }}
        </Formik>
    );
};
