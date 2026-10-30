import { describe, expect, it } from "vitest";
import { FILTER_TRANSFORMATIONS } from "./constants";

describe("Channel Hub table column policies", () => {
    it("uses the canonical search operator for the country filter", () => {
        expect(FILTER_TRANSFORMATIONS.country_id({}).filterData).toEqual({
            field: "channel_hub_accounts.country_id",
            operator: "eq",
            type: "AND",
            value: "",
        });
    });

    it("marks id-suffixed data columns as plain text so they render their own values", () => {
        const countryColumn = FILTER_TRANSFORMATIONS.country_id({
            column_name: "country_id",
            data_type: "character varying",
        });
        const connectionColumn = FILTER_TRANSFORMATIONS.channel_hub_connection_id({
            column_name: "channel_hub_connection_id",
            data_type: "character varying",
        });

        expect(countryColumn).toEqual(
            expect.objectContaining({
                column_name: "country_id",
                label: "country_id",
                meta: { renderAsPlainText: true },
            }),
        );
        expect(connectionColumn).toEqual(
            expect.objectContaining({
                column_name: "channel_hub_connection_id",
                label: "channel_hub_connection_id",
                meta: { renderAsPlainText: true },
            }),
        );
    });
});
