import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { selectAdministratorGroupIfPrompted } from "./helpers/group-selection";

const authDir = path.resolve(process.cwd(), ".auth");
const authFile = path.join(authDir, "user.json");

test("capture authenticated dashboard storage", async ({ page }) => {
    test.setTimeout(15 * 60 * 1000);

    await page.goto("/dashboard");

    console.log("");
    console.log("Manual step: complete the app login in the opened browser.");
    console.log("The test will continue after /dashboard is loaded and the group bootstrap finishes.");
    console.log("");

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15 * 60 * 1000 });
    await selectAdministratorGroupIfPrompted(page, { timeout: 10_000 });
    await page.waitForFunction(
        () => {
            const bodyText = document.body?.innerText ?? "";
            const isDashboard = window.location.pathname === "/dashboard";
            const isStillLoading =
                bodyText.includes("Cargando autenticacion") ||
                bodyText.includes("Cargando autenticación") ||
                bodyText.includes("Obteniendo informacion del grupo") ||
                bodyText.includes("Obteniendo información del grupo");
            const hasAppShell = bodyText.includes("Grupo:") || bodyText.includes("Dashboard");
            const isGroupPrompt = bodyText.includes("Seleccione un grupo");
            return isDashboard && hasAppShell && !isStillLoading && !isGroupPrompt;
        },
        null,
        { timeout: 15 * 60 * 1000 },
    );

    fs.mkdirSync(authDir, { recursive: true });
    await page.context().storageState({ path: authFile });
});
