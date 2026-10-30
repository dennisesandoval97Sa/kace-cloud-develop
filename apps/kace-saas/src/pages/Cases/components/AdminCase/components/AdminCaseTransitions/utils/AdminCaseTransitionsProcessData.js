const formatDateTime = (isoString) => {
    if (!isoString) return { date: null, time: null };
    const date = new Date(isoString);
    const optionsDate = { year: "numeric", month: "long", day: "numeric" };
    const formattedDate = date.toLocaleDateString(undefined, optionsDate);
    const optionsTime = {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    };
    const formattedTime = date.toLocaleTimeString(undefined, optionsTime);
    return { date: formattedDate, time: formattedTime };
};

const resolveTransitionDate = (item, isFirst, caseCreatedAt) => {
    return item?.fecha_transicion ?? (isFirst ? caseCreatedAt : null) ?? null;
};

export const AdminCaseTransitionsProcessData = (data, creatorData, caseCreatedAt) => {
    if (!data || !Array.isArray(data) || data?.length === 0) {
        return [];
    }

    const processedData = data.map((item, index) => {
        const isFirstTransition = index === data.length - 1;
        const fechaSource = resolveTransitionDate(item, isFirstTransition, caseCreatedAt);

        return {
            ...item,
            fecha: formatDateTime(fechaSource),
            creador: isFirstTransition && creatorData ? creatorData : null,
            /*
             * Las transiciones anteriores a AUD-1b no traen estos campos: se normalizan aquí para
             * que la vista no tenga que distinguir "no fue reclasificación" de "no se sabe".
             */
            es_reclasificacion: item?.es_reclasificacion === true,
            motivo_reclasificacion: item?.motivo_reclasificacion ?? null,
        };
    });

    return processedData;
};
