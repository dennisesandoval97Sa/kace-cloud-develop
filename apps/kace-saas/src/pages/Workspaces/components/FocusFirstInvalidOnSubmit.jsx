import { useEffect, useRef } from "react";
import { PropTypes } from "prop-types";
import { useFormikContext } from "formik";

/*
 * Per-field override for controls that do not expose `name` or `id` matching the Formik key.
 * ui-shared/MultiSelect only renders the trigger with `data-testid=trigger_multiselect_<nameTesting>`.
 */
const FOCUS_TARGET_SELECTORS = {
    channel_hub_accounts: '[data-testid="trigger_multiselect_channelHubAccounts"]',
};

/*
 * Moves the focus to the first invalid control once a submit attempt is blocked by validation.
 * Rule cells already emit `aria-invalid="true"`, but the shared inputs (description, tag) and
 * MultiSelectChannelHubAccounts do not — when the error lives there, fall back to the first
 * Formik error key by name or id (ui-shared/Input strips the name attribute but forwards id),
 * or to a per-field override for controls that expose neither.
 */
export const FocusFirstInvalidOnSubmit = ({ formRef }) => {
    const { isSubmitting, isValid, errors } = useFormikContext();
    const wasSubmitting = useRef(false);
    const errorsRef = useRef(errors);

    useEffect(() => {
        errorsRef.current = errors;
    }, [errors]);

    useEffect(() => {
        const submitFinished = wasSubmitting.current && !isSubmitting;
        wasSubmitting.current = isSubmitting;
        if (!submitFinished || isValid) return;

        const root = formRef.current;
        if (!root) return;

        const [firstErrorKey] = Object.keys(errorsRef.current ?? {});
        const fallbackSelector = firstErrorKey
            ? (FOCUS_TARGET_SELECTORS[firstErrorKey] ?? `[name="${firstErrorKey}"], [id="${firstErrorKey}"]`)
            : null;
        const target =
            root.querySelector('[aria-invalid="true"]') ??
            (fallbackSelector ? root.querySelector(fallbackSelector) : null);
        target?.focus();
    }, [formRef, isSubmitting, isValid]);

    return null;
};
FocusFirstInvalidOnSubmit.propTypes = {
    formRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }).isRequired,
};
