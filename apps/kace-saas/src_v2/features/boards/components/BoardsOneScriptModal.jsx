import React from "react";
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

const BoardsOneScriptModal = ({
    className,
    title,
    description,
    oneScriptId,
    entity_id,
    primary_entity,
    role,
    board_id,
    ...props
}) => {
    const { oneScriptRef, oneScriptURL } = useOneScript(oneScriptId, { entity_id, primary_entity, role, board_id });

    return (
        <Dialog {...props}>
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
                    <DialogDescription>{description}</DialogDescription>
                    <div className="relative h-[calc(100vh-20rem)] overflow-hidden">
                        {oneScriptURL && <FormOneScript formRef={oneScriptRef} url={oneScriptURL} />}
                    </div>
                </DialogContent>
            </Portal>
        </Dialog>
    );
};

BoardsOneScriptModal.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
    title: PropTypes.string,
    description: PropTypes.string,
    oneScriptId: PropTypes.string,
    entity_id: PropTypes.string,
    primary_entity: PropTypes.string,
    role: PropTypes.string,
    board_id: PropTypes.string,
};

export default BoardsOneScriptModal;
