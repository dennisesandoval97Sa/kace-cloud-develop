import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { collectCspViolations, readCspViolations, summarizeViolations } from "./helpers/csp-violations";
import {
    assertAuthenticatedShell,
    tryOpenAgentDiaryDrawer,
    tryOpenFirstSelect,
    tryOpenUserMenu,
} from "./helpers/csp-route-interactions";

/**
 * Fase 1 (CSP_STRICT sin definir): solo reporta violaciones CSP, nunca falla por ellas. Es exploratorio.
 * Fase 2 (CSP_STRICT=true): falla ante cualquier violación con disposition "enforce",
 * convirtiéndose en el test de regresión permanente de la política.
 *
 * La comprobación de que llegamos al shell autenticado (assertAuthenticatedShell, más abajo) NO
 * está sujeta a este interruptor: falla en ambos modos. Una sesión caducada no es un resultado de
 * la medición, es que la medición no se hizo.
 *
 * Límites conocidos de este harness (documentados aquí para no prometer cobertura que no entrega):
 * - No captura violaciones originadas dentro de un Worker: `securitypolicyviolation` se dispara en
 *   el WorkerGlobalScope, no en `document`, y este listener solo escucha en el documento principal.
 *   Hoy no hay ningún `new Worker(` en `src`, pero `worker-src` es una directiva candidata en la
 *   cabecera Report-Only: hay que saberlo antes de promoverla, no después de un falso "0 violaciones".
 * - El detalle de caso (/cases/update/:caseId) no está cubierto porque requiere un ID de caso fijo;
 *   el checklist de la sección 5 del spec sí lo pide y queda para el recorrido manual de la Tarea 11.
 */
const STRICT = process.env.CSP_STRICT === "true";

const REPORT_PATH = path.resolve(process.cwd(), "csp-report.json");

/**
 * Cada ruta ejercita al menos una de las hipótesis de la cabecera Report-Only. El comentario de
 * cada ruta describe SOLO lo que el recorrido automático (goto + las interacciones opcionales de
 * abajo) ejercita de verdad al cargar. Lo que depende de una interacción manual más elaborada
 * (subir un archivo real, enviar un formulario, abrir un caso concreto) se deja dicho de forma
 * explícita como pendiente de la Tarea 11: ningún comentario puede prometer cobertura que el test
 * no entrega.
 *
 * La hipótesis de react-remove-scroll (style-src-elem) queda cubierta en las 14 rutas por
 * tryOpenUserMenu, garantizado porque usa el mismo trigger que assertAuthenticatedShell ya exige
 * visible. tryOpenFirstSelect la cubre además por una vía distinta allí donde la ruta tenga un
 * combobox visible al cargar.
 */
const ROUTES = [
    "/dashboard",
    "/cases",
    "/agenda", // tabla CRUD de plantillas de agenda; NO monta FullCalendar (eso solo pasa en el drawer de /agent)
    "/agent", // la interacción de abajo abre el drawer "Mi agenda": monta FullCalendar y dispara el Dialog interno de vaul -> style-src-elem
    "/user/create", // el combobox "account_type" (Radix Select) ya está visible al cargar -> style-src-elem vía react-remove-scroll
    "/group/create",
    "/templates/create", // editor de texto enriquecido (Lexical)
    "/automation-settings/create",
    "/boards/create",
    "/clasificaciones",
    "/import-data", // al montar solo dispara una consulta interna (pestaña "Panel de control"); la subida a S3 -> connect-src está detrás de un onChange/onDrop en la pestaña "Cargar archivo" y queda para la Tarea 11
    "/export-data", // no dispara ninguna petición hasta enviar el formulario; connect-src/worker-src de la exportación quedan para la Tarea 11
    "/generate-csv",
    "/workspaces/create",
];

const collected = [];
const interactionLog = [];

test.beforeEach(async ({ page }) => {
    await collectCspViolations(page);
});

for (const route of ROUTES) {
    test(`CSP en ${route}`, async ({ page }) => {
        await page.goto(route);
        await assertAuthenticatedShell(page, route);

        const steps = [];
        if (route === "/agent") steps.push(await tryOpenAgentDiaryDrawer(page));
        steps.push(await tryOpenFirstSelect(page));
        steps.push(await tryOpenUserMenu(page));
        interactionLog.push({ route, steps });

        const violations = await readCspViolations(page);
        collected.push(...violations.map((violation) => ({ ...violation, route })));

        if (STRICT) {
            expect(violations.filter((violation) => violation.disposition === "enforce")).toEqual([]);
        }
    });
}

test.afterAll(() => {
    const report = {
        violations: summarizeViolations(collected),
        interactions: interactionLog,
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 4));
    console.log(`Informe de violaciones CSP escrito en ${REPORT_PATH}`);
});
