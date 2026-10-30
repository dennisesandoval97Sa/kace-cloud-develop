import { Duration } from "aws-cdk-lib";
import { HeadersFrameOption } from "aws-cdk-lib/aws-cloudfront";
import * as dotenv from "dotenv";

import { buildEnforcedPolicy, buildReportOnlyPolicy, shouldEmitReportOnly } from "./contentSecurityPolicy";

dotenv.config({ path: "../../.env" });

const appsDomains = process.env.APPS_CONTENT_SECURITY_POLICY_DOMAINS;
if (!appsDomains) {
    throw new Error("APPS_CONTENT_SECURITY_POLICY_DOMAINS is not defined in .env file");
}

// La cabecera Report-Only es un instrumento de medición y nunca sale a producción.
// shouldEmitReportOnly lanza si APPS_ENVIRONMENT falta o trae un valor desconocido,
// para que una errata no la filtre a producción por descuido.
const reportOnlyHeaders = shouldEmitReportOnly(process.env.APPS_ENVIRONMENT)
    ? [
          {
              header: "Content-Security-Policy-Report-Only",
              value: buildReportOnlyPolicy(appsDomains),
              override: true,
          },
      ]
    : [];

export default {
    comment: "A default policy for kace",
    corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ["X-Custom-Header-1", "X-Custom-Header-2"],
        accessControlAllowMethods: ["GET", "POST"],
        accessControlAllowOrigins: ["*"],
        accessControlExposeHeaders: ["X-Custom-Header-1", "X-Custom-Header-2"],
        accessControlMaxAge: Duration.seconds(600),
        originOverride: true,
    },
    customHeadersBehavior: {
        // Cabecera temporal de la fase de medición, solo fuera de producción: el navegador
        // evalúa las directivas candidatas y reporta violaciones sin bloquear nada. Retirarla
        // cuando las candidatas de contentSecurityPolicy.ts se hayan promovido a
        // PROMOTED_DIRECTIVES o descartado con evidencia. En producción va siempre vacía.
        customHeaders: reportOnlyHeaders,
    },
    securityHeadersBehavior: {
        contentSecurityPolicy: {
            contentSecurityPolicy: buildEnforcedPolicy(appsDomains),
            override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: {
            frameOption: HeadersFrameOption.DENY,
            override: true,
        },
        // Exigido por el hallazgo WSTG-CONF-12 del pentest. max-age de un año es
        // semi-irreversible: una vez que un navegador lo pinea, seguirá exigiendo HTTPS para
        // este host hasta que expire, sin forma de revertirlo desde el servidor. includeSubdomains
        // limita el alcance a este host y sus subdominios (no a dominios hermanos como `api.`).
        // La ausencia de `preload` es deliberada: preload es efectivamente irreversible (requiere
        // enviar una solicitud de remoción y esperar a que se propague en los navegadores), y aquí
        // no se ha decidido comprometerse a ese nivel.
        strictTransportSecurity: {
            accessControlMaxAge: Duration.seconds(31536000),
            includeSubdomains: true,
            override: true,
        },
        permissionsPolicy: {
            values: [
                {
                    permission: "microphone",
                    values: ["*"],
                },
                {
                    permission: "speaker-selection",
                    values: ["*"],
                },
            ],
            override: true,
        },
    },
    removeHeaders: ["Server"],
    serverTimingSamplingRate: 50,
};
