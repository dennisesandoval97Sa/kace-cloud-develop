import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const ScheduleDayCreateSchema = Joi.object({
    id: JoiHelper.uuid(),
    dia_semana: JoiHelper.onlyLetters({ min: 5, max: 100 }),
    es_laboral: JoiHelper.boolean().required(),
    hora_inicio_jornada: JoiHelper.timeHHMM().required(),
    hora_fin_jornada: JoiHelper.timeHHMM().required(),
    horario_id: JoiHelper.uuid(),
    status: JoiHelper.integer(),
}).strict();

export const ScheduleDayUpdateSchema = Joi.object({
    es_laboral: JoiHelper.boolean(),
    hora_inicio_jornada: JoiHelper.timeHHMM(),
    hora_fin_jornada: JoiHelper.timeHHMM(),
    status: JoiHelper.integer(),
}).strict();
