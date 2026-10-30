import {
    Button,
    DialogFooter,
    KField,
    TextAreaForm as Textarea,
    GeneralLoader
} from "@kace/ui-shared"
import { joiFormikAdapter } from "@kace/utils"
import { Form, Formik } from "formik"
import { useTranslation } from "react-i18next"
import { SelectByUrl } from "../../../../../../components/core/SelectByUrl/SelectByUrl"
import { caseCloneSchemaForm } from "../../../../../../schemas/CasoSchema"
import { initialValuesClone } from "../../../../data/Constants"
import useSelectedCase from "../../hooks/useSelectedCase"
import { useCloneCase } from "./hooks/useCloneCase"
import { URL_AND_KEYS } from "../../../../../../utils/urlAndKeys"
import { useEffect, useState } from "react"
import { genericView } from "../../../../../../services/genericView"

export const CloneCase = () => {
    const { t } = useTranslation()

    const { caseSelect } = useSelectedCase()
    const caseId = caseSelect?.data?.id
    const { handleCloneCase, isPending } = useCloneCase({ caseId })

    const [transitionId, setTransitionId] = useState("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!caseId) return
        async function getCase() {
            try {
                setLoading(true)
                const caseDetail = await genericView(`${URL_AND_KEYS.cases.url}/${caseId}`)
                setTransitionId(caseDetail.transicion_id)
            } catch {
                // NO-SONAR: Si ocurre un error al obtener los detalles del caso, se establece el transitionId como vacío sin interrumpir el flujo.
                setTransitionId("")
            } finally {
                setLoading(false)
            }
        }
        getCase()
    }, [caseId, setLoading])

    const typeForm = (data) => {
        const flow = data.filter(item => item.key === "flujo")

        const { nodes, edges } = flow[0].value.data.json_flujo

        const values = nodes
            .filter(node => node.data.label !== "inicio")
            .map(node => {
                const edge = edges.find(e => e.target === node.id)
                return {
                    label: node.data.label,
                    value: edge ? edge.kace_transition : null
                }
            })
            .filter(item => item.value !== null)

        return values
    }

    return (
        <Formik
            enableReinitialize
            initialValues={initialValuesClone}
            validationSchema={joiFormikAdapter(caseCloneSchemaForm)}
            onSubmit={handleCloneCase}
        >
            {({ values, setFieldValue, errors, touched }) => (
                <Form autoComplete="off" id="form_clone_case" data-testid="form_clone_case">
                    {loading && <GeneralLoader id="loader_clone_case" data-testid="loader_clone_case" />}
                    {transitionId && (
                        <div id="form_body_clone_case" data-testid="form_body_clone_case">
                            <div className="grid gap-4 pb-2">
                                <KField>
                                    <SelectByUrl
                                        name="stateId"
                                        url={`${URL_AND_KEYS.transitions.url}/${transitionId}`}
                                        value={values.stateId}
                                        keyQuery={[URL_AND_KEYS.transitions.url, transitionId]}
                                        setFieldValue={setFieldValue}
                                        itemLabel="grupo.nombres"
                                        label={t("case.text.availableStates")}
                                        valueFrom="grupo_id"
                                        error={errors.stateId}
                                        touched={touched.stateId}
                                        useSearchDefault={false}
                                        typeForm={typeForm}
                                        method="get"
                                        id="select_by_url_state_id"
                                        data-testid="select_by_url_state_id"
                                    />
                                </KField>
                            </div>
                            <div className="grid gap-4 pb-2">
                                <KField>
                                    <Textarea
                                        name="description"
                                        label={t("banners.form.description")}
                                        placeholder={t(
                                            "banners.placeholder.description"
                                        )}
                                        className="flex flex-col items-start justify-start text-start"
                                        id="textarea_description"
                                        data-testid="textarea_description"
                                    />
                                </KField>
                            </div>
                            <DialogFooter className="sm:justify-end" id="footer_clone_case" data-testid="footer_clone_case">
                                <Button disabled={isPending} type="submit" id="button_submit_clone_case" data-testid="button_submit_clone_case">
                                    {t(isPending ? "button.sending" : "button.send")}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </Form>
            )}
        </Formik>
    )
}
