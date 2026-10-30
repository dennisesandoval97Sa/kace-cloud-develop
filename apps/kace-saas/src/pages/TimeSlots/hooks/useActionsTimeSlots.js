import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TIME_SLOT_SERVICE } from "@kace/urls";
import usePermissionsUser from "@kace/hooks/usePermissionsUser";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGeneralDelete from "@kace/hooks/useGeneralDelete";

const useActionsTimeSlots = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.timeSlots.key,
    });

    const handleUpdateTimeSlots = (id) => {
        navigate(`${TIME_SLOT_SERVICE}/update/${id}`, {
            state: { see: true },
        });
    };

    const handleSeeTimeSlots = (id) => {
        navigate(`${TIME_SLOT_SERVICE}/update/${id}?action=see`, {
            state: { see: false },
        });
    };

    const handleDeleteTimeSlots = (id) => {
        deleteAction({ id, url: URL_AND_KEYS.timeSlots.url });
    };

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "appointment-time-slots",
        actions: [
            {
                name: "AppointmentTimeSlotsUpdate",
                label: `${t("app.forms.edit")}`,
                handler: handleUpdateTimeSlots,
            },
            {
                name: "AppointmentTimeSlotsDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteTimeSlots,
            },
            {
                name: "AppointmentTimeSlotsRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeTimeSlots,
            },
        ],
        nameCreate: "AppointmentTimeSlotsCreate",
    });

    return {
        arrayAction,
        canBeCreate,
    };
};

export default useActionsTimeSlots;
