import Joi from 'joi';

export const createSchema = Joi.object({
    targetTable: Joi.string().required(),
    presignedUrl: Joi.string()
        .uri()
        .pattern(
            /^https:\/\/[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com\/.+\?.*X-Amz-Algorithm=AWS4-HMAC-SHA256.*X-Amz-Credential=.*X-Amz-Date=.*X-Amz-Expires=.*X-Amz-Signature=.*X-Amz-SignedHeaders=.*/
        )
        .message('La URL no es un AWS Presigned URL válido')
        .required(),
    actionType: Joi.string().valid('IMPORT', 'DELETE').optional(),
    shouldOverrideArray: Joi.boolean().optional(),
});
