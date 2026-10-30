import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

export const TemplatesCreateSchema = Joi.object({
    id: JoiHelper.uuid(),
    tipo: JoiHelper.integer().required(),
    descripcion: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    destinatario: JoiHelper.emailList().required(),
    copia: JoiHelper.emailList(),
    copia_oculta: JoiHelper.emailList(),
    asunto: JoiHelper.legacyText({ max: 150 }).required(),
    cuerpo: JoiHelper.htmlText({ max: 30000 }).required(),
    ruta: JoiHelper.legacyText({ max: 1000 }).allow(null, ""),
    incluye_adjuntos: JoiHelper.boolean(),
    enviar_adjuntos_del_caso: JoiHelper.boolean(),
    status: JoiHelper.integer().required(),
});
