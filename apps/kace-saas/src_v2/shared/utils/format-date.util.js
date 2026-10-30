export const formatDate = (date, pattern) => {
    const d = new Date(date);
    if (isNaN(d)) return "";

    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    const SS = String(d.getSeconds()).padStart(2, "0");

    switch (pattern) {
        // --- FECHAS ---
        case "YYYY/MM/DD":
            return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

        case "DD/MM/YY":
            return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;

        case "MM/DD/YYYY":
            return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

        case "DD-MM-YYYY":
            return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

        case "MMM DD, YYYY":
            return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

        // --- FECHA + HORA ---
        case "YYYY/MM/DD HH:MM:SS":
            return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${HH}:${MM}:${SS}`;

        case "DD/MM/YY HH:MM:SS":
            return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)} ${HH}:${MM}:${SS}`;

        case "MM/DD/YYYY HH:MM:SS":
            return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()} ${HH}:${MM}:${SS}`;

        case "DD-MM-YYYY HH:MM:SS":
            return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()} ${HH}:${MM}:${SS}`;

        case "MMM DD, YYYY HH:MM:SS":
            return `${d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })} ${HH}:${MM}:${SS}`;

        default:
            return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${HH}:${MM}:${SS}`;
    }
};
