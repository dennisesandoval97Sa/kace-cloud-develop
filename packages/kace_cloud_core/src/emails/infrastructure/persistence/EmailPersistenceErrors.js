const SQLITE_UNIQUE_CONSTRAINT_PATTERN = /SQLITE_CONSTRAINT.*(?:UNIQUE|PRIMARY KEY) constraint failed/i;
const POSTGRES_UNIQUE_VIOLATION = '23505';

export const isUniqueViolation = (error) => {
    if (!error) {
        return false;
    }

    if (String(error.code) === POSTGRES_UNIQUE_VIOLATION) {
        return true;
    }

    return SQLITE_UNIQUE_CONSTRAINT_PATTERN.test(String(error.message ?? ''));
};
