import { Archive, Bell, Boxes, Calendar, Logs, MessageCircleMore, User, Workflow, Mails } from "lucide-react";
import { createElement } from "react";

export const ADMIN_CASE_TAB_DATA = [
    {
        title: "app.tabs.case",
        value: "case",
        icon: createElement(Archive, { width: 18, height: 18 }),
    },
    {
        title: "app.tabs.customer",
        value: "customer",
        icon: createElement(User, { width: 18, height: 18 }),
    },
    {
        title: "app.tabs.transitions",
        value: "transitions",
        icon: createElement(Workflow, { width: 18, height: 18 }),
    },
    {
        title: "app.tabs.subCases",
        value: "sub-cases",
        icon: createElement(Boxes, { width: 18, height: 18 }),
    },
    {
        title: "app.tabs.comments",
        value: "comments",
        icon: createElement(MessageCircleMore, { width: 18, height: 18 }),
    },
    {
        title: "app.tabs.agenda",
        value: "agenda",
        icon: createElement(Calendar, { width: 18, height: 18 }),
    },
    {
        title: "app.tabs.eventLog",
        value: "logs",
        icon: createElement(Logs, { width: 18, height: 18 }),
    },
    {
        title: "app.tabs.interactions",
        value: "interactions",
        icon: createElement(Mails, { width: 18, height: 18 }),
    },
    {
        title: "app.tabs.notifications",
        value: "notifications",
        icon: createElement(Bell, { width: 18, height: 18 }),
    },
];

export const INITIAL_VALUES_CASE = {
    id: "",
    cliente_id: "",
    transicion_id: "",
    clasificacion_id: "",
    responsable_id: "",
    grupo_id: "",
    descripcion_caso_id: "",
    flujo_id: "",
};

export const getTransitionLabels = (t) => ({
    createdTheCase: t("case.transitions.createdTheCase"),
    madeAnUpdate: t("case.transitions.madeAnUpdate"),
    caseManager: t("case.transitions.caseManager"),
    group: t("case.transitions.group"),
    closingDate: t("case.transitions.closingDate"),
    currentState: t("case.transitions.currentState"),
    subTitle: t("case.transitions.subTitle"),
    creator: t("case.transitions.creator"),
});

export const getCommentLabels = (t) => ({
    wrote: t("case.comments.wrote"),
    commentChangeStatus: t("case.comments.commentChangeStatus"),
});
