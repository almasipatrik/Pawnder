#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CertificateStack } from '../lib/certificate-stack';
import { PawnderInfraStack } from '../lib/pawnder-infra-stack';

const app = new cdk.App();

// Target domain configuration
const domainName = app.node.tryGetContext('domainName') || 'pawnder.hu';
const lightsailRegion = app.node.tryGetContext('lightsailRegion') || 'eu-central-1';
const lightsailAz = app.node.tryGetContext('lightsailAvailabilityZone') || `${lightsailRegion}a`;
const bundleId = app.node.tryGetContext('lightsailBundleId') || 'micro_3_0';
const blueprintId = app.node.tryGetContext('lightsailBlueprintId') || 'ubuntu_24_04';

// Environment resolution
const defaultAccount = process.env.CDK_DEFAULT_ACCOUNT;

// 1. ACM Certificate Stack (ALWAYS in us-east-1 because CloudFront requires certificates in us-east-1)
const certStack = new CertificateStack(app, 'PawnderCertificateStack', {
  domainName,
  env: {
    account: defaultAccount,
    region: 'us-east-1',
  },
  description: `Pawnder Wildcard ACM SSL Certificate for ${domainName} (us-east-1)`,
});

// Certificate ARN can be passed via context, environment variable, or taken directly from certStack
const certArn =
  app.node.tryGetContext('certificateArn') ||
  process.env.PAWNDER_CERT_ARN;

// 2. Main Infrastructure Stack in Frankfurt (eu-central-1)
// Contains S3 Frontend, CloudFront CDN, and Lightsail VPS with Static IP
new PawnderInfraStack(app, 'PawnderInfraStack', {
  domainName,
  certificateArn: certArn,
  availabilityZone: lightsailAz,
  bundleId,
  blueprintId,
  env: {
    account: defaultAccount,
    region: lightsailRegion,
  },
  description: `Pawnder Production Infrastructure (S3 + CloudFront + Lightsail) in ${lightsailRegion}`,
});

app.synth();

