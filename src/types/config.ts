export interface AuthConfig {
  keyId: string;
  issuerId: string;
  p8Path: string;
}

export interface ServerConfig {
  auth: AuthConfig;
  vendorNumber?: string;
  debug?: boolean;
}

export interface JWTPayload {
  iss: string;
  iat: number;
  exp: number;
  aud: string;
  scope?: string[];
}

export interface CachedToken {
  token: string;
  expiry: Date;
}