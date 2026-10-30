import { describe, expect, it } from "vitest";
import en from "@/locale/en.json";
import es from "@/locale/es.json";

describe("cases edited_at vs updated_at filter labels (gridMain.columnsCases / fieldsClientCases)", () => {
    it("tells a level-1 user why they would filter by each date in Spanish", () => {
        expect(es.gridMain.columnsCases["Created at"]).toBe("Cuándo se creó el caso");
        expect(es.gridMain.columnsCases["Edited at"]).toBe("Última gestión");
        expect(es.gridMain.columnsCases["Updated at"]).toBe("Última actualización");
        expect(es.fieldsClientCases.created_at).toBe("Cuándo se creó el caso");
        expect(es.fieldsClientCases.edited_at).toBe("Última gestión");
        expect(es.fieldsClientCases.updated_at).toBe("Última actualización");
    });

    it("tells a level-1 user why they would filter by each date in English", () => {
        expect(en.gridMain.columnsCases["Created at"]).toBe("When the case was created");
        expect(en.gridMain.columnsCases["Edited at"]).toBe("Last handled");
        expect(en.gridMain.columnsCases["Updated at"]).toBe("Last updated");
        expect(en.fieldsClientCases.created_at).toBe("When the case was created");
        expect(en.fieldsClientCases.edited_at).toBe("Last handled");
        expect(en.fieldsClientCases.updated_at).toBe("Last updated");
    });

    it("tells a level-1 user why they would filter by each person in Spanish", () => {
        expect(es.gridMain.columnsCases["Edited by"]).toBe("Gestionado por");
        expect(es.gridMain.columnsCases["Updated by"]).toBe("Actualizado por");
        expect(es.gridMain.columnsCases["Created by"]).toBe("Quién creó el caso");
        expect(es.fieldsClientCases.edited_by).toBe("Gestionado por");
        expect(es.fieldsClientCases.updated_by).toBe("Actualizado por");
        expect(es.fieldsClientCases.created_by).toBe("Quién creó el caso");
    });

    it("tells a level-1 user why they would filter by each person in English", () => {
        expect(en.gridMain.columnsCases["Edited by"]).toBe("Handled by");
        expect(en.gridMain.columnsCases["Updated by"]).toBe("Updated by");
        expect(en.gridMain.columnsCases["Created by"]).toBe("Who created the case");
        expect(en.fieldsClientCases.edited_by).toBe("Handled by");
        expect(en.fieldsClientCases.updated_by).toBe("Updated by");
        expect(en.fieldsClientCases.created_by).toBe("Who created the case");
    });

    it("keeps the shared gridMain.columns/fieldsClient keys generic for every other table (Roles, Groups, Users, ...)", () => {
        expect(es.gridMain.columns["Created at"]).toBe("Creado");
        expect(es.gridMain.columns["Created by"]).toBe("Creado por");
        expect(es.gridMain.columns["Updated at"]).toBe("Actualizado");
        expect(es.gridMain.columns["Updated by"]).toBe("Actualizado por");
        expect(es.fieldsClient.created_at).toBe("Creado el");
        expect(es.fieldsClient.created_by).toBe("Creado por");
        expect(es.fieldsClient.updated_at).toBe("Actualizado el");
        expect(es.fieldsClient.updated_by).toBe("Actualizado por");

        expect(en.gridMain.columns["Created at"]).toBe("Created");
        expect(en.gridMain.columns["Created by"]).toBe("Created by");
        expect(en.gridMain.columns["Updated at"]).toBe("Updated");
        expect(en.gridMain.columns["Updated by"]).toBe("Updated by");
        expect(en.fieldsClient.created_at).toBe("Created at");
        expect(en.fieldsClient.created_by).toBe("Created by");
        expect(en.fieldsClient.updated_at).toBe("Updated at");
        expect(en.fieldsClient.updated_by).toBe("Updated by");
    });
});
