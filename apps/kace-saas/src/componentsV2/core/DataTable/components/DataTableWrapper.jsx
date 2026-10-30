import React, { memo } from "react";
import PropTypes from "prop-types";
import { GeneralLoader } from "@/components/ui-shared";
import DataTableError from "./DataTableError";

const DataTableWrapper = ({ isLoading = false, isError = false, handleRefresh = () => {}, children = null }) => {
    let content = null;

    if (isLoading) {
        content = <GeneralLoader id="data_table_loading" data-testid="data_table_loading" />;
    } else if (isError) {
        content = <DataTableError handleFilters={handleRefresh} id="data_table_error" data-testid="data_table_error" />;
    } else {
        content = children;
    }

    return <div className="flex min-h-96 max-h-[calc(100vh-10rem)] flex-col gap-2 overflow-hidden">{content}</div>;
};

DataTableWrapper.propTypes = {
    isLoading: PropTypes.bool,
    isError: PropTypes.bool,
    handleRefresh: PropTypes.func,
    children: PropTypes.node,
};

export default memo(DataTableWrapper);
