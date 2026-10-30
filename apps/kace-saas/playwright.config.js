import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5174";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    projects: [
        {
            name: "setup",
            testMatch: /auth\.setup\.js/,
            use: {
                ...devices["Desktop Chrome"],
            },
        },
        {
            name: "chromium",
            testIgnore: /auth\.setup\.js/,
            use: {
                ...devices["Desktop Chrome"],
                storageState: ".auth/user.json",
            },
        },
    ],
});
