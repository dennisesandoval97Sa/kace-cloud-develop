export const filterAgendaToGroup = (agendaId) => {
    return [
        {
            field: "agenda_id",
            operator: "eq",
            value: agendaId,
            type: "AND",
        },
    ];
};
