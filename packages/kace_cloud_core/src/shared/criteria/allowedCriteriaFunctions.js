export const ALLOWED_CRITERIA_FUNCTIONS = {
    aggregate_functions: {
        COUNT: 'count',
        SUM: 'sum',
        AVG: 'avg',
        MIN: 'min',
        MAX: 'max',
    },
    compartion_functions: {
        DATE_DIFFERENCE: 'date_difference',
    },
    concat_functions: {
        CONCAT: 'concat',
    },
    conditional_functions: {
        DATE_CALCULATED_ADD: 'date_calculated_add',
        DATE_CALCULATED_SUBTRACT: 'date_calculated_substract',
        LOGGED_IN_USER: 'logged_in_user',
        LOGGED_IN_USER_GROUP: 'logged_in_user_group',
        ACTIVE_CLIENT: 'active_client',
        RECENT_DATE: 'recent_date',
    },
};
