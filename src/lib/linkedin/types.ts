// Types for the LinkedIn Marketing API integration.

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms when the access token expires */
  expiresAt: number;
  /** epoch ms when the refresh token expires (if provided) */
  refreshExpiresAt?: number;
  scope?: string;
}

export interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

export interface AdAccount {
  /** e.g. urn:li:sponsoredAccount:123456789 */
  urn: string;
  id: number;
  name: string;
  currency?: string;
  status?: string;
}

/** A resolved targeting facet: the LinkedIn facet URN + the entity URNs. */
export interface ResolvedFacet {
  facetUrn: string; // e.g. urn:li:adTargetingFacet:locations
  values: string[]; // e.g. ["urn:li:geo:103644278"]
  unresolved?: string[]; // input values we couldn't map to a URN
}

export interface AudienceCountResult {
  audienceId: string;
  total?: number; // active audience count
  active?: number;
  note?: string;
  raw?: unknown;
}

export interface CreateCampaignInput {
  audienceId: string; // which of our designed audiences
  copyId?: string; // which ad-copy variant to reference
  adAccountUrn: string; // urn:li:sponsoredAccount:...
  dailyBudgetUsd?: number;
  /** Campaigns are always created PAUSED for human review before launch. */
}
