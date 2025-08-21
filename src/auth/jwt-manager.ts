import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import jwt from 'jsonwebtoken';
import { AuthConfig, JWTPayload, CachedToken } from '../types/config.js';

export class JWTManager {
  private privateKey: string;
  private keyId: string;
  private issuerId: string;
  private tokenCache: Map<string, CachedToken>;

  constructor(config: AuthConfig) {
    // Validate P8 file exists
    if (!existsSync(config.p8Path)) {
      throw new Error(`P8 key file not found at: ${config.p8Path}`);
    }

    // Load the private key
    this.privateKey = this.loadP8Key(config.p8Path);
    this.keyId = config.keyId;
    this.issuerId = config.issuerId;
    this.tokenCache = new Map();

    // Validate required fields
    if (!this.keyId || !this.issuerId) {
      throw new Error('Missing required auth config: keyId and issuerId are required');
    }

    // JWT Manager initialized
  }

  /**
   * Get a valid JWT token, using cache if available
   */
  async getToken(): Promise<string> {
    const cacheKey = 'primary';
    const cached = this.tokenCache.get(cacheKey);
    
    // Check if we have a valid cached token
    if (cached && cached.expiry > new Date()) {
      return cached.token;
    }

    // Generate new token
    const token = this.generateJWT();
    
    // Cache it for 19 minutes (1 minute buffer before 20-minute expiry)
    this.tokenCache.set(cacheKey, {
      token,
      expiry: new Date(Date.now() + 19 * 60 * 1000)
    });

    return token;
  }

  /**
   * Generate a new JWT token for App Store Connect
   */
  private generateJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload: JWTPayload = {
      iss: this.issuerId,
      iat: now,
      exp: now + (20 * 60), // 20 minutes from now
      aud: 'appstoreconnect-v1'
    };

    try {
      // Sign with ES256 algorithm using the P8 private key
      const token = jwt.sign(payload, this.privateKey, {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: this.keyId,
          typ: 'JWT'
        }
      });

      return token;
    } catch (error) {
      throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load and validate P8 private key from file
   */
  private loadP8Key(p8Path: string): string {
    try {
      const keyContent = readFileSync(p8Path, 'utf8');
      
      // Check if it has the proper format
      if (!keyContent.includes('BEGIN PRIVATE KEY') || !keyContent.includes('END PRIVATE KEY')) {
        throw new Error('Invalid P8 key format. Must include BEGIN/END PRIVATE KEY markers');
      }

      return keyContent;
    } catch (error) {
      throw new Error(`Failed to load P8 key from ${p8Path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear the token cache (useful for testing or force refresh)
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Validate the current configuration can generate valid tokens
   */
  async validate(): Promise<boolean> {
    try {
      const token = await this.getToken();
      
      // Decode to verify structure
      const decoded = jwt.decode(token) as JWTPayload;
      
      if (!decoded || decoded.iss !== this.issuerId || decoded.aud !== 'appstoreconnect-v1') {
        throw new Error('Generated token has invalid structure');
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}