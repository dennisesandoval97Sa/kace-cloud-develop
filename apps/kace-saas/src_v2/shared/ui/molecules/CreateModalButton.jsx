import React from "react";
import PropTypes from "prop-types";
import { Dialog, Portal, Trigger } from "@radix-ui/react-dialog";
import { cn } from "@kace_v2/shared/utils/cn.util";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { PlusIcon, X } from "lucide-react";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import DialogDescription from "@kace_v2/shared/ui/atoms/DialogDescription";

const CreateModalButton = ({ className, children, title, description, label, disabled, ...props }) => {
    return (
        <Dialog {...props}>
            <Trigger asChild>
                <Button size={label ? "default" : "icon"} type="button" disabled={disabled}>
                    <PlusIcon /> {label}
                </Button>
            </Trigger>
            <Portal>
                <DialogOverlay />
                <DialogContent className={cn("max-h-[calc(100vh-12rem)] flex flex-col overflow-hidden", className)}>
                    <div className="flex-shrink-0">
                        <DialogClose>
                            <Button size="icon" variant="outline">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
                </DialogContent>
            </Portal>
        </Dialog>
    );
};

CreateModalButton.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
    title: PropTypes.string,
    description: PropTypes.string,
    label: PropTypes.string,
    disabled: PropTypes.bool,
};

export default CreateModalButton;
