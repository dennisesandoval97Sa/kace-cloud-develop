import { describe, expect, it } from "vitest";
import en from "@/locale/en.json";
import es from "@/locale/es.json";
import { resolveGridColumnHeader } from "@/services/createSchemaFilter";
import { dataTableConfig, FILTER_TRANSFORMATIONS } from "../data/constants";
import { processColumns } from "./datatableProcess";

const translatorFor = (locale) => (key) => key.split(".").reduce((node, part) => node?.[part], locale) ?? key;

const resolveFilterHeaders = (locale) => {
    const transforms = processColumns({});
    return dataTableConfig.genericColumns.map((columnName) => {
        const row = { column_name: columnName };
        const column = transforms[columnName] ? transforms[columnName](row) : row;
        return resolveGridColumnHeader(column, translatorFor(locale));
    });
};

describe("Custom Lists filter headers", () => {
    it("translates every filter field to Spanish", () => {
        expect(resolveFilterHeaders(es)).toEqual([
            "Nombre",
            "Auxiliar",
            "Estado",
            "Creado por",
            "Actualizado",
            "Creado",
        ]);
    });

    it("translates every filter field to English", () => {
        expect(resolveFilterHeaders(en)).toEqual(["Name", "Auxiliary", "State", "Created by", "Updated", "Created"]);
    });

    it("keys every filter transformation by an existing column name", () => {
        expect(dataTableConfig.genericColumns).toEqual(expect.arrayContaining(Object.keys(FILTER_TRANSFORMATIONS)));
    });
});
