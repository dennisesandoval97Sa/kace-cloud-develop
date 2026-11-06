import { useState } from "react";
import PropTypes from "prop-types";
import Joi from "joi";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

const schema = Joi.object({
    title: Joi.string().trim().min(1).max(100).required(),
    url: Joi.string()
        .trim()
        .max(500)
        .uri({ scheme: ["http", "https"] })
        .required(),
    position: Joi.number().integer().min(0).optional(),
});

const defaultValues = { title: "", url: "", position: "" };

const resolveQuickLink = async (data) => {
    const normalized = {
        title: data.title?.trim() ?? "",
        url: data.url?.trim() ?? "",
        ...(data.position === "" || data.position == null ? {} : { position: Number(data.position) }),
    };
    const { error, value } = schema.validate(normalized, { abortEarly: false });
    if (!error) return { values: value, errors: {} };

    const errors = {};
    for (const detail of error.details) {
        const name = String(detail.path[0]);
        if (!errors[name]) errors[name] = { type: detail.type, message: detail.message };
    }
    return { values: {}, errors };
};

const QuickLinkForm = ({ onSubmit, isPending, onCancel }) => {
    const { t } = useTranslation();
    const [submitError, setSubmitError] = useState("");
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({ defaultValues, resolver: resolveQuickLink });

    const submit = async (values) => {
        setSubmitError("");
        try {
            await onSubmit(values);
            reset(defaultValues);
        } catch (error) {
            setSubmitError(error?.response?.data?.message ?? t("quick_links.createError"));
        }
    };

    const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900";
    const labelError = (fieldName) => {
        if (!errors[fieldName]) return null;
        const messageKey =
            fieldName === "title"
                ? errors.title.type === "string.max"
                    ? "titleMax"
                    : "titleRequired"
                : fieldName === "url"
                  ? errors.url.type === "any.required" || errors.url.type === "string.empty"
                      ? "urlRequired"
                      : "urlInvalid"
                  : "positionInvalid";
        return (
            <p role="alert" className="text-red-700">
                {t(`quick_links.${messageKey}`)}
            </p>
        );
    };

    return (
        <form
            onSubmit={handleSubmit(submit)}
            className="space-y-4 rounded-lg border border-slate-200 p-4"
            aria-label={t("quick_links.formTitle")}
        >
            <h2 className="text-lg font-semibold">{t("quick_links.formTitle")}</h2>
            <label className="block">
                {t("quick_links.title")} *
                <input className={field} maxLength={100} {...register("title")} />
                {labelError("title")}
            </label>
            <label className="block">
                {t("quick_links.url")} *
                <input className={field} type="text" maxLength={500} {...register("url")} />
                {labelError("url")}
            </label>
            <label className="block">
                {t("quick_links.position")}
                <input className={field} type="number" min={0} step={1} {...register("position")} />
                {labelError("position")}
            </label>
            {submitError && (
                <p role="alert" className="text-red-700">
                    {submitError}
                </p>
            )}
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-60"
                >
                    {isPending ? t("quick_links.saving") : t("quick_links.save")}
                </button>
                <button type="button" onClick={onCancel} className="rounded border px-4 py-2">
                    {t("quick_links.cancel")}
                </button>
            </div>
        </form>
    );
};

QuickLinkForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
    isPending: PropTypes.bool.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export default QuickLinkForm;
