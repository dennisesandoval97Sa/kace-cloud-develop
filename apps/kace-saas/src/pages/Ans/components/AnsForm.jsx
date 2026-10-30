import { PropTypes } from "prop-types"
import { Formik } from "formik"
import { useEffect, useState } from "react"
import {
    InputFormModal as Input,
    KField,
    Label,
    FormikStatusMessages
} from "@kace/ui-shared"
import { joiFormikAdapter } from "@kace/utils"
import { AnsCreateSchemaForm } from "../../../schemas/AnsSchema"
import InputCard from "../../../components/core/Cards/InputCard"
import ModalForm from "../../../components/core/ModalForm/modal-form"
import InputSelect from "../../../components/core/InputSelect/input-select"
import { SelectColor } from "../../../components/core/SelectColor/select-color"
import { useTranslation } from "react-i18next"
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin"
import useGeneralMutation from "../../../hooks/useGeneralMutation"
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation"
import { INITIAL_VALUES_ANS } from "../data/constants"
import { SelectByUrl } from "../../../components/core/SelectByUrl/SelectByUrl"
import { URL_AND_KEYS } from "../../../utils/urlAndKeys"
import useGenericViewQuery from "../../../hooks/useGenericViewQuery"
import { useSelector } from "react-redux"

const AnsForm = () => {
    const { t } = useTranslation()
    const [formData, setFormData] = useState(INITIAL_VALUES_ANS)
    const openModal = useSelector(state => state.modalBehavior.open)
    const idSelected = useSelector(state => state.modalBehavior.idSelected)
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.ans.key,
        openModal: true
    })
    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.ans.url}/${idSelected}`,
        keyQuery: URL_AND_KEYS.ans.key,
        searchById: [idSelected],
        staleTime: 0,
        gcTime: 0,
        enabled: !!idSelected
    })

    const handleAns = async (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: URL_AND_KEYS.ans.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending
        })
        mutate(data)
    }

    const handlerOptionsTypes = (data) => {
        if (Array.isArray(data)) {
            const items = data.map((item) => {
                if (item instanceof Object) {
                    const label = `dataApi.${item.key}`
                    return {
                        value: item.value,
                        label: t(label)
                    }
                }
                if (typeof item === "string") {
                    return { label: item, value: item }
                }
                return null
            }).filter((item) => item !== null)
            return items
        }
    }
    useEffect(() => {
        if (data && openModal) {
            if (Object.entries(data).length !== 0) {
                Object.entries(data).forEach(([key, value]) => {
                    setFormData((state) => ({
                        ...state,
                        [key]: value || ""
                    }))
                })
            }
        }
    }, [data, openModal])

    useEffect(() => {
        !openModal && setFormData(INITIAL_VALUES_ANS)
    }, [openModal])

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(AnsCreateSchemaForm)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                handleAns(values, setErrors, setStatus)
            }}
        >
            {({ errors, touched, status, setStatus, resetForm, values, setFieldValue }) => {
                if (
                    Object.entries(errors).length === 0 &&
                    status !== undefined
                ) {
                    setStatus(undefined)
                }
                return (
                    <ModalForm
                        open={openModal}
                        isLoading={isLoading}
                        title={t("app.title.ans")}
                        subtitle={t("app.forms.subtitle")}
                        resetForm={resetForm}
                        pending={isPending}
                        hasEntity={idSelected}
                    >
                        <div className="grid gap-4">
                            <InputCard>
                                <KField>
                                    <Input
                                        type="text"
                                        name="nombre"
                                        label={t("ans.form.nombre")}
                                        placeholder={t("ans.form.placeholder.nombre")}
                                    />
                                </KField>
                            </InputCard>
                            <InputCard>
                                <KField>
                                    <Input
                                        type="number"
                                        name="intermedio"
                                        label={t("ans.form.intermedio")}
                                        placeholder={t("ans.form.placeholder.intermedio")}
                                        min={0}
                                    />
                                </KField>
                            </InputCard>
                            <InputCard>
                                <KField>
                                    <Input
                                        type="number"
                                        name="vencido"
                                        label={t("ans.form.vencido")}
                                        placeholder={t("ans.form.placeholder.vencido")}
                                        min={0}
                                    />
                                </KField>
                            </InputCard>
                            <div className="grid grid-cols-4 gap-4 items-center">
                                <Label
                                    className={`${errors.medicion_ans_id && touched.medicion_ans_id && "text-redCustom"} text-right`}
                                >
                                    {t("ans.form.tipo_medicion")}
                                </Label>
                                <InputCard className="col-start-2 col-end-5">
                                    <SelectByUrl
                                        name="medicion_ans_id"
                                        url={"ans-types"}
                                        value={values.medicion_ans_id}
                                        keyQuery="typesAnsRequest"
                                        setFieldValue={setFieldValue}
                                        itemLabel="name"
                                        error={errors.custom_form_id}
                                        touched={touched.custom_form_id}
                                        method="get"
                                        typeForm={handlerOptionsTypes}
                                    />
                                </InputCard>
                            </div>
                            <KField>
                                <SelectColor
                                    title={t("ans.form.color_ans_inicial")}
                                    name="color_ans_inicial"
                                />
                            </KField>
                            <KField>
                                <SelectColor
                                    title={t("ans.form.color_ans_intermedio")}
                                    name="color_ans_intermedio"
                                />
                            </KField>
                            <KField>
                                <SelectColor
                                    title={t("ans.form.color_ans_final")}
                                    name="color_ans_final"
                                />
                            </KField>
                            {idSelected && (
                                <InputSelect>
                                    <KField>
                                        <SwitchStateAdmin
                                            name="status"
                                            className="col-span-3"
                                        />
                                    </KField>
                                </InputSelect>
                            )}
                            <FormikStatusMessages formikStatus={status} />
                        </div>
                    </ModalForm>
                )
            }}
        </Formik>
    )
}
AnsForm.propTypes = {
    idSelected: PropTypes.string,
    setIdSelected: PropTypes.func,
    canBeEdit: PropTypes.bool
}
export default AnsForm
