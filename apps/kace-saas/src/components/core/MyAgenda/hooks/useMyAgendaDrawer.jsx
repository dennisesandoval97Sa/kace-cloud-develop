import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react';
import { AGENDA_SERVICE, CASES_SERVICE, CLIENT_SERVICE } from '../../../../utils/URL';
import { genericView } from '../../../../services/genericView';

const useMyAgendaDrawer = ({ agendaId, caseId }) => {
    const [status, setStatus] = useState(false)

        const { data: agendaInfo, isPending: isPendingAgenda } = useQuery({
            queryKey: ['myAgendaInfo', agendaId],
            queryFn: async () => {
                return genericView(`${AGENDA_SERVICE}/${agendaId}`)
            },
            enabled: !!agendaId && !!status,
            staleTime: 1000 * 60 * 20,
            retry: 2

        })

        const { data: caseInfo, isSuccess, isPending: isPendingCase } = useQuery({
            queryKey: ['myAgendaCase', caseId],
            queryFn: async () => {
                return genericView(`${CASES_SERVICE}/${caseId}`)
            },
            enabled: !!caseId && !!status,
            staleTime: 1000 * 60 * 5,
            retry: 2
        })

        const { data: clientInfo, isPending: isPendingClient } = useQuery({
            queryKey: ['myAgendaClient', caseInfo?.cliente_id, caseId],
            queryFn: async () => {
                return genericView(`${CLIENT_SERVICE}/${caseInfo?.cliente_id}`)
            },
            enabled: !!isSuccess && !!caseInfo?.cliente_id,
            staleTime: 1000 * 60 * 5,
            retry: 2
        })

        useEffect(() => {
            if (status) setStatus(false) 
        }, [status])

    return {
        isPendingAgenda,
        isPendingCase,
        isPendingClient,
        setStatus,
        agendaInfo,
        caseInfo,
        clientInfo
    }

};

export default useMyAgendaDrawer;