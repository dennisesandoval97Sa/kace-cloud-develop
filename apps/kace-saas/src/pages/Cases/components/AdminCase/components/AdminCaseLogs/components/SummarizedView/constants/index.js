import {
    BadgeCheck,
    CheckCircle,
    Eye,
    FolderTree,
    GitBranch,
    GitCommitHorizontal,
    MessageSquare,
    MessageSquareCode,
    ServerCrash,
    Tag,
    User2,
} from "lucide-react";
import { t } from "i18next";
import { formatUserFullName } from "@/utils/userDisplay";

const getName = (data) => formatUserFullName(data ?? {});

/**
 * El backend congela la etiqueta de la clasificación en el evento al reclasificar, para que un
 * renombre posterior no reescriba la bitácora. Los eventos anteriores a AUD-1 solo llevan el id:
 * ahí se muestra el texto de desconocido, porque un UUID no le dice nada a quien audita.
 */
const getClassificationLabel = (data) => data?.clasificacion?.label || t("event_logs.classificationUnknown");

export const eventTypeDetails = {
    "case.viewed": {
        icon: Eye,
        text: (event) => t("event_logs.eventName.viewed", { state: event.body?.state?.nombre }),
        fields: (event) => [
            { name: t("event_logs.state"), value: event?.body?.state?.nombre ?? t("event_logs.stateUnknown") },
        ],
        color: "text-green-500",
    },
    "aux-cases.created": {
        icon: CheckCircle,
        text: () => t("event_logs.eventTypes.auxCreated"),
        color: "text-green-500",
    },
    "aux-cases.updated": {
        icon: MessageSquareCode,
        text: () => t("event_logs.eventName.auxUpdated"),
    },
    "case.created": {
        icon: CheckCircle,
        text: () => t("event_logs.eventTypes.created"),
        color: "text-green-500",
    },
    "case.updated": {
        icon: MessageSquare,
        color: "text-orange-500",
        text: () => t("event_logs.eventName.updated"),
    },
    "case.state_changed": {
        icon: Tag,
        color: "text-indigo-500",
        text: (event) =>
            t("event_logs.eventName.stateChanged", {
                prevState: event?.old_data?.state?.nombre ?? t("event_logs.stateUnknown"),
                newState: event?.body?.state?.nombre ?? t("event_logs.stateUnknown"),
            }),
        fields: (event) => [
            { name: t("event_logs.stateOld"), value: event?.old_data?.state?.nombre ?? t("event_logs.stateUnknown") },
            { name: t("event_logs.stateNew"), value: event?.body?.state?.nombre ?? t("event_logs.stateUnknown") },
        ],
    },
    "case.closed": {
        icon: BadgeCheck,
        text: (event) =>
            t("event_logs.eventName.closed", {
                status: event?.old_data?.state?.name ?? t("event_logs.stateUnknown"),
            }),
        fields: (event) => [
            { name: t("event_logs.state"), value: event?.old_data?.state?.nombre ?? t("event_logs.stateUnknown") },
            ...(event?.body?.motivo_baja
                ? [{ name: t("event_logs.closeReason"), value: event.body.motivo_baja, tooltip: true }]
                : []),
        ],
        color: "text-green-700",
    },
    "ws-rest-flows.executed": {
        icon: GitBranch,
        text: () => t("event_logs.eventName.restflowExecuted"),
        color: "text-gray-500",
    },
    "case.reassigned": {
        icon: User2,
        text: () => t("event_logs.eventName.reassigned"),
        fields: (event) => [
            { name: t("event_logs.previousResponsible"), value: getName(event?.old_data?.responsable) },
            { name: t("event_logs.newResponsible"), value: getName(event?.body?.responsable) },
            { name: t("event_logs.state"), value: event?.old_data?.state?.nombre ?? t("event_logs.stateUnknown") },
        ],
        color: "text-indigo-500",
    },
    "case.reclassified": {
        icon: FolderTree,
        text: (event) =>
            t("event_logs.eventName.reclassified", {
                prevClassification: getClassificationLabel(event?.old_data),
                newClassification: getClassificationLabel(event?.body),
            }),
        fields: (event) => [
            { name: t("event_logs.classificationOld"), value: getClassificationLabel(event?.old_data) },
            { name: t("event_logs.classificationNew"), value: getClassificationLabel(event?.body) },
            { name: t("event_logs.stateNew"), value: event?.body?.state?.nombre ?? t("event_logs.stateUnknown") },
        ],
        color: "text-purple-500",
    },
    "case.assigned": {
        icon: User2,
        text: () => t("event_logs.eventName.assigned"),
        fields: (event) => [
            { name: t("event_logs.previousResponsible"), value: getName(event?.old_data?.responsable) },
            { name: t("event_logs.newResponsible"), value: getName(event?.body?.responsable) },
            { name: t("event_logs.state"), value: event?.old_data?.state?.nombre ?? t("event_logs.stateUnknown") },
        ],
        color: "text-indigo-500",
    },
    "action.executed": {
        icon: GitCommitHorizontal,
        color: "text-yellow-700",
        text: () => t("event_logs.eventName.actionExecuted"),
        fields: (event) => [
            { name: t("event_logs.actionName"), value: event?.body?.description ?? t("event_logs.stateUnknown") },
            { name: t("event_logs.actionTrigger"), value: event?.body?.trigger ?? t("event_logs.stateUnknown") },
            { name: t("event_logs.actionType"), value: event?.body?.actionType ?? t("event_logs.actionType") },
            {
                name: t("event_logs.result"),
                value:
                    (event?.body?.success ? t("event_logs.actionSuccess") : t("event_logs.actionFailure")) ??
                    t("event_logs.stateUnknown"),
            },
            ...(event?.body.actionType.indexOf("asign") >= 0
                ? [
                      { name: t("event_logs.previousResponsible"), value: getName(event?.old_data?.responsable) },
                      { name: t("event_logs.newResponsible"), value: getName(event?.body?.responsable) },
                      {
                          name: t("event_logs.state"),
                          value: event?.body?.state?.nombre ?? t("event_logs.stateUnknown"),
                      },
                  ]
                : []),
        ],
    },
    default: {
        icon: ServerCrash,
        text: (event) => event?.event_name,
        color: "text-red-500",
    },
};

/**
 * Los tenants que pulsan "Seleccionar todos" guardan un snapshot de `typeOptions`.
 * Quien lo guardó antes de AUD-1 no tiene `case.reclassified`: esa lista se aplica
 * como filtro oculto aunque la UI diga "sin filtros". Vacío sigue significando todos.
 *
 * @param {unknown} allowedEventTypes
 * @returns {string[]}
 */
export function resolveConfiguredEventTypes(allowedEventTypes) {
    if (!Array.isArray(allowedEventTypes) || allowedEventTypes.length === 0) {
        return [];
    }

    const configured = allowedEventTypes.map((event) => String(event).trim()).filter(Boolean);
    if (configured.length === 0) {
        return [];
    }
    if (!configured.includes("case.reclassified")) {
        configured.push("case.reclassified");
    }
    return configured;
}

export const typeOptions = [
    {
        id: "case.created",
        label: t("event_logs.eventTypes.created"),
    },
    {
        id: "case.state_changed",
        label: t("event_logs.eventTypes.stateChanged"),
    },
    {
        id: "case.viewed",
        label: t("event_logs.eventTypes.viewed"),
    },
    {
        id: "case.closed",
        label: t("event_logs.eventTypes.closed"),
    },
    {
        id: "case.updated",
        label: t("event_logs.eventTypes.updated"),
    },
    {
        id: "case.assigned",
        label: t("event_logs.eventTypes.assigned"),
    },
    {
        id: "case.reassigned",
        label: t("event_logs.eventTypes.reassigned"),
    },
    {
        id: "case.reclassified",
        label: t("event_logs.eventTypes.reclassified"),
    },
    {
        id: "aux-cases.created",
        label: t("event_logs.eventTypes.auxCreated"),
    },
    {
        id: "aux-cases.updated",
        label: t("event_logs.eventTypes.auxUpdated"),
    },
    {
        id: "action.executed",
        label: t("event_logs.eventTypes.actionExecuted"),
    },
    {
        id: "ws-rest-flows.executed",
        label: t("event_logs.eventTypes.restFlow"),
    },
];
