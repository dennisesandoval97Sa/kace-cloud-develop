import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import {
    OVERFLOW_POLICIES,
    RESET_POLICIES,
} from "@kace/core/src/folio-configurations/domain/segments/segmentCatalog.js";

/**
 * Form-level validation only. The segment list is validated by SegmentBuilder before
 * submit and, authoritatively, by the API and the domain aggregate.
 */
export const FolioConfigurationSchemaForm = Joi.object({
    nombre: JoiHelper.legacyText({ min: 3, max: 255 }).required(),
    descripcion: JoiHelper.legacyText({ min: 0, max: 500 }).allow("", null),
    start_value: Joi.number().integer().min(0).required(),
    reset_policy: Joi.string()
        .valid(...RESET_POLICIES)
        .required(),
    overflow_policy: Joi.string()
        .valid(...OVERFLOW_POLICIES)
        .required(),
    segments: Joi.array().min(1).required(),
}).strict();
