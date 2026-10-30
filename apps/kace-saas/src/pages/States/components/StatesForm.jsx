import { Formik } from "formik"
import { useEffect, useState } from "react"
import { joiFormikAdapter } from "@kace/utils"
import InputCard from "../../../components/core/Cards/InputCard"
import { KField, InputForm as Input, TextAreaForm, FormikStatusMessages } from "@kace/ui-shared"
import ModalForm from "../../../components/core/ModalForm/modal-form"
import { STATE_SERVICE } from "../../../utils/URL"
import { INITIAL_VALUES_STATES } from "../data/constants"
import { SelectColor } from "../../../components/core/SelectColor/select-color"
import { SelectIcon } from "../../../components/core/SelectIcon/SelectIcon"
import { StateSchemaForm } from "../../../schemas/StateSchema"
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin"
import useGeneralMutation from "../../../hooks/useGeneralMutation"
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation"
import { useTranslation } from "react-i18next"
import { URL_AND_KEYS } from "../../../utils/urlAndKeys.js"
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery.js"
import { useSelector } from "react-redux"
export const StatesForm = () => {
    const { t } = useTranslation()
    const [formValues, setFormValues] = useState(INITIAL_VALUES_STATES)
    const openModal = useSelector(state => state.modalBehavior.open)
    const idSelected = useSelector(state => state.modalBehavior.idSelected)
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.states.key,
        openModal: true
    })

    const { data: dataSelected, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.states.url}/${idSelected}`,
        keyQuery: URL_AND_KEYS.states.key,
        searchById: [idSelected],
        staleTime: 0,
        gcTime: 0,
        enabled: !!idSelected
    })

    const handleSendInformation = async (
        values,
        setFormikErrors,
        setFormikStatus
    ) => {
        const data = genericHandleSendInformation({
            values,
            urlService: STATE_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending
        })

        data.handleStatesError = true;
        mutate(data);
    }

    useEffect(() => {
        if (dataSelected && openModal) {
            if (Object.entries(dataSelected).length !== 0) {

                const dataSelectedModified = {
                    ...dataSelected,
                    require_observation: dataSelected.require_observation ?? false
                };

                Object.entries(dataSelectedModified).forEach(
                    ([key, value]) => {
                        setFormValues((state) => ({
                            ...state,
                            [key]: value || ""
                        }))
                    }
                )
            }
        }
    }, [dataSelected, openModal])

    useEffect(() => {
        !openModal && setFormValues(INITIAL_VALUES_STATES)
    }, [openModal])

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(StateSchemaForm)}
            onSubmit={(values, { setErrors, setStatus }) => {
                handleSendInformation(values, setErrors, setStatus)
            }}
        >
            {({ status, resetForm }) => {
                return (
                    <ModalForm
                        open={openModal}
                        isLoading={isLoading}
                        title={t("app.title.states")}
                        subtitle={t("app.forms.subtitle")}
                        setFormValues={setFormValues}
                        resetForm={resetForm}
                        pending={isPending}
                        hasEntity={idSelected}
                    >
                        <InputCard>
                            <KField>
                                <Input
                                    id="nombre"
                                    name="nombre"
                                    label={t("states.form.nombre")}
                                    type="text"
                                    placeholder={t(
                                        "states.form.placeholder.nombre"
                                    )}
                                    className="flex flex-col items-start justify-start text-start"
                                    data-testid="states_form_name"
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <KField>
                                <TextAreaForm
                                    id="states_form_description"
                                    name="descripcion"
                                    label={t("states.form.descripcion")}
                                    type="text"
                                    placeholder={t(
                                        "states.form.placeholder.descripcion"
                                    )}
                                    textDescription=""
                                    data-testid="states_form_description"
                                />
                            </KField>
                        </InputCard>
                        <div className="flex gap-2 justify-between">
                            <SelectColor
                                title={t("states.form.color")}
                                name="color"
                                className="flex flex-col items-start justify-start text-start gap-2"
                            />
                            <SelectIcon
                                title={t("states.form.iconos")}
                                name="icon_class"
                                className="flex flex-col items-start justify-start text-start gap-2"
                            />
                        </div>
                        <InputCard>
                            <KField>
                                <SwitchStateAdmin
                                    name="require_observation"
                                    title={t(
                                        "states.form.requiere_observacion"
                                    )}
                                    tipo="boolean"
                                />
                            </KField>
                        </InputCard>
                        {idSelected && (
                            <InputCard>
                                <KField>
                                    <SwitchStateAdmin name="status" />
                                </KField>
                            </InputCard>
                        )}
                        <FormikStatusMessages formikStatus={status} />
                    </ModalForm>
                )
            }}
        </Formik>
    )
}

