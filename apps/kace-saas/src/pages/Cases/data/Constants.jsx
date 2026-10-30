import { Frown, Angry, Meh, Laugh } from "lucide-react";

export const GENERIC_HEADERS = [
    { key: "reference", value: "number", header: "Consecutivo" },
    { key: "created_at", header: "Fecha creación" },
    { key: "estado_actual", header: "Estado actual" },
    { key: "antiguedad_dias", header: "Antiguedad" },
    { key: "updated_at", header: "Última actualización" },
    { key: "nombres", value: "string", header: "Responsable" },
    { key: "nombre_cliente", value: "string", header: "Cliente" },
    { key: "id", value: "string", header: "Id", isVisible: false },
    { key: "fecha_resolucion", value: "string", header: "Fecha resolución", isVisible: false },
    { key: "ans_posicion", value: "number", header: "Ans posición", isVisible: false },
];

export const HEADERS_CASES_TABLE = [...GENERIC_HEADERS, { key: "nivel1", value: "string", header: "Clasificación" }];

export const initialValuesReassing = {
    tipo: "",
    usuario_id: "",
    grupo_id: "",
};
export const initialValuesReopenCase = {
    id: "",
    descripcion: "",
    transicion_id: "",
};

export const initialValuesChangeStateCase = {
    transicion_id: "",
};

export const initialValuesClone = {
    stateId: "",
    description: "",
};

export const EMOJI_LIST = [
    {
        value: 1,
        icon: (
            <Angry className="max-sm:h-8 max-sm:w-8 w-12 h-12 hover:bg-redCustom hover:stroke-background stroke-redCustom bg-background hover:w-14 hover:h-14 rounded-full ease-out duration-200" />
        ),
        color: "redCustom",
    },
    {
        value: 2,
        icon: (
            <Frown className="max-sm:h-8 max-sm:w-8 w-12 h-12 hover:bg-orangeCustom hover:stroke-background stroke-orangeCustom bg-background hover:w-14 hover:h-14 rounded-full ease-out duration-200" />
        ),
        color: "orangeCustom",
    },
    {
        value: 3,
        icon: (
            <Meh className="max-sm:h-8 max-sm:w-8 w-12 h-12 hover:bg-yellowCustom hover:stroke-background stroke-yellowCustom bg-background hover:w-14 hover:h-14 rounded-full ease-out duration-200" />
        ),
        color: "yellowCustom",
    },
    {
        value: 4,
        icon: (
            <Meh className="max-sm:h-8 max-sm:w-8 w-12 h-12 hover:bg-green-400 hover:stroke-background stroke-green-400 bg-background hover:w-14 hover:h-14 rounded-full ease-out duration-200" />
        ),
        color: "green-400",
    },
    {
        value: 5,
        icon: (
            <Laugh className="max-sm:h-8 max-sm:w-8 w-12 h-12 hover:bg-greenCustom hover:stroke-background stroke-greenCustom bg-background hover:w-14 hover:h-14 rounded-full ease-out duration-200" />
        ),
        color: "greenCustom",
    },
];

export const daysMapping = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
};

export const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const initialValuesAppointment = {
    id: "",
    mode: false,
    agenda_id: "",
    date: "",
    date_end: "",
    start_time: "",
    end_time: "",
    allDay: false,
    is_canceled: false,
    is_reschedule: false,
    fecha_anterior: "",
    tipo_agenda: "",
    ciudad: "",
    departamento: "",
    barrio: "",
    direccion: "",
    punto_referencia: "",
    custom_fields: {
        data: {},
        metadata: {},
    },
};

export const initialValuesClientAux = {
    data: {
        dataKace: {
            token: {},
            aux_client: {},
            aux_case: {},
            last_appointment: {},
        },
    },
};
