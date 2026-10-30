import { useCallback } from "react";
import {
    APPOINTMENT_SERVICES,
    RE_SCHEDULER_SERVICES,
} from "../../../../../../utils/URL";
import { formatDataBeforePost } from "../../../../helpers";
import { parseISODate } from "../../helpers/calendarHelpers";
import useUserInformation from "../../../../../../hooks/useUserInformation";

/**
 * Handle para el guardado de los appointments
 *
 * @param {*} values Valores del formulario
 * @param {*} mode false - creació / true - editar
 */
export const useHandleAppointment = ({
    idCase,
    mode,
    mutate,
    setIdEvento,
    setVisualMode,
}) => {
    const { user } = useUserInformation();
    return useCallback(
        (values) => {
            values.group_id = user?.selectedGroup;
            let url, idSend, dataPost;

            if (values.is_reschedule) {
                const { id, ...newvalues } = values;
                idSend = id;
                url = `${APPOINTMENT_SERVICES}/${id}${RE_SCHEDULER_SERVICES}`;
                dataPost = formatDataBeforePost(newvalues, null, idCase);
            } else {
                const { id } = values;
                idSend = id;
                url = mode
                    ? `${APPOINTMENT_SERVICES}/${id}`
                    : `${APPOINTMENT_SERVICES}`;
                dataPost = formatDataBeforePost(values, id, idCase);
            }

            dataPost.end_time =
                parseISODate(dataPost.end_time) || dataPost.end_time;
            dataPost.start_time =
                parseISODate(dataPost.start_time) || dataPost.start_time;

            mutate(
                { idSend, url, dataPost },
                {
                    onSuccess: () => {
                        setIdEvento(null);
                        setVisualMode(true);
                    },
                },
            );
        },
        [mode, idCase, mutate, parseISODate],
    );
};
