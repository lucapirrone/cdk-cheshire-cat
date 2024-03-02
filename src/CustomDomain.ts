import * as cm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CustomDomainOverrides {
  readonly certificateProps?: cm.CertificateProps;
  readonly hostedZoneProviderProps?: route53.HostedZoneProps;
  readonly aRecordProps?: route53.ARecordProps;
  readonly aaaaRecordProps?: route53.AaaaRecordProps;
}

export interface CustomDomainProps {
  /**
   * An easy to remember address of your website. Only supports domains hosted
   * on [Route 53](https://aws.amazon.com/route53/). Used as `domainName` for
   * ACM `Certificate` if {@link CustomDomainProps.certificate} and
   * {@link CustomDomainProps.certificateDomainName} are `undefined`.
   * @example "example.com"
   */
  readonly domainName: string;
  /**
   * Subdomain used for this domain.
   * @example "cat" to use "cat.example.com" as full domain
   */
  readonly subDomain?: string;
  /**
   * You must create the hosted zone out-of-band.
   * You can lookup the hosted zone outside this construct and pass it in via this prop.
   * Alternatively if this prop is `undefined`, then the hosted zone will be
   * **looked up** (not created) via `HostedZone.fromLookup` with {@link CustomDomainProps.domainName}.
   */
  readonly hostedZone?: route53.IHostedZone;
  /**
   * If this prop is `undefined` then an ACM `Certificate` will be created based on {@link CustomDomainProps.domainName}
   * with DNS Validation. This prop allows you to control the TLS/SSL
   * certificate created. The certificate you create must be in the `us-east-1`
   * (N. Virginia) region as required by AWS CloudFront.
   *
   * Set this option if you have an existing certificate in the `us-east-1` region in AWS Certificate Manager you want to use.
   */
  readonly certificate?: cm.ICertificate;
  /**
   * Override props for every construct.
   */
  readonly overrides?: CustomDomainOverrides;
}

/**
 * Use a custom domain with `ChershireCat`. Requires a Route53 hosted zone to have been
 * created within the same AWS account.
 *
 * See {@link CustomDomainProps} TS Doc comments for detailed docs on how to customize.
 * This construct is helpful to user to not have to worry about interdependencies
 * between Route53 Hosted Zone, CloudFront Distribution, and Route53 Hosted Zone Records.
 *
 * Note, if you're using another service for domain name registration, you can
 * still create a Route53 hosted zone. Please see [Configuring DNS Delegation from
 * CloudFlare to AWS Route53](https://veducate.co.uk/dns-delegation-route53/)
 * as an example.
 */
export class CustomDomain extends Construct {
  /**
   * Domain name.
   */
  public domainName: string;
  /**
   * Full domain.
   */
  public fullDomain: string;
  /**
   * SubDomain name.
   */
  public subDomain?: string;
  /**
   * Route53 Hosted Zone.
   */
  hostedZone?: route53.IHostedZone;
  /**
   * ACM Certificate.
   */
  certificate?: cm.ICertificate;

  private props: CustomDomainProps;

  constructor(scope: Construct, id: string, props: CustomDomainProps) {
    super(scope, id);
    this.props = props;
    this.domainName = this.props.domainName;
    this.subDomain = this.props.subDomain;
    this.fullDomain = `${this.props.subDomain}.${this.props.domainName}`;
    this.hostedZone = this.getHostedZone();
    this.certificate = this.getCertificate();
  }

  private getHostedZone(): route53.IHostedZone | undefined {
    if (this.props.certificate) {return undefined;};
    if (!this.props.hostedZone) {
      return route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: this.props.domainName,
        ...this.props.overrides?.hostedZoneProviderProps,
      });
    } else {
      return this.props.hostedZone;
    }
  }

  private getCertificate(): cm.ICertificate {
    if (!this.props.certificate) {
      return new cm.Certificate(this, 'Certificate', {
        domainName: this.fullDomain,
        validation: cm.CertificateValidation.fromDns(this.hostedZone),
        ...this.props.overrides?.certificateProps,
      });
    } else {
      return this.props.certificate;
    }
  }
}
