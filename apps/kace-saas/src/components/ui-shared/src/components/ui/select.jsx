import {
    Root,
    Group,
    Value,
    Trigger,
    Icon,
    ScrollUpButton,
    ScrollDownButton,
    Portal,
    Content,
    Viewport,
    Label,
    Item,
    ItemIndicator,
    ItemText,
    Separator,
} from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { forwardRef } from "react";
import PropTypes from "prop-types";
import { cn } from "@/componentsV2/lib/utils";

const Select = Root;

const SelectGroup = Group;

const SelectValue = Value;

const SelectTrigger = forwardRef(({ className, children, ...props }, ref) => (
    <Trigger
        ref={ref}
        className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
            className,
        )}
        {...props}
    >
        {children}
        <Icon asChild>
            <ChevronDown className="h-4 w-4 opacity-50" />
        </Icon>
    </Trigger>
));
SelectTrigger.displayName = Trigger.displayName;
SelectTrigger.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
};

const SelectScrollUpButton = forwardRef(({ className, ...props }, ref) => (
    <ScrollUpButton
        ref={ref}
        className={cn("flex cursor-default items-center justify-center py-1", className)}
        {...props}
    >
        <ChevronUp className="h-4 w-4" />
    </ScrollUpButton>
));
SelectScrollUpButton.displayName = ScrollUpButton.displayName;
SelectScrollUpButton.propTypes = {
    className: PropTypes.string,
};

const SelectScrollDownButton = forwardRef(({ className, ...props }, ref) => (
    <ScrollDownButton
        ref={ref}
        className={cn("flex cursor-default items-center justify-center py-1", className)}
        {...props}
    >
        <ChevronDown className="h-4 w-4" />
    </ScrollDownButton>
));
SelectScrollDownButton.displayName = ScrollDownButton.displayName;
SelectScrollDownButton.propTypes = {
    className: PropTypes.string,
};

const SelectContent = forwardRef(
    (
        {
            onScroll,
            onWheel,
            onTouchStart,
            onTouchMove,
            onPointerDown,
            onPointerMove,
            onKeyDown,
            className,
            children,
            header = null,
            position = "popper",
            scrollable = false,
            ...props
        },
        ref,
    ) => (
        <Portal>
            <Content
                ref={ref}
                className={cn(
                    "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                    position === "popper" &&
                        "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
                    className,
                )}
                position={position}
                {...props}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onKeyDown={onKeyDown}
                onWheel={(e) => {
                    e.stopPropagation();
                }}
                onTouchMove={(e) => {
                    onTouchMove?.(e);
                    e.stopPropagation();
                }}
            >
                <SelectScrollUpButton />
                {header ? (
                    <div className="sticky top-0 z-10 shrink-0 border-b bg-popover" data-testid="select-content-header">
                        {header}
                    </div>
                ) : null}
                <Viewport
                    onScroll={onScroll}
                    onWheel={(e) => {
                        onWheel?.(e);
                        e.stopPropagation();
                    }}
                    onTouchStart={onTouchStart}
                    onTouchMove={(e) => {
                        onTouchMove?.(e);
                        e.stopPropagation();
                    }}
                    className={cn(
                        "p-1",
                        position === "popper" &&
                            (header || scrollable
                                ? "max-h-60 w-full min-w-[var(--radix-select-trigger-width)] overflow-y-auto"
                                : "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"),
                    )}
                >
                    {children}
                </Viewport>
                <SelectScrollDownButton />
            </Content>
        </Portal>
    ),
);
SelectContent.displayName = Content.displayName;
SelectContent.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
    header: PropTypes.node,
    position: PropTypes.oneOf(["popper", "static"]),
    onScroll: PropTypes.func,
    scrollable: PropTypes.bool,
    onWheel: PropTypes.func,
    onTouchStart: PropTypes.func,
    onTouchMove: PropTypes.func,
    onPointerDown: PropTypes.func,
    onPointerMove: PropTypes.func,
    onKeyDown: PropTypes.func,
};

const SelectLabel = forwardRef(({ className, ...props }, ref) => (
    <Label ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
));
SelectLabel.displayName = Label.displayName;
SelectLabel.propTypes = {
    className: PropTypes.string,
};

const SelectItem = forwardRef(({ className, children, id, ...props }, ref) => (
    <Item
        ref={ref}
        className={cn(
            "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            className,
        )}
        id={id}
        data-testid={id}
        {...props}
    >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <ItemIndicator>
                <Check className="h-4 w-4" />
            </ItemIndicator>
        </span>

        <ItemText id={id} data-testid={id}>
            {children}
        </ItemText>
    </Item>
));
SelectItem.displayName = Item.displayName;
SelectItem.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
    id: PropTypes.string,
};

const SelectSeparator = forwardRef(({ className, ...props }, ref) => (
    <Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
SelectSeparator.displayName = Separator.displayName;
SelectSeparator.propTypes = {
    className: PropTypes.string,
};

export {
    Select,
    SelectGroup,
    SelectValue,
    SelectTrigger,
    SelectContent,
    SelectLabel,
    SelectItem,
    SelectSeparator,
    SelectScrollUpButton,
    SelectScrollDownButton,
};
