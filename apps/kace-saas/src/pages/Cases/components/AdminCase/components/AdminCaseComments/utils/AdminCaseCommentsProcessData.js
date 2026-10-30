const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
    };
};

const formatTextContent = (text) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    return tempDiv.textContent || tempDiv.innerText;
};

export const AdminCaseCommentsProcessData = (data) => {
    return (data?.data || []).map((item) => ({
        ...item,
        created_at: formatDateTime(item.created_at),
        descripcion: formatTextContent(item.descripcion),
    }));
};
