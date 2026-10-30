/**
 * SSOT for the numeric ranges of `settings.behaviors` fields that are validated
 * on both the backend (Behaviors domain) and the frontend (General Setup form
 * Joi schema, input min/max attributes and hint copy).
 *
 * Keep this file dependency-free so the frontend can import it directly.
 */

/**
 * `application.admin.users.active_session_limit` and
 * `application.agente.casos.assignment_active_session_limit` (minutes).
 * `min` is 1, not 0: every consumer of these fields (KnexGroupsRepository,
 * AssignationService) treats a non-positive value as "unset" and falls back
 * to the default of 2, so 0 is not a usable "disable the filter" value.
 */
export const ACTIVE_SESSION_LIMIT_RANGE = { min: 1, max: 60 };

/** `application.admin.reports.report_filter_days` (days). */
export const REPORT_FILTER_DAYS_RANGE = { min: 1, max: 30 };
