import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface CertificateStackProps extends cdk.StackProps {
  domainName: string;
}

/**
 * Creates an ACM SSL certificate in us-east-1 (required for CloudFront distributions).
 * Uses DNS validation. CloudFormation will output the CNAME record name and value
 * that needs to be added to the Rackhost DNS manager.
 */
export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const { domainName } = props;

    // Request wildcard SSL certificate covering pawnder.hu and *.pawnder.hu
    const cert = new acm.Certificate(this, 'PawnderWildcardCertificate', {
      domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      validation: acm.CertificateValidation.fromDns(),
    });

    this.certificate = cert;
    this.certificateArn = cert.certificateArn;

    // Store certificate ARN in SSM Parameter Store in us-east-1 for cross-stack reference
    new ssm.StringParameter(this, 'PawnderCertArnParam', {
      parameterName: '/pawnder/acm/cert-arn',
      stringValue: cert.certificateArn,
      description: `ACM Wildcard Certificate ARN for ${domainName}`,
    });

    // Outputs for the user
    new cdk.CfnOutput(this, 'CertificateArnOutput', {
      value: cert.certificateArn,
      description: 'ACM Certificate ARN (us-east-1)',
      exportName: 'PawnderCertificateArn',
    });

    new cdk.CfnOutput(this, 'RackhostDnsValidationNote', {
      value: `Please check AWS Certificate Manager console in us-east-1 to copy the validation CNAME record to Rackhost DNS!`,
      description: 'Rackhost DNS validation instruction',
    });
  }
}

