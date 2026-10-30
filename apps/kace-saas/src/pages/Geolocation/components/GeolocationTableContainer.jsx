import { DataTable, createColumns } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { NAME_LOCATION_FILTER } from "@kace/utils";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HEADER_GEOLOCATION, QUERY_KEY_GEOLOCATION } from "../data/constans.js";
import { filter } from "../data/queries.js";
import useGeolocationTableData from "../hooks/useGeolocationTableData";

export const GeolocationTableContainer = ({ handleSeeGeolocation, userId }) => {
    const [currentHeaders, setCurrentHeaders] = useState([]);
    const [customFilter, setCustomFilter] = useState({ filter: [] });
    const { t } = useTranslation();

    const { headers } = useGeolocationTableData({ headersFilters: HEADER_GEOLOCATION });
    const max_map_markers = useSelector((state) => state.generalSetup?.configAgent?.geolocation?.max_map_markers || 50);

    const handleCurrentHeaders = (headers) => {
        const keyColumns = headers.map((column) => {
            return {
                accessorKey: column.column_name,
                header: t(`gridMain.columns.${column.label}`),
                value: column.data_type,
            };
        });
        setCurrentHeaders(keyColumns);
    };

    const columnsData = useMemo(
        () =>
            createColumns(
                currentHeaders,
                true,
                [],
                [
                    {
                        name: "Ver en el mapa",
                        action: (row) => handleSeeGeolocation(false, row),
                        customizable: true,
                    },
                ],
            ),
        [currentHeaders, handleSeeGeolocation],
    );

    const hiddenColumns = HEADER_GEOLOCATION.reduce((acc, { key, isVisible }) => {
        if (isVisible === false) {
            acc[key] = false;
        }
        return acc;
    }, {});

    useEffect(() => {
        handleCurrentHeaders(headers);
    }, [headers]);

    useEffect(() => {
        if (userId) {
            setCustomFilter({
                userId,
                filter: filter(userId),
            });
        }
    }, [userId]);

    const seeAllTheGeolocation = (rows) => {
        if (!rows || !rows?.length) return;

        const geolocation = rows.slice(0, max_map_markers).map((row) => {
            return {
                latitude: row.latitud,
                longitude: row.longitud,
                ip4_address: row.ip4_address,
                created_at: row.created_at,
                action_type: row.action_type,
            };
        });
        handleSeeGeolocation(geolocation);
    };

    return (
        <div>
            <DataTable
                columns={columnsData}
                isPagination
                hiddenColumns={hiddenColumns}
                nameTable={NAME_LOCATION_FILTER.GEOLOCATION}
                keyQueryData={`${QUERY_KEY_GEOLOCATION}_${customFilter?.userId}`}
                customsfilters={customFilter?.filter}
                showFilterCases={true}
                showFilterCasesOnlyAll={true}
                customFuction={seeAllTheGeolocation}
            />
        </div>
    );
};
GeolocationTableContainer.propTypes = {
    handleSeeGeolocation: PropTypes.func.isRequired,
    userId: PropTypes.string,
};
