import { t as defaultT } from "i18next";

export const TIME_DESCRIPTION_FIELDS = [
    "antiguedad",
    "remaining_time",
    "sla_elapsed_time",
    "sla_remaining_time",
    "sla_state_elapsed_time",
    "sla_state_remaining_time",
    "state_elapsed_time",
];

const TIME_DESCRIPTION_PREFIXES = [
    "Tiempo laboral transcurrido: ",
    "Remaining time: ",
    "Time elapsed: ",
    "tiempo transcurrido: ",
    "Tiempo restante: ",
];

const EN_REMAINING_RE = /^(?:Remaining time:\s*)?(\d+)\s+days?,\s*(\d+)\s+hours?\s+and\s+(\d+)\s+minutes?$/i;
const ES_ELAPSED_RE = /^(?:Tiempo laboral transcurrido:\s*)?(\d+)\s+días\s*->\s*(\d+)\s+horas\s*->\s*(\d+)\s+minutos$/i;

/**
 * @param {unknown} value
 * @returns {{ days: number, hours: number, minutes: number, kind: 'remaining' | 'elapsed' } | null}
 */
export function parseTimeDescription(value) {
    if (typeof value !== "string" || !value) return null;

    const remaining = value.trim().match(EN_REMAINING_RE);
    if (remaining) {
        return {
            days: Number(remaining[1]),
            hours: Number(remaining[2]),
            minutes: Number(remaining[3]),
            kind: "remaining",
        };
    }

    const elapsed = value.trim().match(ES_ELAPSED_RE);
    if (elapsed) {
        return {
            days: Number(elapsed[1]),
            hours: Number(elapsed[2]),
            minutes: Number(elapsed[3]),
            kind: "elapsed",
        };
    }

    return null;
}

export function stripTimeDescriptionPrefix(value) {
    if (typeof value !== "string") return value;
    for (const prefix of TIME_DESCRIPTION_PREFIXES) {
        if (value.startsWith(prefix)) {
            return value.slice(prefix.length);
        }
    }
    return value;
}

/**
 * @param {unknown} value
 * @param {{ showPrefixes?: boolean, t?: Function }} options
 */
export function formatLocalizedTimeDescription(value, { showPrefixes = true, t = defaultT } = {}) {
    if (typeof value !== "string") return value;

    const parsed = parseTimeDescription(value);
    if (!parsed) {
        return showPrefixes !== false ? value : stripTimeDescriptionPrefix(value);
    }

    const body =
        `${parsed.days}${t("gridMain.text.days")}` +
        `${parsed.hours}${t("gridMain.text.hours")}` +
        `${parsed.minutes}${t("gridMain.text.minutes")}`;

    if (showPrefixes === false) {
        return body.trim();
    }

    const prefixKey = parsed.kind === "remaining" ? "gridMain.text.remainingTime" : "gridMain.text.workingTime";
    return `${t(prefixKey)}${body}`.trimEnd();
}

/**
 * @param {object} row
 * @param {boolean} [showPrefixes=true]
 * @param {Function} [t]
 */
export function applyTimeDescriptionDisplay(row, showPrefixes = true, t = defaultT) {
    if (!row || typeof row !== "object") {
        return row;
    }

    let changed = false;
    const next = { ...row };
    for (const field of TIME_DESCRIPTION_FIELDS) {
        if (!(field in next)) continue;
        const formatted = formatLocalizedTimeDescription(next[field], { showPrefixes, t });
        if (formatted !== next[field]) {
            next[field] = formatted;
            changed = true;
        }
    }
    return changed ? next : row;
}
