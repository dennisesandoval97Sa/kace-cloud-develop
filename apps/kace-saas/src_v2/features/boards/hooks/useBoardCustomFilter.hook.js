import { useState, useCallback } from "react";

export const useBoardCustomFilter = (boardConfig, handleFilter) => {
    const [openCustomFilterModal, setOpenCustomFilterModal] = useState(false);
    const hasCustomFilter = Boolean(boardConfig?.filter_onescript_id);

    const handleCustomFilter = useCallback(
        (filterPayload) => {
            handleFilter(filterPayload);
            setOpenCustomFilterModal(false);
        },
        [handleFilter],
    );

    return { openCustomFilterModal, setOpenCustomFilterModal, hasCustomFilter, handleCustomFilter };
};
