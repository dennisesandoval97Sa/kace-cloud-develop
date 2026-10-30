import { useRef, useEffect, useState } from "react";

export const useCalendarRefs = () => {
    const calendarRef = useRef(null);
    const [calendarApi, setCalendarApi] = useState(null);

    useEffect(() => {
        if (calendarRef.current) {
            setCalendarApi(calendarRef.current.getApi());
        }
    }, [calendarRef]);

    return { calendarRef, calendarApi };
};
