import Joi from "joi";
import { CommentsCreateSchema } from "./CommentSchema.js";
import { validationSameDayFormik } from "../utils/src/helpers.js";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import { CLOSE_REASON_MAX_LENGTH, CLOSE_REASON_MIN_LENGTH } from "../constants/closeReason";

export const caseReclassifySchema = Joi.object({
    clasificacion_id: JoiHelper.uuid()
        .required()
        .messages({ "any.required": "Debe seleccionar los niveles de clasificación" }),
    transicion_id: JoiHelper.uuid().required().messages({ "any.required": "Debe seleccionar un estado" }),
    comment: CommentsCreateSchema.optional(),
    grupo_id: JoiHelper.uuid().allow(""),
    responsable_id: JoiHelper.uuid().allow(""),
}).strict();

export const caseCloseSchema = Joi.object({
    motivo_baja: JoiHelper.legacyText({ min: CLOSE_REASON_MIN_LENGTH, max: CLOSE_REASON_MAX_LENGTH })
        .required()
        .messages({
            "string.empty": "closeReasonRequired",
            "any.required": "closeReasonRequired",
        }),
}).strict();

export const casoCreateSchemaForm = Joi.object({
    clasificacion_id: JoiHelper.uuid()
        .required()
        .messages({ "any.required": "Debe seleccionar los niveles de clasificación" }),
    transicion_id: JoiHelper.uuid().required().messages({ "any.required": "Debe seleccionar un estado" }),
}).strict();

export const caseCloneSchemaForm = Joi.object({
    stateId: JoiHelper.uuid().required(),
    description: JoiHelper.legacyText({ min: 3, max: 500 }).required(),
}).strict();

export const casoReassignSchemaForm = Joi.object({
    tipo: JoiHelper.legacyText().required(),
    usuario_id: Joi.when("tipo", {
        is: "2",
        then: JoiHelper.uuid().required(),
        otherwise: JoiHelper.uuid().allow("").optional(),
    }),
    grupo_id: JoiHelper.uuid().required(),
}).strict();

export const reOpenCaseSchema = Joi.object({
    transicion_id: JoiHelper.uuid().required(),
    descripcion: JoiHelper.legacyText({ min: 3, max: 5000 }).required(),
}).strict();

export const changeStateCaseSchema = Joi.object({
    transicion_id: JoiHelper.uuid().required(),
}).strict();

export const casoCalendar = Joi.object({
    id: Joi.string().uuid().allow(null),
    agenda_id: Joi.string().required(),
    mode: Joi.boolean().required(),
    date: Joi.string().when("mode", {
        is: false,
        then: Joi.custom((value, helpers) => {
            if (validationSameDayFormik(value)) {
                return helpers.message("La fecha debe ser igual o mayor a la actual");
            } else {
                return value;
            }
        })
            .required()
            .messages({
                "any.required": "La fecha es requerida",
            }),
        otherwise: Joi.optional(),
    }),
    date_end: Joi.string().when("mode", {
        is: false,
        then: Joi.custom((value, helpers) => {
            if (validationSameDayFormik(value)) {
                return helpers.message("La fecha debe ser igual o mayor a la actual");
            } else {
                return value;
            }
        })
            .required()
            .messages({
                "any.required": "La fecha es requerida",
            }),
        otherwise: Joi.optional(),
    }),
    start_time: Joi.string()
        .required()
        .when("mode", {
            is: false,
            then: Joi.custom((value, helpers) => {
                const { date } = helpers.state.ancestors[0];
                const currentDate = new Date();
                const inputDate = new Date(`${date}T00:00:00`);
                const inputStartTime = new Date(inputDate);
                const [hours, minutes] = value.split(":").map(Number);
                inputStartTime.setHours(hours, minutes, 0, 0);

                if (inputDate.toDateString() === currentDate.toDateString() && inputStartTime < currentDate) {
                    return helpers.message("La hora de inicio debe ser mayor a la hora actual");
                }

                return value;
            }),
            otherwise: Joi.optional(),
        }),
    end_time: Joi.string()
        .required()
        .when("mode", {
            is: false,
            then: Joi.custom((value, helpers) => {
                const { date, start_time: start } = helpers.state.ancestors[0];
                const inputDate = new Date(`${date}T00:00:00`);
                const [startHours, startMinutes] = start.split(":").map(Number);
                const startTime = new Date(inputDate);
                startTime.setHours(startHours, startMinutes, 0, 0);

                const [endHours, endMinutes] = value.split(":").map(Number);
                const endTime = new Date(inputDate);
                endTime.setHours(endHours, endMinutes, 0, 0);
                if (endTime <= startTime) {
                    return helpers.message("La hora de fin debe ser mayor que la hora de inicio");
                }

                return value;
            }),
            otherwise: Joi.optional(),
        }),
    fecha_anterior: Joi.string(),
    departamento: JoiHelper.legacyText().required(),
    ciudad: JoiHelper.legacyText().required(),
    barrio: JoiHelper.legacyText({ max: 100 }).required(),
    direccion: JoiHelper.legacyText({ max: 150 }).required(),
    punto_referencia: JoiHelper.legacyText({ max: 200 }),
    is_canceled: Joi.boolean().required(),
    allDay: Joi.boolean().required(),
});

export const closeReasonFormikJoiOptions = { abortEarly: false, allowUnknown: true, convert: false };

export const createBoardCasesBulkCloseSchema = () =>
    Joi.object({
        close_reason: JoiHelper.legacyText({ min: CLOSE_REASON_MIN_LENGTH, max: CLOSE_REASON_MAX_LENGTH })
            .required()
            .messages({
                "string.empty": "closeReasonRequired",
                "any.required": "closeReasonRequired",
            }),
    }).strict();
