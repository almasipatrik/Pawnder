import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as lightsail from 'aws-cdk-lib/aws-lightsail';
import { Construct } from 'constructs';

export interface PawnderInfraStackProps extends cdk.StackProps {
  domainName: string;
  certificateArn?: string;
  availabilityZone?: string;
  bundleId?: string;
  blueprintId?: string;
}

export class PawnderInfraStack extends cdk.Stack {
  public readonly frontendBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly lightsailInstance: lightsail.CfnInstance;
  public readonly lightsailStaticIp: lightsail.CfnStaticIp;

  constructor(scope: Construct, id: string, props: PawnderInfraStackProps) {
    super(scope, id, props);

    const {
      domainName,
      certificateArn,
      availabilityZone = 'eu-central-1a',
      bundleId = 'micro_3_0',
      blueprintId = 'ubuntu_24_04',
    } = props;

    // =========================================================================
    // 1. FRONTEND: S3 BUCKET (Private + Encrypted)
    // =========================================================================
    this.frontendBucket = new s3.Bucket(this, 'PawnderFrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // =========================================================================
    // 2. FRONTEND: CLOUDFRONT DISTRIBUTION (CDN + SSL)
    // =========================================================================
    let certificate: acm.ICertificate | undefined;
    let customDomainNames: string[] | undefined;

    if (certificateArn) {
      certificate = acm.Certificate.fromCertificateArn(
        this,
        'PawnderCertificate',
        certificateArn,
      );
      customDomainNames = [domainName, `www.${domainName}`];
    }

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(
      this.frontendBucket,
    );

    this.distribution = new cloudfront.Distribution(
      this,
      'PawnderCloudFrontDistribution',
      {
        comment: 'Pawnder Frontend CDN Distribution (S3 + Next.js static export)',
        defaultRootObject: 'index.html',
        certificate,
        domainNames: customDomainNames,
        defaultBehavior: {
          origin: s3Origin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        // Client-side single page app routing for Next.js (403/404 -> /index.html)
        errorResponses: [
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(5),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: '/index.html',
            ttl: cdk.Duration.minutes(5),
          },
        ],
      },
    );

    // =========================================================================
    // 3. BACKEND: AWS LIGHTSAIL INSTANCE (Docker host for NestJS + DB + Scraper)
    // =========================================================================
    const userDataScript = `#!/bin/bash
set -e

# Update system packages
apt-get update -y
apt-get install -y ca-certificates curl gnupg git ufw

# Set up 2GB swap space (crucial for 1GB RAM instance to safely run Docker builds/Postgres)
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Install official Docker Engine & Docker Compose
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# Setup Pawnder application directory
mkdir -p /opt/pawnder
chown -R ubuntu:ubuntu /opt/pawnder

# Firewall rules
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "Pawnder Lightsail instance provisioning completed successfully!" > /var/log/pawnder-init.log
`;

    this.lightsailInstance = new lightsail.CfnInstance(
      this,
      'PawnderBackendInstance',
      {
        instanceName: 'pawnder-backend-server',
        availabilityZone,
        bundleId,
        blueprintId,
        userData: userDataScript,
        networking: {
          ports: [
            { fromPort: 22, toPort: 22, protocol: 'tcp' },
            { fromPort: 80, toPort: 80, protocol: 'tcp' },
            { fromPort: 443, toPort: 443, protocol: 'tcp' },
          ],
        },
        tags: [
          { key: 'Project', value: 'Pawnder' },
          { key: 'Component', value: 'Backend-API-Database' },
        ],
      },
    );

    // Fixed Static IPv4 address for the Lightsail instance
    this.lightsailStaticIp = new lightsail.CfnStaticIp(
      this,
      'PawnderBackendStaticIp',
      {
        staticIpName: 'pawnder-backend-static-ip',
        attachedTo: this.lightsailInstance.instanceName,
      },
    );
    this.lightsailStaticIp.addDependency(this.lightsailInstance);

    // =========================================================================
    // 4. CLOUDFORMATION OUTPUTS (All DNS records needed for Rackhost)
    // =========================================================================
    new cdk.CfnOutput(this, 'FrontendS3BucketName', {
      value: this.frontendBucket.bucketName,
      description: 'S3 Bucket name for frontend static deployment',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.distribution.distributionDomainName,
      description:
        'CloudFront Domain Name (Target for pawnder.hu CNAME / ALIAS in Rackhost)',
    });

    new cdk.CfnOutput(this, 'LightsailStaticIpAddress', {
      value: this.lightsailStaticIp.attrIpAddress,
      description:
        'Lightsail Static Public IP (Target for api.pawnder.hu A-record in Rackhost)',
    });

    new cdk.CfnOutput(this, 'RackhostDnsConfigSummary', {
      value: `1) CNAME pawnder.hu -> ${this.distribution.distributionDomainName} | 2) A-record api.pawnder.hu -> ${this.lightsailStaticIp.attrIpAddress}`,
      description: 'Quick Rackhost DNS instructions',
    });
  }
}