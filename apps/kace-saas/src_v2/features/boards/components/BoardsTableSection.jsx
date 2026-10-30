import React from "react";
import PropTypes from "prop-types";
import CreateModalButton from "@kace_v2/shared/ui/molecules/CreateModalButton";
import DataTable from "@kace_v2/shared/ui/organisms/DataTable";
import { cn } from "@kace_v2/shared/utils/cn.util";

const BoardsTableSection = ({
    className,
    sectionClassName,
    title,
    description,
    columns,
    rows,
    actions,
    open,
    onOpenChange,
    onOrderChange,
    disabled = false,
    customHeader = false,
    children,
}) => {
    return (
        <div className={cn("flex w-full min-w-0 flex-col gap-2 border rounded-lg p-2", sectionClassName)}>
            <div className="flex justify-end">
                {customHeader ? (
                    children
                ) : (
                    <CreateModalButton
                        title={title}
                        description={description}
                        className={className}
                        open={open}
                        onOpenChange={onOpenChange}
                        disabled={disabled}
                    >
                        {children}
                    </CreateModalButton>
                )}
            </div>
            <div className="w-full min-w-0 overflow-auto max-h-96">
                <DataTable
                    className="w-full"
                    columns={columns}
                    rows={rows}
                    actions={actions}
                    onOrderChange={onOrderChange}
                />
            </div>
        </div>
    );
};

BoardsTableSection.propTypes = {
    className: PropTypes.string,
    sectionClassName: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    columns: PropTypes.arrayOf(
        PropTypes.shape({
            key: PropTypes.string.isRequired,
            header: PropTypes.string.isRequired,
        }),
    ),
    rows: PropTypes.array,
    actions: PropTypes.array,
    open: PropTypes.bool,
    onOpenChange: PropTypes.func,
    isDraggable: PropTypes.bool,
    onOrderChange: PropTypes.func,
    disabled: PropTypes.bool,
    customHeader: PropTypes.bool,
    children: PropTypes.node,
};

export default BoardsTableSection;
