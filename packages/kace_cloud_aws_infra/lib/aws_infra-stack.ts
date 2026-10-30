import { Construct } from 'constructs';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { DomainName, SecurityPolicy } from 'aws-cdk-lib/aws-apigateway';
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets';
import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';

type AwsInfraStackProps = {
    stack?: StackProps;
    domain: string;
    subdomain: string;
    serviceName: string;
};

export class AwsInfraStack extends Stack {
    constructor(scope: Construct, id: string, props: AwsInfraStackProps) {
        super(scope, `${props.serviceName}${id}`, props.stack);

        const domain = props.domain;
        const hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
            domainName: domain,
        });

        if (!hostedZone) {
            throw new Error('Hosted zone not found');
        }

        const subdomain = props.subdomain;
        const certificate = new Certificate(this, 'APICertificate', {
            domainName: `*.${domain}`,
            validation: CertificateValidation.fromDns(hostedZone),
        });

        if (!certificate) {
            throw new Error('Certificate not found');
        }

        const apiDomainName = new DomainName(this, 'APIDomainName', {
            domainName: `${subdomain}.${domain}`,
            certificate: certificate,
            securityPolicy: SecurityPolicy.TLS_1_2,
        });

        if (!apiDomainName) {
            throw new Error('API Domain Name creation failed');
        }

        const aRecord = new ARecord(this, 'CustomDomainAliasRecord', {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new ApiGatewayDomain(apiDomainName)),
            recordName: subdomain,
        });
        aRecord.applyRemovalPolicy(RemovalPolicy.DESTROY);

        new CfnOutput(this, 'OutputAPIDomainName', {
            description: 'API Domain Name',
            value: apiDomainName.domainName,
        });
        new CfnOutput(this, 'OutputDomainNameAliasTarget', {
            description: 'API Domain Name Alias Domain Name',
            value: apiDomainName.domainNameAliasDomainName,
        });
        new CfnOutput(this, 'OutputDomainNameAliasHostedZoneId', {
            description: 'API Domain Name Alias Hosted Zone ID',
            value: apiDomainName.domainNameAliasHostedZoneId,
        });
    }
}
