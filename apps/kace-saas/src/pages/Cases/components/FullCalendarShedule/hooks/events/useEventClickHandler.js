import { toast } from "sonner";
import { getDateInfo } from "../../../../helpers";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";

export const useEventClickHandler = ({
    businessData,
    setAvailableCustomTitle,
    setMode,
    setDateTime,
    selectedShedule,
    activeForm,
}) => {
    const { t } = useTranslation();

    return useCallback(
        (clickInfo) => {
            if (!clickInfo || !clickInfo.event) {
                return;
            }

            if (clickInfo?.event?.extendedProps?.holiday) return;

            if (!clickInfo.event.start) {
                return;
            }

            const selectDataCase = clickInfo.event.extendedProps?.custom_fields;
            const initialDate = getDateInfo(clickInfo.event.start);
            const finalDate = clickInfo.event.end
                ? getDateInfo(clickInfo.event.end)
                : initialDate;

            if (
                businessData?.holiday_dates?.includes(initialDate?.date) ||
                (finalDate &&
                    businessData?.holiday_dates?.includes(finalDate?.date))
            ) {
                toast.info(t("diary.calendar.holiday.message"));
                return;
            }

            setAvailableCustomTitle(true);

            const isTimeSlotEvent = !!clickInfo.event.extendedProps?.timeSlot;

            const newMode = !isTimeSlotEvent;

            setMode(newMode);

            setDateTime((prev) => ({
                ...prev,
                id: clickInfo.event.extendedProps?.id_event,
                mode: newMode,
                start: initialDate,
                end: finalDate,
                diary: isTimeSlotEvent
                    ? clickInfo.event.extendedProps?.agenda_id
                    : selectedShedule,
                custom_fields: selectDataCase ?? {
                    data: {},
                },
                timeSlot: isTimeSlotEvent ? true : prev.timeSlot,
                ciudad: selectDataCase?.data?.ciudad || "",
                departamento: selectDataCase?.data.departamento || "",
                barrio: selectDataCase?.data?.barrio || "",
                direccion: selectDataCase?.data?.direccion || "",
            }));

            activeForm();
        },
        [
            businessData,
            setAvailableCustomTitle,
            setMode,
            setDateTime,
            selectedShedule,
            activeForm,
        ],
    );
};
