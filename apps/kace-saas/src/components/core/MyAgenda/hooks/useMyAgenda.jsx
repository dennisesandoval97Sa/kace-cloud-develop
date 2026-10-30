import { setMyAgendaBehavior } from "../../../../redux/state/myAgendaBehavior"
import { useDispatch, useSelector } from "react-redux"
import { genericSearch } from "../../../../services/genericSearch"
import { APPOINTMENT_SERVICES } from "../../../../utils/URL"
import useUserInformation from "../../../../hooks/useUserInformation"
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

const useMyAgenda = () => {
    const isOpenMyAgenda = useSelector((state) => state.myAgendaBehavior.isOpenMyAgenda)
    const dispatch = useDispatch()
    const { user } = useUserInformation()

    const setOpenedMyAgenda = () => {
        dispatch(setMyAgendaBehavior(!isOpenMyAgenda))
    }

    const { data } = useQuery({
        queryKey: ['myAgenda', user?.email],
        queryFn: async () => {
            return searchAppointments(user?.id)
        },
        enabled: !!isOpenMyAgenda && !!user,
        staleTime: 0,
        retry: 2
    })
    const formatEvent = (data) => {

        const newEvents = data?.data?.map((item) => ({
            id_event: item.id,
            case_id: item.case_id,
            start: item.start_time,
            end: item.end_time,
            agenda_id: item.agenda_id
        }))
        return newEvents
    }

    const searchAppointments = async (userId) => {
        const filter = [
            {
                field: "appointments.is_canceled",
                operator: "eq",
                value: 0,
                type: "AND"
            },
            {
                field: "appointments.is_completed",
                operator: "eq",
                value: 0,
                type: "AND"
            },
            {
                field: "appointments.deleted_at",
                operator: "null",
                value: "null",
                type: "AND"
            },
            {
                field: "cases.responsable_id",
                operator: "eq",
                value: userId,
                type: "AND"
            },
            {
                field: "appointments.date",
                operator: "gte",
                value: format(new Date(), 'yyyy-MM-dd'),
                type: "AND"
            }
        ]

        const customFilter = {
            relationship: [
                {
                    table: "cases",
                    condition: {
                        column: "cases.id",
                        refColumn: "appointments.case_id"
                    },
                    type: "join"
                }
            ],
            order: {
                field: "appointments.created_at",
                direction: "desc"
            }
        }
         const response = await genericSearch(`${APPOINTMENT_SERVICES}/search`, filter, null, null, false, customFilter)

         return formatEvent(response)
    }

    return {
        setOpenedMyAgenda,
        data
    }
}

export default useMyAgenda