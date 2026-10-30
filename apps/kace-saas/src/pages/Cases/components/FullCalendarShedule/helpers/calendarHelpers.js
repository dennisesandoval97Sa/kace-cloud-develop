export const parseISODate = (timeString) => {
    if (!timeString) return null;
    const date = new Date(`${timeString}:00`);
    return isNaN(date.getTime()) ? null : date.toISOString();
};

export const formatNewEvent = (data) => {
    const newEvents = data?.data?.map((item) => ({
        id_event: item.id,
        case_id: item.case_id,
        start: new Date(item.start_time.slice(0, -5)),
        end: new Date(item.end_time.slice(0, -5)),
        agenda_id: item.agenda_id,
        custom_fields: item.custom_fields,
        is_completed: item.is_completed,
        is_canceled: item.is_canceled,
        assigned_to: item.assigned_to,
    }));
    return newEvents;
};
