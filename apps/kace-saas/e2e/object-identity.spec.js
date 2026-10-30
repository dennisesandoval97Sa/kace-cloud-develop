import { expect, test } from "@playwright/test";

const SERVER_MANAGED_FIELDS = [
    "created_by",
    "created_at",
    "updated_by",
    "updated_at",
    "deleted_by",
    "deleted_at",
    "tenant_id",
];

const runId = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 12);
const MALICIOUS_ID = `00000000-0000-4000-8000-${runId.padStart(12, "0")}`;
const MALICIOUS_AUDIT_USER_ID = "11111111-1111-4111-8111-111111111111";
const MALICIOUS_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const MALICIOUS_AUDIT_TIMESTAMP = "2000-01-01T00:00:00.000Z";
const letterRunId = runId
    .replaceAll("0", "a")
    .replaceAll("1", "b")
    .replaceAll("2", "c")
    .replaceAll("3", "d")
    .replaceAll("4", "e")
    .replaceAll("5", "f")
    .replaceAll("6", "g")
    .replaceAll("7", "h")
    .replaceAll("8", "i")
    .replaceAll("9", "j");

function endpointMatcher(endpoint, { includeSubpaths = false } = {}) {
    return (requestOrResponse) => {
        const request = "request" in requestOrResponse ? requestOrResponse.request() : requestOrResponse;
        if (request.method() !== "POST") return false;
        const pathname = new URL(request.url()).pathname;
        return (
            pathname === endpoint ||
            pathname.endsWith(endpoint) ||
            (includeSubpaths && pathname.startsWith(`${endpoint}/`))
        );
    };
}

function assertNoServerManagedFields(payload, path = "payload") {
    if (!payload || typeof payload !== "object") return;

    for (const field of SERVER_MANAGED_FIELDS) {
        expect(payload, `${path} must not include ${field}`).not.toHaveProperty(field);
    }

    for (const [key, value] of Object.entries(payload)) {
        if (Array.isArray(value)) {
            value.forEach((item, index) => assertNoServerManagedFields(item, `${path}.${key}[${index}]`));
        } else if (value && typeof value === "object") {
            assertNoServerManagedFields(value, `${path}.${key}`);
        }
    }
}

function withMaliciousIdentityFields(payload) {
    return {
        ...payload,
        id: MALICIOUS_ID,
        created_by: MALICIOUS_AUDIT_USER_ID,
        updated_by: MALICIOUS_AUDIT_USER_ID,
        deleted_by: MALICIOUS_AUDIT_USER_ID,
        tenant_id: MALICIOUS_TENANT_ID,
        created_at: MALICIOUS_AUDIT_TIMESTAMP,
        updated_at: MALICIOUS_AUDIT_TIMESTAMP,
        deleted_at: MALICIOUS_AUDIT_TIMESTAMP,
    };
}

function getResponseResource(body) {
    return body?.data?.data ?? body?.data ?? body;
}

async function responseJsonOrNull(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function assertResponseDoesNotTrustMaliciousFields(responseBody, label) {
    const resource = getResponseResource(responseBody);
    if (!resource || typeof resource !== "object") return;

    expect(resource, `${label} response must not use the tampered canonical id`).not.toHaveProperty("id", MALICIOUS_ID);

    for (const field of SERVER_MANAGED_FIELDS) {
        expect(resource[field], `${label} response must not echo tampered ${field}`).not.toBe(
            field === "tenant_id" ? MALICIOUS_TENANT_ID : MALICIOUS_AUDIT_USER_ID,
        );
        expect(resource[field], `${label} response must not echo tampered ${field}`).not.toBe(
            MALICIOUS_AUDIT_TIMESTAMP,
        );
    }
}

async function tamperNextPostPayload(page, endpoint, mutate) {
    let tamperedPayload = null;
    let shouldTamper = true;
    const routePattern = `**${endpoint}`;

    const handler = async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (!shouldTamper || request.method() !== "POST" || pathname !== endpoint) {
            await route.fallback();
            return;
        }

        shouldTamper = false;
        tamperedPayload = mutate(request.postDataJSON());
        await route.continue({
            headers: {
                ...request.headers(),
                "content-type": "application/json",
            },
            postData: JSON.stringify(tamperedPayload),
        });
    };

    await page.route(routePattern, handler);

    return {
        getTamperedPayload: () => tamperedPayload,
    };
}

async function waitForSettledApp(page) {
    await expect(
        page.getByTestId("group_configuration_container"),
        "The saved E2E auth state must already include the selected Administrator group. Run e2e:auth again if this prompt appears.",
    ).toBeHidden();

    await page.waitForFunction(
        () => {
            const bodyText = document.body?.innerText ?? "";
            return (
                !bodyText.includes("Cargando autenticacion") &&
                !bodyText.includes("Cargando autenticación") &&
                !bodyText.includes("Obteniendo informacion del grupo") &&
                !bodyText.includes("Obteniendo información del grupo") &&
                !bodyText.includes("Seleccione un grupo")
            );
        },
        null,
        { timeout: 60_000 },
    );
}

async function openCreateRoute(page, listPath, createPath) {
    await page.goto("/dashboard");
    await waitForSettledApp(page);

    const listLink = page.locator(`a[href="${listPath}"]`).first();
    if ((await listLink.count()) > 0) {
        await listLink.click();
        await waitForSettledApp(page);
    } else {
        await page.goto(listPath);
        await waitForSettledApp(page);
    }

    const createLink = page.locator(`a[href="${createPath}"]`).first();
    if ((await createLink.count()) > 0) {
        await createLink.click();
    } else {
        await page.goto(createPath);
    }

    await waitForSettledApp(page);
    await expect(page).toHaveURL(new RegExp(createPath.replaceAll("/", "\\/")));
}

async function openAgentFromDashboardProfileMenu(page) {
    await page.goto("/dashboard");
    await waitForSettledApp(page);

    await page.getByTestId("popover_menu_user_trigger").click();
    await expect(page.getByTestId("popover_menu_user_content")).toBeVisible();
    await page.getByTestId("btn_popover_menu_user_change_app").click();

    await page.waitForURL(/\/agent(\/|\?|$)/, { timeout: 30_000 });
    if (new URL(page.url()).pathname !== "/agent") {
        await page.goto("/agent");
    }
    await expect(page).toHaveURL(/\/agent(?:\?.*)?$/, { timeout: 30_000 });
    await waitForSettledApp(page);
}

async function submitAndCaptureCreate(page, endpoint, submit, { requireOk = true } = {}) {
    const [request, response] = await Promise.all([
        page.waitForRequest(endpointMatcher(endpoint)),
        page.waitForResponse(endpointMatcher(endpoint)),
        submit(),
    ]);

    const payload = request.postDataJSON();
    expect(payload, `${endpoint} create payload must not include a top-level canonical id`).not.toHaveProperty("id");
    assertNoServerManagedFields(payload);
    if (requireOk) {
        expect(response.ok(), `${endpoint} create response should be successful`).toBeTruthy();
    }
    return { payload, status: response.status() };
}

async function submitAndCaptureTamperedCreate(page, endpoint, submit) {
    const tamper = await tamperNextPostPayload(page, endpoint, withMaliciousIdentityFields);
    const [, response] = await Promise.all([
        page.waitForRequest(endpointMatcher(endpoint)),
        page.waitForResponse(endpointMatcher(endpoint)),
        submit(),
    ]);
    const tamperedPayload = tamper.getTamperedPayload();

    expect(tamperedPayload, `${endpoint} tamper route should inject a malicious id`).toHaveProperty("id", MALICIOUS_ID);
    for (const field of SERVER_MANAGED_FIELDS) {
        expect(tamperedPayload, `${endpoint} tamper route should inject ${field}`).toHaveProperty(field);
    }

    assertResponseDoesNotTrustMaliciousFields(await responseJsonOrNull(response), endpoint);

    return { status: response.status(), ok: response.ok() };
}

async function validateCapturedCreate(endpoint, request, response) {
    expect(response.ok(), `${endpoint} create response should be successful`).toBeTruthy();
    const payload = request.postDataJSON();
    expect(payload, `${endpoint} create payload must not include a top-level canonical id`).not.toHaveProperty("id");
    assertNoServerManagedFields(payload);
    return { payload, status: response.status() };
}

async function submitAndCaptureAgentClient(page) {
    await expect(
        page.getByTestId("btn_section_save"),
        "Agent client create must start from /agent with the create/save action visible",
    ).toBeVisible();

    const tempRequestPromise = page
        .waitForRequest(endpointMatcher("/tempclients", { includeSubpaths: true }), { timeout: 20_000 })
        .catch(() => null);
    const tempResponsePromise = page
        .waitForResponse(endpointMatcher("/tempclients", { includeSubpaths: true }), { timeout: 20_000 })
        .catch(() => null);
    const clientRequestPromise = page.waitForRequest(endpointMatcher("/clients"), { timeout: 20_000 });
    const clientResponsePromise = page.waitForResponse(endpointMatcher("/clients"), { timeout: 20_000 });

    await page.getByTestId("btn_section_save").click();

    const [tempRequest, tempResponse, clientRequest, clientResponse] = await Promise.all([
        tempRequestPromise,
        tempResponsePromise,
        clientRequestPromise,
        clientResponsePromise,
    ]);

    const tempClient =
        tempRequest && tempResponse ? await validateCapturedCreate("/tempclients", tempRequest, tempResponse) : null;
    const finalClient = await validateCapturedCreate("/clients", clientRequest, clientResponse);

    return { tempClient, finalClient };
}

async function submitAndCaptureTamperedAgentClient(page) {
    await expect(
        page.getByTestId("btn_section_save"),
        "Agent client create must start from /agent with the create/save action visible",
    ).toBeVisible();

    const tamper = await tamperNextPostPayload(page, "/clients", withMaliciousIdentityFields);
    const [request, response] = await Promise.all([
        page.waitForRequest(endpointMatcher("/clients"), { timeout: 20_000 }),
        page.waitForResponse(endpointMatcher("/clients"), { timeout: 20_000 }),
        page.getByTestId("btn_section_save").click(),
    ]);

    const tamperedPayload = tamper.getTamperedPayload();

    expect(tamperedPayload, "/clients tamper route should inject a malicious id").toHaveProperty("id", MALICIOUS_ID);
    for (const field of SERVER_MANAGED_FIELDS) {
        expect(tamperedPayload, `/clients tamper route should inject ${field}`).toHaveProperty(field);
    }

    assertResponseDoesNotTrustMaliciousFields(await responseJsonOrNull(response), "/clients");

    return {
        payload: request.postDataJSON(),
        status: response.status(),
        ok: response.ok(),
    };
}

async function fillAgentClientDraft(page, { name, documentNumber }) {
    const draftRequestPromise = page
        .waitForRequest(endpointMatcher("/tempclients", { includeSubpaths: true }), { timeout: 8_000 })
        .catch(() => null);
    const draftResponsePromise = page
        .waitForResponse(endpointMatcher("/tempclients", { includeSubpaths: true }), { timeout: 8_000 })
        .catch(() => null);

    await chooseFirstDocumentType(page);
    await page.locator('input[data-testid="input_form_custom_nombres"]').fill(name);
    await page.locator('input[data-testid="input_form_custom_documento"]').fill(documentNumber);

    const [draftRequest, draftResponse] = await Promise.all([draftRequestPromise, draftResponsePromise]);

    return draftRequest && draftResponse ? validateCapturedCreate("/tempclients", draftRequest, draftResponse) : null;
}

async function chooseFirstDocumentType(page) {
    await page.getByTestId("select_literals_options").click();
    const option = page.locator('[data-testid^="select_literals_item_"]').first();
    await expect(option).toBeVisible();
    await option.click();
}

test.describe("object identity browser submissions", () => {
    test("broker adapter create omits client-owned identity and audit fields", async ({ page }) => {
        const name = `qa-e2e-identity-adapter-${runId}`;

        await openCreateRoute(page, "/broker/adapters", "/broker/adapters/create");
        await page.locator('input[data-testid="input_form_modal_name"]').fill(name);
        await page.locator('input[data-testid="input_form_modal_host"]').fill("localhost");
        await page.locator('input[data-testid="input_form_modal_port"]').fill("5672");
        await page.locator('input[data-testid="input_form_modal_queue"]').fill(`${name}-queue`);
        await page.locator('input[data-testid="input_form_modal_exchange"]').fill(`${name}-exchange`);
        await page.locator('input[data-testid="input_form_modal_vhost"]').fill("qavhost");
        await page.locator('input[data-testid="input_form_modal_username"]').fill("qa-e2e");
        await page.locator('input[data-testid="input_form_modal_password"]').fill("qa-e2e-password");

        const evidence = await submitAndCaptureCreate(page, "/broker-adapters", () =>
            page.getByTestId("btn_form_card_save").click(),
        );

        test.info().annotations.push({
            type: "qa-record",
            description: `${name} status=${evidence.status}`,
        });
    });

    test("broker mapper create omits client-owned identity and audit fields", async ({ page }) => {
        const name = `qa-e2e-identity-mapper-${runId}`;

        await openCreateRoute(page, "/broker/mappers", "/broker/mappers/create");
        await page.locator('input[data-testid="input_form_modal_name"]').fill(name);
        await page.locator('input[data-testid="input_form_modal_queue"]').fill(`${name}-queue`);

        const evidence = await submitAndCaptureCreate(
            page,
            "/broker-mappers",
            () => page.getByTestId("btn_form_card_save").click(),
            { requireOk: false },
        );

        test.info().annotations.push({
            type: "qa-record",
            description: `${name} request captured; live response status=${evidence.status}`,
        });
    });

    test("broker adapter create does not trust tampered browser identity and audit fields", async ({ page }) => {
        const name = `qa-e2e-identity-adapter-tamper-${runId}`;

        await openCreateRoute(page, "/broker/adapters", "/broker/adapters/create");
        await page.locator('input[data-testid="input_form_modal_name"]').fill(name);
        await page.locator('input[data-testid="input_form_modal_host"]').fill("localhost");
        await page.locator('input[data-testid="input_form_modal_port"]').fill("5672");
        await page.locator('input[data-testid="input_form_modal_queue"]').fill(`${name}-queue`);
        await page.locator('input[data-testid="input_form_modal_exchange"]').fill(`${name}-exchange`);
        await page.locator('input[data-testid="input_form_modal_vhost"]').fill("qavhost");
        await page.locator('input[data-testid="input_form_modal_username"]').fill("qa-e2e");
        await page.locator('input[data-testid="input_form_modal_password"]').fill("qa-e2e-password");

        const evidence = await submitAndCaptureTamperedCreate(page, "/broker-adapters", () =>
            page.getByTestId("btn_form_card_save").click(),
        );

        test.info().annotations.push({
            type: "qa-record",
            description: `${name} tampered id=${MALICIOUS_ID} response status=${evidence.status}`,
        });
    });

    test("agent client create from change-application flow omits client-owned identity and audit fields", async ({
        page,
    }) => {
        const name = `Qa Etoe Identity Client ${letterRunId}`;
        const documentNumber = `9${runId.slice(-9)}`;

        await openAgentFromDashboardProfileMenu(page);
        const draftEvidence = await fillAgentClientDraft(page, { name, documentNumber });

        const evidence = await submitAndCaptureAgentClient(page);

        test.info().annotations.push({
            type: "qa-record",
            description: `${name} documento=${documentNumber} draft=${draftEvidence?.status ?? evidence.tempClient?.status ?? "not emitted"} final=${evidence.finalClient.status}`,
        });
    });

    test("agent client create does not trust tampered final browser identity and audit fields", async ({ page }) => {
        const name = `Qa Etoe Identity Tamper Client ${letterRunId}`;
        const documentNumber = `8${runId.slice(-9)}`;

        await openAgentFromDashboardProfileMenu(page);
        const draftEvidence = await fillAgentClientDraft(page, { name, documentNumber });

        const evidence = await submitAndCaptureTamperedAgentClient(page);

        test.info().annotations.push({
            type: "qa-record",
            description: `${name} documento=${documentNumber} draft=${draftEvidence?.status ?? "not emitted"} tampered id=${MALICIOUS_ID} final=${evidence.status}`,
        });
    });
});
