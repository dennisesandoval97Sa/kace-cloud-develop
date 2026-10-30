export const FORMATS_TYPE = {
    NUMBER: { "1,234,567.89": "###,###,##0.00", "1,234,568": "###,###,##0", 1234.56: "0.00", 1235: "0" },
    DATE: {
        "YYYY/MM/DD": "YYYY/MM/DD",
        "DD/MM/YY": "DD/MM/YY",
        "MM/DD/YYYY": "MM/DD/YYYY",
        "DD-MM-YYYY": "DD-MM-YYYY",
        "MMM DD, YYYY": "MMM DD, YYYY",
        "YYYY/MM/DD HH:MM:SS": "YYYY/MM/DD HH:MM:SS",
        "DD/MM/YY HH:MM:SS": "DD/MM/YY HH:MM:SS",
        "MM/DD/YYYY HH:MM:SS": "MM/DD/YYYY HH:MM:SS",
        "DD-MM-YYYY HH:MM:SS": "DD-MM-YYYY HH:MM:SS",
        "MMM DD, YYYY HH:MM:SS": "MMM DD, YYYY HH:MM:SS",
    },
};
