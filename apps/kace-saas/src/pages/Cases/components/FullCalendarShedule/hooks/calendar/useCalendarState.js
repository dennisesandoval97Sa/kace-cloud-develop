import { useCallback, useEffect, useState } from "react";

export const useCalendarState = ({ selectedShedule, idEvento }) => {
    const [availableCustomTitle, setAvailableCustomTitle] = useState(false);
    const [availableForm, setAvailableForm] = useState(false);
    const [visualMode, setVisualMode] = useState(true);
    const [mode, setMode] = useState(false);
    const [idEventoState, setIdEvento] = useState(idEvento);

    const [dateTime, setDateTime] = useState({
        mode,
        id: null,
        start: { date: "", time: "" },
        end: { date: "", time: "" },
        diary: "",
        custom_fields: {
            data: {},
            metadata: {},
        },
    });

    const activeForm = useCallback((mode = true) => {
        setAvailableForm(mode);
    }, []);

    useEffect(() => {
        setAvailableCustomTitle(false);
        if (!idEventoState) {
            activeForm(false);
        }
    }, [visualMode, idEventoState, selectedShedule]);

    return {
        mode,
        dateTime,
        visualMode,
        availableCustomTitle,
        availableForm,
        setVisualMode,
        setAvailableForm,
        setAvailableCustomTitle,
        activeForm,
        setMode,
        setIdEvento,
        setDateTime,
    };
};
