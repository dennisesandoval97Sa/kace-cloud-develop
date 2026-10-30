import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BlockPublicAccess, Bucket, BucketPolicy } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import customErrorResponses from "../infraestructura/utils/customErrorResponses";
import customResponseHeaders from "../infraestructura/utils/customResponseHeaders";
import path = require("path");
import "dotenv/config";

const pathResource = path.join(__dirname, "../dist");
const stackName = `${process.env.APPS_SERVICE_NAME}kaceAdmin`;

export class DeploymentKaceAdminFrontService extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const domainName = process.env.APPS_DOMAIN as string;
        const subdomainName = process.env.APPS_ADMIN_SUBDOMAIN as string;
        const hostedZoneId = process.env.APPS_HOSTED_ZONE_ID as string;

        const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
            hostedZoneId,
            zoneName: domainName,
        });
        const certificateArn = process.env.APPS_CERTIFICATE_DOMAIN_ARN as string;
        const domainCert = certificatemanager.Certificate.fromCertificateArn(this, "domainCert", certificateArn);

        const hostingBucket = new Bucket(this, "FrontendBucket", {
            autoDeleteObjects: true,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const bucketPolicy = new BucketPolicy(this, "BucketPolicy", {
            bucket: hostingBucket,
        });
        bucketPolicy.document.addStatements(
            new iam.PolicyStatement({
                actions: ["s3:GetObject"],
                resources: [`${hostingBucket.bucketArn}/*`],
                principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
            }),
        );

        const customResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
            this,
            `${stackName}ResponseHeadersPolicy`,
            {
                responseHeadersPolicyName: `${stackName}CustomResponseHeadersPolicyKace`,
                ...customResponseHeaders,
            },
        );
        const distribution = new cloudfront.Distribution(this, "CloudfrontDistribution", {
            defaultBehavior: {
                origin: new S3Origin(hostingBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                responseHeadersPolicy: customResponseHeadersPolicy,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            },
            defaultRootObject: "index.html",
            errorResponses: customErrorResponses,
            domainNames: [`${subdomainName}.${domainName}`],
            certificate: domainCert,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
        });

        // El Content-Type lo infiere S3 de la extensión y no incluye charset.
        // El segundo despliegue re-sube los HTML con el charset explícito.
        // Re-subir en vez de excluirlos del primero es deliberado: excluirlos haría que
        // el prune del primero borrase index.html en cada deploy, dejando la SPA caída
        // durante unos segundos. La invalidación se mueve al segundo para que ocurra
        // cuando ambos ya subieron.
        const mainDeployment = new BucketDeployment(this, "BucketDeployment", {
            sources: [Source.asset(pathResource)],
            destinationBucket: hostingBucket,
        });

        const htmlDeployment = new BucketDeployment(this, "BucketDeploymentHtml", {
            sources: [Source.asset(pathResource)],
            destinationBucket: hostingBucket,
            exclude: ["*"],
            include: ["*.html"],
            contentType: "text/html; charset=utf-8",
            prune: false,
            distribution,
            distributionPaths: ["/*"],
        });
        htmlDeployment.node.addDependency(mainDeployment);

        const aRecord = new route53.ARecord(this, "AliasRecord", {
            zone: hostedZone,
            recordName: subdomainName,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
        });
        aRecord.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

        new cdk.CfnOutput(this, `${stackName}Dist`, {
            value: distribution.domainName,
            description: `The distribution URL for ${stackName}`,
            exportName: `${stackName}Dist`,
        });

        new cdk.CfnOutput(this, `${stackName}S3`, {
            value: hostingBucket.bucketName,
            description: `S3 bucket for ${stackName}`,
            exportName: `${stackName}S3`,
        });
    }
}
