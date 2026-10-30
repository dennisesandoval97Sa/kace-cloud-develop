import { daysMapping, daysOfWeek } from "./data/Constants";
import { removeKey } from "@kace/utils";
import { Uuid } from "@kace/plugins";
import { format } from "date-fns";
import useUserInformation from "../../hooks/useUserInformation";

export function createOptions (array, nivel = 1) {
    const nivelKey = `nivel${nivel}`;
    const groupedByNivel = array.reduce((acc, item) => {
        const nivelValue = item[nivelKey]?.trim();
        if (!nivelValue) return acc;

        if (!acc[nivelValue]) {
            acc[nivelValue] = [];
        }
        acc[nivelValue].push(item);
        return acc;
    }, {});

    return Object.entries(groupedByNivel).map(([label, items]) => {
        const nextNivelKey = `nivel${nivel + 1}`;
        const hasNextNivel = items.some(
            (item) => item[nextNivelKey]?.trim() !== "",
        );
        const options = hasNextNivel ? createOptions(items, nivel + 1) : [];
        const flowId = items.find((item) => item.flujo_id);
        const classificationId = items.find((item) => item.id);
        return {
            label,
            value: label,
            options,
            flujo_id: flowId?.flujo_id,
            clasificacion_id: classificationId?.id,
        };
    }).filter(option => option.label.trim() !== "");
}

/**
 * Método que obtiene la información del usuario almacenada en el local storage
 * @returns
 */
export function getLocalStorageInfoUser () {
    const tokenInfo = JSON.parse(localStorage.getItem("tokens"));
    const { user } = useUserInformation();

    return {
        idUser: user.id,
        idGroup: user.selectedGroup,
        token: tokenInfo,
    };
}

export const formatDataBeforePost = (data, id, caseId) => {
    data = {
        ...data,
        start_time: `${data.date}T${data.start_time}`,
        end_time: `${data.date_end}T${data.end_time}`,
        case_id: caseId,
    };
    const campos = ["barrio", "tipo_agenda", "ciudad", "direccion", "departamento", "fecha_anterior", "punto_referencia"];

    campos.forEach(campo => {
        if (Object.prototype.hasOwnProperty.call(data, campo)) {
            data.custom_fields.data[campo] = data[campo];
            delete data[campo];
        }
    });
    return id
        ? removeKey(data, ["allDay", "date_end", "mode", "id", "is_reschedule"])
        : removeKey({ ...data, id: Uuid() }, ["is_canceled", "allDay", "date_end", "mode", "is_reschedule"]);
};

/**
 * Función para obtener la fecha y hora en formato correcto
 *
 * @param {*} date - Objeto Date
 * @returns
 */
export const getDateInfo = (date) => {
    const strDate = format(date, "yyyy-MM-dd");
    const strTime = date.toLocaleTimeString("es-Es", { hour: "2-digit", minute: "2-digit", hour12: false });

    return {
        date: strDate,
        time: strTime,
    };
};

/**
 * Función para agrupar los horarios de la semana de businessDays
 * según lo necesita la libreria del calendario
 *
 * @param {*} schedule - Horarios laborales de la semana
 */
export const groupSchedules = (schedule) => {
    const grouped = [];

    Object.entries(schedule).forEach(([day, { start, end }]) => {
        const existingGroup = grouped.find(
            (group) => group.startTime === start && group.endTime === end,
        );

        if (existingGroup) {
            existingGroup.daysOfWeek.push(daysMapping[day]);
        } else {
            grouped.push({
                daysOfWeek: [daysMapping[day]],
                startTime: start,
                endTime: end,
            });
        }
    });

    return grouped;
};

/**
 * Función para obtener el horario de un dia especifico
 *
 * @param {*} day - Dia de la semana en entero
 * @returns
 */
export const getBusinessHoursForDay = (day, schedule) => {
    const dayOfWeek = daysOfWeek[day];
    const daySchedule = schedule[dayOfWeek];

    return daySchedule || null;
};

/**
 * Función que convierte la hora y fecha en un objeto Date para ser utilizado
 * en la validación de las businessHours
 * @param {*} timeStr - hora en formato hh:mm
 * @param {*} date - fecha en formato yyyy-MM-dd
 * @returns
 */
export const timeToDate = (timeStr, date) => {
    if (!timeStr || !date) return null;

    return new Date(`${date}T${timeStr}:00`);
};
/**
 * Método que crea los holidays en el calendario
 *
 * @param {*} date - array de fechas
 */
export const createHoliday = (date, title) => {
    const holiday = date.map((d) => {
        return {
            title,
            start: new Date(`${d}T00:00:00`),
            end: new Date(`${d}T23:59:59`),
            backgroundColor: "red",
            holiday: true,
        };
    });

    return holiday;
};

/**
 * Función que formatea las franjas horarias para ser utilizados en el calendario
 * @param {*} slot - franjas horarias
 * @param {*} workDays - dias laborales
 *
 * @returns franjar formateadas
 */
export const formatTimeSlots = (slot, workDays, isWeekend) => {
    const slots = [];

    if (slot.length === 0 || Object.keys(workDays).length === 0) {
        return slots;
    }

    slot.forEach((item) => {
        const startTime = item.start_time.slice(0, 5);
        const endTime = item.end_time.slice(0, 5);

        const minutesForStart = getMinutesForTime(startTime);
        const minutesForEnd = getMinutesForTime(endTime);

        for (const day in workDays) {
            const workday = workDays[day];

            const startWorkDay = getMinutesForTime(workday.start);
            const endWorkDay = getMinutesForTime(workday.end);

            if (minutesForStart >= startWorkDay && minutesForEnd <= endWorkDay) {
                const weekDays = getWeekendDays();
                const dayOfWeek = !isWeekend ? weekDays.week[day] : weekDays.weekend[day];

                if (dayOfWeek) {
                    slots.push({
                        daysOfWeek: [dayOfWeek],
                        title: item.description,
                        startTime: item.start_time,
                        endTime: item.end_time,
                        timeSlot: true,
                        allDay: false,
                    });
                }
            }
        }
    });

    return slots;
};

export const getWeekendDays = () => {
    const { saturday, sunday, ...all } = daysMapping;
    return { weekend: { sunday, saturday }, week: all };
};

/**
 * Método que obtiene los minutos de una hora
 *
 * @param {*} time - hora en formato hh:mm
 * @returns minutos
 */
export const getMinutesForTime = (time) => {
    const [hour, minutes] = time.split(":").map(Number);
    return hour * 60 + minutes;
};
