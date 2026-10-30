import { useQueryClient } from "@tanstack/react-query"
import { useState, useEffect, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { useCaseInfo } from "./useCaseInfo.js"
import { useAuxCaseInfo } from "./useAuxCaseInfo.js"
import { useAuxClientInfo } from "./useAuxClientInfo.js"
import { useFormData } from "./useFormData.js"
import { useRelationGroup } from "./useRelationGroup.js"
import { initialValuesClientAux } from "../../../../../data/Constants.jsx"
import { getLocalStorageInfoUser } from "../../../../../helpers.js"
import useUserInformation from "../../../../../../../hooks/useUserInformation.js"

export const useSheduleForm = ({
    info,
    setFieldValue,
    values,
    idCase,
    clientIdProp = ""
}) => {
    const { idGroup } = getLocalStorageInfoUser()
    const queryClient = useQueryClient()

    const [clientAux, setClientAux] = useState(initialValuesClientAux)

    const stateClassification = queryClient.getQueryData(["caseInfo", idCase])
    const stateClassificationId = stateClassification?.clasificacion_id

    const [classificationId, setClassificationId] = useState("")
    const [clientId, setClientId] = useState(clientIdProp)
    const { user } = useUserInformation()
    const location = useLocation()

    const isCalendarRoute = !location.pathname.includes("create")

    const { data: dataCaseInfo } = useCaseInfo(
        idCase,
        !!idCase && isCalendarRoute
    )
    const { data: dataAuxCase } = useAuxCaseInfo(idCase, info)
    const { data: dataAuxClient } = useAuxClientInfo(clientId, classificationId)
    const { data: dataForm } = useFormData(user, idCase, classificationId)
    const { data: relationGroupShedule, isSuccess } = useRelationGroup(idGroup)

    useEffect(() => {
        if (
            dataCaseInfo?.clasificacion_id &&
            dataCaseInfo?.clasificacion_id !== classificationId
        ) {
            setClassificationId(dataCaseInfo?.clasificacion_id)
        }
        if (dataCaseInfo?.cliente_id && dataCaseInfo?.cliente_id !== clientId) {
            setClientId(dataCaseInfo?.cliente_id)
        }
    }, [dataCaseInfo])

    useEffect(() => {
        if (stateClassificationId !== classificationId) {
            setClassificationId(stateClassificationId)
        }
    }, [stateClassificationId])

    useEffect(() => {
        const handleFormData = () => {
            if (!dataForm?.data?.[0]?.form || !dataAuxCase?.data) return

            const formId = dataForm?.data[0].form
            const currentCase = dataAuxCase?.data[`form_${formId}`]
            if (!currentCase) return

            const activeCampaign = currentCase.campanyasActivas
            const clientData =
                dataAuxClient?.data?.auxcli_campanya?.[activeCampaign]
            if (!clientData) return

            setClientAux(clientData)

            setFieldValue("ciudad", clientData.auxcli_ciudad || values.ciudad)
            setFieldValue(
                "departamento",
                clientData.auxcli_departamento || values.departamento
            )
        }

        handleFormData()
    }, [dataAuxClient, dataAuxCase, dataForm])

    useEffect(() => {
        if (info && info.start && info.end) {
            setFieldValue("id", info.id)
            setFieldValue("date", info.start.date || values.date)
            setFieldValue("date_end", info.end.date || values.date_end)
            setFieldValue(
                "start_time",
                info.start.time !== "" ? info.start.time : values.start_time
            )
            setFieldValue(
                "end_time",
                info.end.time !== "" ? info.end.time : values.end_time
            )
            setFieldValue("mode", info.mode)

            if (
                (info.mode || info?.diary === "") &&
                info?.slot?.start === "00:00" &&
                info?.slot?.end === "00:00"
            ) {
                setFieldValue("agenda_id", info.diary)
            }
        }
        if (info?.slot?.start && info?.slot?.end) {
            if (!info?.mode) {
                setFieldValue("start_time", info.slot.start)
                setFieldValue("end_time", info.slot.end)
            }
        }
        setFieldValue(
            "ciudad",
            info?.custom_fields?.data?.ciudad || clientAux?.auxcli_ciudad || ""
        )
        setFieldValue(
            "departamento",
            info?.custom_fields?.data?.departamento ||
                clientAux?.auxcli_departamento ||
                ""
        )

        setFieldValue(
            "barrio",
            info?.custom_fields?.data?.barrio || info?.barrio || ""
        )
        setFieldValue(
            "direccion",
            info?.custom_fields?.data?.direccion || info?.direccion || ""
        )
        setFieldValue(
            "tipo_agenda",
            info?.custom_fields?.data?.tipo_agenda || info?.tipo_agenda || ""
        )
        setFieldValue(
            "fecha_anterior",
            info?.custom_fields?.data?.fecha_anterior ||
                info?.fecha_anterior ||
                ""
        )
        setFieldValue(
            "punto_referencia",
            info?.custom_fields?.data?.punto_referencia ||
                info?.punto_referencia ||
                ""
        )
    }, [info])

    const handlerOptionsTypes = useMemo(() => {
        return (dataSchedule) => {
            if (!Array.isArray(dataSchedule) || !relationGroupShedule?.data) {
                return []
            }

            return (
                dataSchedule[0]?.value
                    ?.filter((item) =>
                        relationGroupShedule.data.some(
                            (relationItem) => relationItem.agenda_id === item.id
                        )
                    )
                    .map((item) => ({
                        value: item.id,
                        label: item.description
                    })) || []
            )
        }
    }, [relationGroupShedule])

    return {
        clientAux,
        handlerOptionsTypes,
        isSuccess
    }
}
