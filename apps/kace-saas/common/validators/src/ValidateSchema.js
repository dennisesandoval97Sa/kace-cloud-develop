export const ValidateSchema = (payload, schema) => {
    if (!payload) {
        return {
            error: true,
            message: "Payload is required",
        };
    }

    const { error, value } = schema.validate(payload);

    if (error) {
        return {
            error: true,
            message: error.details[0].message,
        };
    }

    return value;
};
