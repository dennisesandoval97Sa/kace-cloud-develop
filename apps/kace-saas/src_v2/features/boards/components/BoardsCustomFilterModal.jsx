import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Dialog, Portal } from "@radix-ui/react-dialog";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { X } from "lucide-react";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import DialogDescription from "@kace_v2/shared/ui/atoms/DialogDescription";
import { FormOneScript } from "@/components/core/FormOneScript/FormOneScript";
import { cn } from "@kace_v2/shared/utils/cn.util";
import useOneScript from "@kace_v2/shared/hooks/useOneScript";
import useBoardCustomFilterMessage from "@kace_v2/features/boards/hooks/useBoardCustomFilterMessage.hook";

const BoardsCustomFilterModal = ({
    className,
    title,
    description,
    oneScriptId,
    board_id,
    onFilter,
    open = false,
    onOpenChange,
    ...props
}) => {
    const oneScriptParams = useMemo(() => ({ board_id }), [board_id]);
    /*
     * El modal se mantiene montado por cada tablero del acordeon, asi que el
     * detalle del OneScript solo se pide cuando se abre de verdad.
     */
    const { oneScriptRef, oneScriptURL } = useOneScript(open ? oneScriptId : null, oneScriptParams);

    const handleKaceCloseTab = () => {
        if (onOpenChange) {
            onOpenChange(false);
        }
    };

    useBoardCustomFilterMessage(oneScriptRef, onFilter, open);

    return (
        <Dialog open={open} onOpenChange={onOpenChange} {...props}>
            <Portal>
                <DialogOverlay />
                <DialogContent
                    className={cn(
                        "sm:max-w-[calc(100vw-5rem)] sm:h-[calc(100vh-10rem)] overflow-auto flex flex-col gap-2",
                        className,
                    )}
                >
                    <DialogClose>
                        <Button size="icon" variant="outline">
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogClose>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                    <div className="relative h-[calc(100vh-20rem)] overflow-hidden">
                        {oneScriptURL && (
                            <FormOneScript
                                formRef={oneScriptRef}
                                url={oneScriptURL}
                                onKaceCloseTab={handleKaceCloseTab}
                            />
                        )}
                    </div>
                </DialogContent>
            </Portal>
        </Dialog>
    );
};

BoardsCustomFilterModal.propTypes = {
    className: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    oneScriptId: PropTypes.string,
    board_id: PropTypes.string,
    onFilter: PropTypes.func.isRequired,
    open: PropTypes.bool,
    onOpenChange: PropTypes.func,
};

export default BoardsCustomFilterModal;
