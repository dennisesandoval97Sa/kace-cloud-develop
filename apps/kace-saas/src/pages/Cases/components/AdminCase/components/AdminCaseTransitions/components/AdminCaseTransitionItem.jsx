import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kace/ui-shared";
import { t } from "i18next";
import { FolderOpenDot, FolderTree } from "lucide-react";
import { PropTypes } from "prop-types";
import { AdminCaseTextContainerItem } from "./AdminCaseTextContainerItem";
import { ReclassificationReason } from "./ReclassificationReason";

export const AdminCaseTransitionItem = ({ item, labels, index, countItems }) => {
    return (
        <div
            className="w-full flex flex-col items-center gap-4 max-sm:text-sm"
            data-testid="transition-item"
            data-index={index}
        >
            <div
                className="flex flex-col gap-2 text-center min-h-[140px]"
                id="transicions_item_date"
                data-testid="transicions_item_date"
            >
                {item.fecha && item.fecha.date && item.fecha.time ? (
                    <>
                        <p className="font-bold" id="transition_item_date_text" data-testid="transition_item_date_text">
                            {item.fecha.date}{" "}
                        </p>
                        <p className="font-bold" id="transition_item_time_text" data-testid="transition_item_time_text">
                            {item.fecha.time}
                        </p>
                    </>
                ) : (
                    <p className="font-bold" id="transition_item_no_data" data-testid="transition_item_no_data">
                        {t("case.transitions.noData")}
                    </p>
                )}
                {(() => {
                    const hideCreator = !item.creador;
                    const creatorFullName = item.creador
                        ? `${item.creador.nombres ?? ""} ${item.creador.apellido1 ?? ""} ${item.creador.apellido2 ?? ""}`.trim() ||
                          t("case.transitions.noData")
                        : t("case.transitions.noData");

                    return (
                        <div
                            className={`flex items-center w-full gap-2 ${hideCreator ? "invisible" : ""}`}
                            id="transition_item_creator"
                            data-testid="transition_item_creator"
                            aria-hidden={hideCreator || undefined}
                        >
                            <span
                                className="font-semibold"
                                id="transition_item_creator_label"
                                data-testid="transition_item_creator_label"
                            >
                                {labels.creator}{" "}
                            </span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger id="tooltip_trigger_creator" data-testid="tooltip_trigger_creator">
                                        <p
                                            className="w-48 truncate text-left"
                                            id="creator_name"
                                            data-testid="creator_name"
                                        >
                                            {creatorFullName}
                                        </p>
                                    </TooltipTrigger>
                                    <TooltipContent id="tooltip_content_creator" data-testid="tooltip_content_creator">
                                        {creatorFullName}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    );
                })()}
                {/*
                 * AUD-1c: un nodo de reclasificación sin `estado_siguiente` es la mitad
                 * "reclasificación" de un guardado que también cambió de estado — ese cambio ya
                 * tiene su propio nodo normal. Mostrar aquí "State: No information available"
                 * leería como si este nodo también describiera un cambio de estado que no le
                 * corresponde.
                 *
                 * El bloque se queda en el DOM (invisible, no ausente): quitarlo del todo deja
                 * a este item con una línea menos arriba que sus vecinos, y como el pie SÍ le
                 * agrega la línea "Reclassification:", las tarjetas quedan de alturas distintas
                 * y quien las lee de corrido nota el escalón — el mismo problema de fondo que el
                 * conector, resuelto igual: reservar el espacio en vez de omitirlo.
                 */}
                {(() => {
                    const hideState = !item.estado_siguiente && item.es_reclasificacion;
                    return (
                        <div
                            className={`flex items-center w-full gap-2 ${hideState ? "invisible" : ""}`}
                            id="transition_item_current_state"
                            data-testid="transition_item_current_state"
                            aria-hidden={hideState || undefined}
                        >
                            <span className="font-semibold">{labels.currentState} </span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger id="tooltip_trigger_state" data-testid="tooltip_trigger_state">
                                        <p
                                            className="w-48 truncate text-left"
                                            id="state_next_text"
                                            data-testid="state_next_text"
                                        >
                                            {item.estado_siguiente || t("case.transitions.noData")}
                                        </p>
                                    </TooltipTrigger>
                                    <TooltipContent id="tooltip_content_state" data-testid="tooltip_content_state">
                                        {item.estado_siguiente || t("case.transitions.noData")}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    );
                })()}
            </div>
            {/*
             * `1fr | auto | 1fr`: el punto queda siempre en el centro de la tarjeta (bajo el
             * texto). El lado que no aplica —izquierda del primero, derecha del último— se
             * queda en el DOM invisible para reservar el `1fr`. Omitirlo deja un solo
             * conector `w-full` y flex empuja el icono al borde (el caso de 2+ transiciones).
             */}
            <div
                className="grid w-full grid-cols-[1fr_auto_1fr] items-center"
                id="transition_item_timeline"
                data-testid="transition_item_timeline"
            >
                <div
                    className={`relative h-10 w-full ${index === 0 ? "invisible" : ""}`}
                    id="timeline_left_slot"
                    data-testid="timeline_left_slot"
                    aria-hidden={index === 0 || undefined}
                >
                    <div
                        className="absolute w-full h-10 bg-blueCustom"
                        id="timeline_left_1"
                        data-testid="timeline_left_1"
                    ></div>
                    <div
                        className="absolute w-full h-10 bg-blueCustom transform translate-x-4"
                        id="timeline_left_2"
                        data-testid="timeline_left_2"
                    ></div>
                </div>
                <div
                    className={`flex items-center justify-center rounded-full p-4 border-8 z-10 bg-card ${item.es_reclasificacion ? "border-purple-500" : "border-blueCustom"}`}
                    id="timeline_dot"
                    data-testid="timeline_dot"
                >
                    {item.es_reclasificacion ? <FolderTree /> : <FolderOpenDot />}
                </div>
                <div
                    className={`relative h-10 w-full ${index === countItems - 1 ? "invisible" : ""}`}
                    id="timeline_right_slot"
                    data-testid="timeline_right_slot"
                    aria-hidden={index === countItems - 1 || undefined}
                >
                    <div
                        className="absolute w-full h-10 bg-blueCustom transform -translate-x-4"
                        id="timeline_right_1"
                        data-testid="timeline_right_1"
                    ></div>
                    <div
                        className="absolute w-full h-10 bg-blueCustom"
                        id="timeline_right_2"
                        data-testid="timeline_right_2"
                    ></div>
                </div>
            </div>
            <div
                className="flex flex-col gap-2 text-center"
                id="transition_item_footer"
                data-testid="transition_item_footer"
            >
                <AdminCaseTextContainerItem label={labels.group} item={item.grupo} />
                <div className="flex items-center w-full gap-2">
                    <span
                        className="font-semibold"
                        id="transition_item_responsible"
                        data-testid="transition_item_responsible"
                    >
                        {t("case.transitions.responsible")}{" "}
                    </span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger id="tooltip_trigger_responsible" data-testid="tooltip_trigger_responsible">
                                <p
                                    className="w-48 truncate text-left"
                                    id="responsible_name"
                                    data-testid="responsible_name"
                                >
                                    {item?.responsable
                                        ? `${item.responsable.nombres ?? ""} ${item.responsable.apellido1 ?? ""} ${item.responsable.apellido2 ?? ""}`.trim()
                                        : t("case.transitions.noData")}
                                </p>
                            </TooltipTrigger>
                            <TooltipContent id="tooltip_content_responsible" data-testid="tooltip_content_responsible">
                                {item?.responsable
                                    ? `${item.responsable.nombres ?? ""} ${item.responsable.apellido1 ?? ""} ${item.responsable.apellido2 ?? ""}`.trim()
                                    : t("case.transitions.noData")}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                {item.es_reclasificacion && (
                    <div
                        className="flex items-center w-full gap-2"
                        id="transition_item_reclassification"
                        data-testid="transition_item_reclassification"
                    >
                        <span className="font-semibold text-purple-500">{t("case.transitions.reclassified")} </span>
                        <ReclassificationReason reason={item.motivo_reclasificacion} />
                    </div>
                )}
            </div>
        </div>
    );
};
AdminCaseTransitionItem.propTypes = {
    item: PropTypes.shape({
        fecha: PropTypes.shape({
            date: PropTypes.string,
            time: PropTypes.string,
        }),
        actualizador: PropTypes.string.isRequired,
        responsable: PropTypes.object.isRequired,
        estado_actual: PropTypes.string,
        estado_siguiente: PropTypes.string,
        fecha_resolucion: PropTypes.string.isRequired,
        grupo: PropTypes.string.isRequired,
        creador: PropTypes.object,
        es_reclasificacion: PropTypes.bool,
        motivo_reclasificacion: PropTypes.string,
    }),
    labels: PropTypes.shape({
        createdTheCase: PropTypes.string.isRequired,
        madeAnUpdate: PropTypes.string.isRequired,
        caseManager: PropTypes.string.isRequired,
        group: PropTypes.string.isRequired,
        closingDate: PropTypes.string.isRequired,
        currentState: PropTypes.string.isRequired,
        creator: PropTypes.string.isRequired,
    }),
    index: PropTypes.number,
    countItems: PropTypes.number,
};
