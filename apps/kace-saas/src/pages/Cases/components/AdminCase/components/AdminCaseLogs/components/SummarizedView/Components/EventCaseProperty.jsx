import React, { useState } from "react";
import { ChevronDown, ChevronRight, MoveRight } from "lucide-react";
import { MAX_RENDER_DEPTH } from "./EventGroup";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { format, parseISO } from "date-fns";

const isObject = (val) => val !== null && val !== undefined && typeof val === "object";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const DATE_FORMAT = "yyyy-MM-dd HH:mm:ss";

/** Formats a single ISO date string, returning the original value on failure. */
const formatISODate = (isoString) => {
    try {
        const hasMillis = /\.\d+/.test(isoString);
        return format(parseISO(isoString), hasMillis ? "yyyy-MM-dd HH:mm:ss.SSS" : DATE_FORMAT);
    } catch {
        return isoString;
    }
};

/**
 * JSON.stringify replacer that formats any ISO date string it encounters.
 * Defined at module scope so it is only created once.
 */
const dateReplacer = (_key, val) => {
    if (typeof val === "string" && ISO_DATE_REGEX.test(val)) {
        return formatISODate(val);
    }
    return val;
};

/** Tries to parse a JSON string and re-serialize it with date formatting applied. */
const tryFormatJsonString = (str) => {
    try {
        const parsed = JSON.parse(str);
        if (isObject(parsed)) {
            return JSON.stringify(parsed, dateReplacer);
        }
    } catch {
        // Not valid JSON — return undefined so the caller falls through.
    }
    return undefined;
};

const formatValue = (value) => {
    if (value === null) return "Null";
    if (value === undefined) return "-";

    if (isObject(value)) {
        return JSON.stringify(value, dateReplacer);
    }

    if (typeof value === "string") {
        if (ISO_DATE_REGEX.test(value)) return formatISODate(value);
        return tryFormatJsonString(value) ?? value;
    }

    return String(value);
};

const EventCaseProperty = ({ prop, propKey, level = 0 }) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(level > 1);

    if (!prop) return null;

    const isLeaf = !(isObject(prop.newValue) && isObject(prop.previousValue));

    const childProps = React.useMemo(() => {
        if (isLeaf || level >= MAX_RENDER_DEPTH) return [];

        const allKeys = Array.from(
            new Set([...Object.keys(prop.newValue || {}), ...Object.keys(prop.previousValue || {})]),
        );

        return allKeys
            .filter((childProp) => {
                const newVal = prop.newValue?.[childProp];
                const prevVal = prop.previousValue?.[childProp];

                if (newVal === undefined) return false;

                if (isObject(newVal) || isObject(prevVal)) {
                    return JSON.stringify(newVal) !== JSON.stringify(prevVal);
                }
                return newVal !== prevVal;
            })
            .map((childProp) => ({
                name: childProp,
                newValue: prop.newValue?.[childProp],
                previousValue: prop.previousValue?.[childProp],
            }));
    }, [prop.newValue, prop.previousValue, isLeaf, level]);

    if (isLeaf) {
        return (
            <li key={propKey}>
                <div className="flex gap-1 content-center">
                    <b>{prop.name}:</b>{" "}
                    <span className="text-gray-500">
                        <small className="text-gray-400 text-xs">{t("event_logs.prev")}:</small>
                        {formatValue(prop.previousValue, t)}
                    </span>{" "}
                    <MoveRight className="w-3" />{" "}
                    <span>
                        <small className="text-gray-600 text-xs">{t("event_logs.current")}: </small>
                        {formatValue(prop.newValue, t)}
                    </span>
                </div>
            </li>
        );
    }

    if (level >= MAX_RENDER_DEPTH || childProps.length === 0) return null;

    return (
        <li key={propKey}>
            <div className="flex items-center">
                <button
                    type="button"
                    aria-expanded={!collapsed}
                    aria-controls={`${propKey}-children`}
                    className="flex items-center gap-1 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    onClick={() => setCollapsed((prev) => !prev)}
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span className="font-bold">{prop.name}:</span>
                </button>
            </div>

            {!collapsed && (
                <ul id={`${propKey}-children`} className="list-none ml-2 border-l-2 border-gray-200 pl-2">
                    {childProps.map((childProp, index) => (
                        <EventCaseProperty
                            key={`${propKey}-${index}`}
                            prop={childProp}
                            propKey={`${propKey}-${index}`}
                            level={level + 1}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
};

EventCaseProperty.propTypes = {
    prop: PropTypes.object.isRequired,
    propKey: PropTypes.string.isRequired,
    level: PropTypes.number,
};

export default EventCaseProperty;
