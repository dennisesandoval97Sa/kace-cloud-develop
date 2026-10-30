export const formatClientData = (data = {}) => {
    return Object.fromEntries(
        Object.entries(data).map(([key, value]) => {
            if (key === "fecha_nacimiento" && value) {
                return [key, new Date(value).toISOString().split("T")[0]];
            }
            return [key, value ?? ""];
        }),
    );
};
