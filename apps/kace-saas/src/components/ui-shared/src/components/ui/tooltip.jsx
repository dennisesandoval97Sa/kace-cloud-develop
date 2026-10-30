import { Root, Provider, Trigger, Content, Portal } from "@radix-ui/react-tooltip";

import { cn } from "../../lib/utils";
import { forwardRef } from "react";

const TooltipProvider = Provider;

const Tooltip = Root;

const TooltipTrigger = Trigger;

// Rendered via Portal (into document.body) rather than in place: without it, any ancestor
// that introduces a new containing block (CSS `transform`, `filter`, etc. — common in
// animated/scrollable page layouts) makes Radix's fixed-position popper anchor to that
// ancestor instead of the viewport, so the tooltip silently never appears where expected.
const TooltipContent = forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
    <Portal>
        <Content
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
                "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                className,
            )}
            {...props}
        />
    </Portal>
));
TooltipContent.displayName = Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
