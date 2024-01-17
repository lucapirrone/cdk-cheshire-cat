import { Construct } from 'constructs';
import { CustomDomain, CustomDomainOverrides, CustomDomainProps } from './CustomDomain';


interface DomainOverrides {
  readonly catDomainProps: CustomDomainOverrides;
  readonly qdrantDomainProps: CustomDomainOverrides;
}
interface DomainProps {
  /**
   * Props to configure cat {@link CustomDomain}. See details on how to customize at
   * {@link CustomDomainProps}
   */
  readonly catDomainProps: CustomDomainProps;
  /**
   * Props to configure qdrant {@link CustomDomain}. See details on how to customize at
   * {@link CustomDomainProps}
   */
  readonly qdrantDomainProps: CustomDomainProps;
  /**
     * Override props for every construct.
     */
  readonly overrides?: DomainOverrides;
}

class Domain extends Construct {
  public catDomain: CustomDomain;
  public qdrantDomain: CustomDomain;

  constructor(scope: Construct, id: string, props: DomainProps) {
    super(scope, id);
    this.catDomain = new CustomDomain(this, 'Domain', {
      ...props.catDomainProps,
      ...props.overrides?.catDomainProps,
    });
    this.qdrantDomain = new CustomDomain(this, 'QdrantDomain', {
      ...props.qdrantDomainProps,
      ...props.overrides?.qdrantDomainProps,
    });
  }
}


export {
  DomainOverrides,
  DomainProps,
  Domain,
};