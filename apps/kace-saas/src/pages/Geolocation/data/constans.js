export const HEADER_GEOLOCATION = [
    { key: "created_at", value: "string", header: "Creado" },
    { key: "action_type", value: "string", header: "Tipo acción" },
    { key: "ip4_address", header: "Ip" },
    { key: "Name", value: "string", header: "Nombre" },
    { key: "latitud", value: "string", header: "Latitud", isVisible: false },
    { key: "longitud", value: "string", header: "Longitud", isVisible: false },
];

export const QUERY_KEY_GEOLOCATION = "filterGeolocation";
export const NAME_TABLE_GEOLOCATION = {
    table: "geolocation",
};

export const INITIAL_VALUES_GEOLOCATION = { latitude: 0, longitude: 0 };
export const AWS_LOCATION_APIKEY = import.meta.env.VITE_AWS_LOCATION_APIKEY;
export const AWS_LOCATION_REGION = import.meta.env.VITE_AWS_LOCATION_REGION;
export const AWS_LOCATION_NAMEMAP = import.meta.env.VITE_AWS_LOCATION_NAMEMAP;
