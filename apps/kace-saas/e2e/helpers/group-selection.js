import { expect } from "@playwright/test";

export async function selectAdministratorGroupIfPrompted(page, { timeout = 1_000 } = {}) {
    const groupPrompt = page.getByTestId("group_configuration_container");

    await groupPrompt.waitFor({ state: "visible", timeout }).catch(() => {});

    if ((await groupPrompt.count()) === 0 || !(await groupPrompt.isVisible())) {
        return;
    }

    await page.getByTestId("btn_select_trigger_group_configuration").click();

    const administratorGroup = page.getByRole("option", { name: /Administrator/i }).first();

    await expect(administratorGroup, "Administrator group option should be available").toBeVisible();
    await administratorGroup.click();
    await page.getByTestId("btn_group_configuration_submit").click();
    await expect(groupPrompt).toBeHidden({ timeout: 60_000 });
}
