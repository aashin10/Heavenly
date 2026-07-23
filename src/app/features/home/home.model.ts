export interface Domain {
  name: string;
  icon: string;
}

export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export interface ServiceIcon {
  id: string;
  name: string;
  icon: string;
}

/** A primary audience entry point on the homepage. */
export interface AudiencePath {
  icon: string;
  title: string;
  description: string;
  cta: string;
  link: string;
  queryParams?: Record<string, string>;
}

/**
 * A line of business. Driven from a config array so new streams can be added
 * without touching the layout.
 */
export interface BusinessStream {
  icon: string;
  title: string;
  description: string;
  link: string;
  fragment?: string;
}

/** A headline trust/credibility point. */
export interface TrustPoint {
  icon: string;
  label: string;
  sublabel: string;
}
