import React, { useEffect } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@kace/ui-shared";
import useAvailableBoards from "../hooks/useBoardsByGroup.hook";
import BoardDetail from "./BoardDetail";
import { ICON_COMPONENT_BY_NAME } from "@kace_v2/shared/constants/iconsSelect.constants";
import Loader from "@kace_v2/shared/ui/molecules/Loader";
import usePersistentState from "@kace_v2/shared/hooks/usePersistentState.hook";

const AUTO_EXPANDED_BOARDS = 3;
const EXPANDED_BOARDS_NAMESPACE = "boards:agent:accordion";

const BoardsAccordion = () => {
    const { boards, isLoading, isError } = useAvailableBoards();
    /*
     * `null` significa "sin snapshot todavia" y es lo que distingue la primera
     * visita de un usuario que colapso todos los tableros a proposito: con `[]`
     * como valor por defecto, el auto-expandir volveria a abrirlos en cada
     * recarga y pelearia contra esa decision explicita.
     */
    const [expandedBoards, setExpandedBoards] = usePersistentState(EXPANDED_BOARDS_NAMESPACE, null, {
        sanitize: (value) => (Array.isArray(value) ? value : undefined),
    });

    useEffect(() => {
        if (boards.length === 0) return;

        setExpandedBoards((previous) => {
            if (!Array.isArray(previous)) {
                return boards.slice(0, AUTO_EXPANDED_BOARDS).map((board) => board.id);
            }
            // Podar tableros borrados o cuyo permiso se revoco desde la ultima visita.
            const availableIds = new Set(boards.map((board) => board.id));
            const pruned = previous.filter((boardId) => availableIds.has(boardId));
            return pruned.length === previous.length ? previous : pruned;
        });
    }, [boards, setExpandedBoards]);

    const expandedValue = Array.isArray(expandedBoards) ? expandedBoards : [];

    if (isLoading) {
        return <Loader />;
    }

    if (isError || !boards || boards.length === 0) {
        return (
            <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">No hay tableros disponibles para tu grupo</p>
            </div>
        );
    }

    return (
        <Accordion type="multiple" value={expandedValue} onValueChange={setExpandedBoards} className="w-full">
            {boards.map((board) => {
                const Icon = board.icon_class ? ICON_COMPONENT_BY_NAME[board.icon_class] : null;
                const isExpanded = expandedValue.includes(board.id);

                return (
                    <AccordionItem key={board.id} value={board.id} className="border-b">
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2">
                                {Icon && <Icon size={16} />}
                                <span className="font-medium">{board.name}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <BoardDetail boardId={board.id} isExpanded={isExpanded} />
                        </AccordionContent>
                    </AccordionItem>
                );
            })}
        </Accordion>
    );
};

export default BoardsAccordion;
