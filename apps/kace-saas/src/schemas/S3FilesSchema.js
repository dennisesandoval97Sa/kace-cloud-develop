import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";

const commonFileFields = {
    description: JoiHelper.legacyText({ max: 255 }),
    file_name: JoiHelper.legacyText({ max: 100 }),
    s3_file_name: JoiHelper.generalText({ max: 100 }),
    url: JoiHelper.uri(),
    size: JoiHelper.integer().positive(),
    origin: JoiHelper.generalText({ max: 100 }).allow(null),
    expired_at: JoiHelper.date().allow(null),
    is_active: JoiHelper.boolean(),
};

export const S3FileCreateSchema = Joi.object({
    id: JoiHelper.uuid().required(),
    ...commonFileFields,
    description: commonFileFields.description.required(),
    file_name: commonFileFields.file_name.required(),
    s3_file_name: commonFileFields.s3_file_name.required(),
    url: commonFileFields.url.required(),
    size: commonFileFields.size.required(),
    created_by: JoiHelper.uuid().optional(),
}).strict();

export const S3FileUpdateSchema = Joi.object({
    ...commonFileFields,
    updated_by: JoiHelper.uuid().optional(),
}).strict();
