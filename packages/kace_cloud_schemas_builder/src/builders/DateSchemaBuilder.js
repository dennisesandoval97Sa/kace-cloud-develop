import Joi from 'joi';
import DependencyHelper from './DependencyHelper.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const ISO_WITH_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/;
const ISO_WITHOUT_TZ_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?$/;

class DateSchemaBuilder {
    static build(dto) {
        if (dto.timezoneFormat === 'withTimezone') {
            return this.buildWithTimezoneRequired(dto);
        }

        if (dto.timezoneFormat === 'withoutTimezone' && dto.timezone) {
            return this.buildWithoutTimezoneInInput(dto);
        }

        // Legacy: existing logic for dates without timezone config
        let schema = Joi.date();
        try {
            if (dto.iso) schema = schema.iso();
            if (dto.timestamp) schema = schema.timestamp(dto.timestamp);

            const convertToTimestamp = (val) => {
                if (val === 'now') return 'now';
                const date = new Date(val);
                if (isNaN(date.getTime())) return undefined;

                if (dto.timestamp === 'unix') {
                    return Math.floor(date.getTime() / 1000);
                } else if (dto.timestamp === 'javascript') {
                    return date.getTime();
                } else {
                    return val;
                }
            };

            const isValidDateValue = (val) => {
                if (val === 'now') return true;
                if (typeof val === 'number') return Number.isFinite(val);
                if (typeof val === 'string' || val instanceof Date) {
                    const d = new Date(val);
                    return !isNaN(d.getTime());
                }
                return false;
            };

            const applyRule = (method, value) => {
                try {
                    const parsed = dto.timestamp ? convertToTimestamp(value) : value;
                    if (parsed !== undefined && parsed !== 'now' && isValidDateValue(parsed)) {
                        schema = schema[method](parsed);
                    }
                } catch (e) {
                    // SONAR-EXC: NODEJS No expone logs porque es server-side
                    console.log(`DateSchemaBuilder::build [${method}]`, dto, e);
                }
            };

            applyRule('min', dto.min);
            applyRule('max', dto.max);
            applyRule('greater', dto.greater);
            applyRule('less', dto.less);

            if (dto.default !== undefined) {
                try {
                    if (dto.default === 'now') {
                        schema = schema.default(() => {
                            const now = new Date();
                            if (dto.timestamp === 'unix') return Math.floor(now.getTime() / 1000);
                            if (dto.timestamp === 'javascript') return now.getTime();
                            return now.toISOString();
                        });
                    } else {
                        const parsed = dto.timestamp ? convertToTimestamp(dto.default) : dto.default;
                        if (parsed !== undefined) {
                            schema = schema.default(parsed);
                        }
                    }
                } catch (e) {
                    // SONAR-EXC: NODEJS No expone logs porque es server-side
                    console.log(`DateSchemaBuilder::build [default]`, dto, e);
                }
            }

            if (dto.restflow_id) schema = Joi.string().uuid();

            if ((dto.min === 'now' || dto.max === 'now') && (dto.min !== undefined || dto.max !== undefined)) {
                const getNowSchema = () => {
                    let nextSchema = schema;
                    if (dto.min === 'now') nextSchema = nextSchema.min('now');
                    else if (dto.min !== undefined && isValidDateValue(dto.min)) nextSchema = nextSchema.min(dto.min);
                    if (dto.max === 'now') nextSchema = nextSchema.max('now');
                    else if (dto.max !== undefined && isValidDateValue(dto.max)) nextSchema = nextSchema.max(dto.max);
                    return nextSchema;
                };

                schema = schema.when(Joi.ref('$isUpdate'), {
                    is: true,
                    then: schema,
                    otherwise: getNowSchema(),
                });
            }
        } catch (e) {
            // SONAR-EXC: NODEJS No expone logs porque es server-side
            console.log(`DateSchemaBuilder::build`, dto, e);
        }

        return DependencyHelper.applyConditionalRequired(schema, dto);
    }

    static buildWithTimezoneRequired(dto) {
        let schema = Joi.string().pattern(ISO_WITH_TZ_REGEX, 'ISO 8601 with timezone');

        try {
            schema = schema.custom((value, helpers) => {
                const parsed = dayjs(value);
                if (!parsed.isValid()) {
                    return helpers.error('any.invalid');
                }

                // Apply date constraints before potential timestamp conversion
                if (dto.min) {
                    const minDate = dto.min === 'now' ? dayjs() : dayjs(dto.min);
                    if (parsed.isBefore(minDate)) {
                        return helpers.error('any.invalid');
                    }
                }

                if (dto.max) {
                    const maxDate = dto.max === 'now' ? dayjs() : dayjs(dto.max);
                    if (parsed.isAfter(maxDate)) {
                        return helpers.error('any.invalid');
                    }
                }

                if (dto.greater) {
                    const greaterDate = dto.greater === 'now' ? dayjs() : dayjs(dto.greater);
                    if (!parsed.isAfter(greaterDate)) {
                        return helpers.error('any.invalid');
                    }
                }

                if (dto.less) {
                    const lessDate = dto.less === 'now' ? dayjs() : dayjs(dto.less);
                    if (!parsed.isBefore(lessDate)) {
                        return helpers.error('any.invalid');
                    }
                }

                // Convert to timestamp if configured
                if (dto.timestamp === 'unix') {
                    return Math.floor(parsed.valueOf() / 1000);
                } else if (dto.timestamp === 'javascript') {
                    return parsed.valueOf();
                }

                return value;
            });

            if (dto.default !== undefined) {
                if (dto.default === 'now') {
                    schema = schema.default(() => {
                        const now = dayjs();
                        if (dto.timestamp === 'unix') return Math.floor(now.valueOf() / 1000);
                        if (dto.timestamp === 'javascript') return now.valueOf();
                        return now.toISOString();
                    });
                } else {
                    if (dto.timestamp === 'unix') {
                        schema = schema.default(Math.floor(dayjs(dto.default).valueOf() / 1000));
                    } else if (dto.timestamp === 'javascript') {
                        schema = schema.default(dayjs(dto.default).valueOf());
                    } else {
                        schema = schema.default(dto.default);
                    }
                }
            }

            if (dto.restflow_id) schema = Joi.string().uuid();
        } catch (e) {
            console.log(`DateSchemaBuilder::buildWithTimezoneRequired`, dto, e);
        }

        return DependencyHelper.applyConditionalRequired(schema, dto);
    }

    static buildWithoutTimezoneInInput(dto) {
        let schema = Joi.string().pattern(ISO_WITHOUT_TZ_REGEX, 'ISO 8601 without timezone');

        try {
            schema = schema.custom((value, helpers) => {
                const withTimezone = dayjs.tz(value, dto.timezone);
                if (!withTimezone.isValid()) {
                    return helpers.error('any.invalid');
                }

                const isoValue = withTimezone.toISOString();

                // Apply date constraints
                if (dto.min) {
                    const minDate = dto.min === 'now' ? dayjs() : dayjs(dto.min);
                    if (withTimezone.isBefore(minDate)) {
                        return helpers.error('any.invalid');
                    }
                }

                if (dto.max) {
                    const maxDate = dto.max === 'now' ? dayjs() : dayjs(dto.max);
                    if (withTimezone.isAfter(maxDate)) {
                        return helpers.error('any.invalid');
                    }
                }

                if (dto.greater) {
                    const greaterDate = dto.greater === 'now' ? dayjs() : dayjs(dto.greater);
                    if (!withTimezone.isAfter(greaterDate)) {
                        return helpers.error('any.invalid');
                    }
                }

                if (dto.less) {
                    const lessDate = dto.less === 'now' ? dayjs() : dayjs(dto.less);
                    if (!withTimezone.isBefore(lessDate)) {
                        return helpers.error('any.invalid');
                    }
                }

                // Convert to timestamp if configured
                if (dto.timestamp === 'unix') {
                    return Math.floor(withTimezone.valueOf() / 1000);
                } else if (dto.timestamp === 'javascript') {
                    return withTimezone.valueOf();
                }

                return isoValue;
            });

            if (dto.default !== undefined) {
                if (dto.default === 'now') {
                    schema = schema.default(() => {
                        const now = dayjs().tz(dto.timezone);
                        if (dto.timestamp === 'unix') return Math.floor(now.valueOf() / 1000);
                        if (dto.timestamp === 'javascript') return now.valueOf();
                        return now.toISOString();
                    });
                } else {
                    const d = dayjs.tz(dto.default, dto.timezone);
                    if (dto.timestamp === 'unix') schema = schema.default(Math.floor(d.valueOf() / 1000));
                    else if (dto.timestamp === 'javascript') schema = schema.default(d.valueOf());
                    else schema = schema.default(d.toISOString());
                }
            }

            if (dto.restflow_id) schema = Joi.string().uuid();
        } catch (e) {
            console.log(`DateSchemaBuilder::buildWithoutTimezoneInInput`, dto, e);
        }

        return DependencyHelper.applyConditionalRequired(schema, dto);
    }
}

export default DateSchemaBuilder;
