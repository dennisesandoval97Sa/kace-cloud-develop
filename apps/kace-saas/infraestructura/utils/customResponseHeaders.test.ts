import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { beforeAll, describe, expect, it, vi } from "vitest";

const DOMAINS = "localhost:5174 *.konecta.cloud *.amazonaws.com";

let template: Template;
let enforcedPolicy: string;
let reportOnlyValue: string;

beforeAll(async () => {
    // dotenv.config() no pisa las variables ya presentes en process.env,
    // así que fijarlas antes del import hace el test independiente del .env real.
    process.env.APPS_CONTENT_SECURITY_POLICY_DOMAINS = DOMAINS;
    process.env.APPS_ENVIRONMENT = "staging";

    const { default: customResponseHeaders } = await import("./customResponseHeaders");
    const stack = new Stack(new App(), "TestStack");

    new cloudfront.ResponseHeadersPolicy(stack, "TestPolicy", {
        responseHeadersPolicyName: "TestPolicy",
        ...customResponseHeaders,
    });

    template = Template.fromStack(stack);

    // Se calculan una sola vez aquí y se comparten entre tests para no duplicar
    // la extracción de la política enforced / Report-Only en cada `it`.
    const policies = template.findResources("AWS::CloudFront::ResponseHeadersPolicy");
    const config = Object.values(policies)[0].Properties.ResponseHeadersPolicyConfig;

    enforcedPolicy = config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
    reportOnlyValue = config.CustomHeadersConfig.Items.find(
        (item: { Header: string }) => item.Header === "Content-Security-Policy-Report-Only",
    ).Value;
});

describe("customResponseHeaders", () => {
    it("emite la cabecera Content-Security-Policy-Report-Only con su propio valor", () => {
        template.hasResourceProperties(
            "AWS::CloudFront::ResponseHeadersPolicy",
            Match.objectLike({
                ResponseHeadersPolicyConfig: Match.objectLike({
                    CustomHeadersConfig: Match.objectLike({
                        Items: Match.arrayWith([
                            Match.objectLike({
                                Header: "Content-Security-Policy-Report-Only",
                                Override: true,
                            }),
                        ]),
                    }),
                }),
            }),
        );

        // Directivas candidatas que solo viven en Report-Only (aún no promovidas):
        // si el valor de la cabecera se vaciara o corrompiera, esto lo detecta.
        expect(reportOnlyValue).toContain("style-src-elem 'self'");
        expect(reportOnlyValue).toContain("form-action 'self'");
    });

    it("configura HSTS con un año, includeSubDomains y override", () => {
        template.hasResourceProperties(
            "AWS::CloudFront::ResponseHeadersPolicy",
            Match.objectLike({
                ResponseHeadersPolicyConfig: Match.objectLike({
                    SecurityHeadersConfig: Match.objectLike({
                        StrictTransportSecurity: Match.objectLike({
                            AccessControlMaxAgeSec: 31536000,
                            IncludeSubdomains: true,
                            Override: true,
                        }),
                    }),
                }),
            }),
        );
    });

    it("incluye las tres directivas del hallazgo en la política enforced, con override", () => {
        template.hasResourceProperties(
            "AWS::CloudFront::ResponseHeadersPolicy",
            Match.objectLike({
                ResponseHeadersPolicyConfig: Match.objectLike({
                    SecurityHeadersConfig: Match.objectLike({
                        ContentSecurityPolicy: Match.objectLike({
                            Override: true,
                        }),
                    }),
                }),
            }),
        );

        expect(enforcedPolicy).toContain("base-uri 'none'");
        expect(enforcedPolicy).toContain("object-src 'none'");
        expect(enforcedPolicy).toContain("frame-ancestors 'none'");
    });

    it("no filtra la política Report-Only dentro de la cabecera enforced", () => {
        expect(enforcedPolicy).not.toContain("style-src-elem");
        expect(enforcedPolicy).not.toContain("form-action");
    });
});

describe("customResponseHeaders en producción", () => {
    it("no emite ninguna cabecera Content-Security-Policy-Report-Only", async () => {
        // El módulo lee APPS_ENVIRONMENT en su nivel superior, así que hay que resetear
        // el caché de módulos para reevaluarlo con el entorno cambiado.
        vi.resetModules();
        process.env.APPS_ENVIRONMENT = "production";

        const { default: prodHeaders } = await import("./customResponseHeaders");
        const stack = new Stack(new App(), "ProdStack");

        new cloudfront.ResponseHeadersPolicy(stack, "ProdPolicy", {
            responseHeadersPolicyName: "ProdPolicy",
            ...prodHeaders,
        });

        const prodTemplate = Template.fromStack(stack);
        const policies = prodTemplate.findResources("AWS::CloudFront::ResponseHeadersPolicy");
        const config = Object.values(policies)[0].Properties.ResponseHeadersPolicyConfig;

        expect(JSON.stringify(config)).not.toContain("Report-Only");
        expect(config.CustomHeadersConfig?.Items ?? []).toEqual([]);

        // La política enforced sí sigue intacta: producción pierde la medición, no el blindaje.
        expect(config.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy).toContain("base-uri 'none'");
        expect(config.SecurityHeadersConfig.StrictTransportSecurity.AccessControlMaxAgeSec).toBe(31536000);
    });
});
