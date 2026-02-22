/**
 * Credentials utilities
 *
 * Provides utilities for generating cryptographically secure authentication credentials.
 */

import { randomBytes } from "node:crypto";

/**
 * Length of the generated credentials (32 characters)
 */
export const CREDENTIAL_LENGTH = 32;

/**
 * Generate a cryptographically secure random string.
 * Uses crypto.randomBytes for secure randomness.
 *
 * @param length - The length of the string to generate (default: 32)
 * @returns A hex-encoded random string
 */
export function generateSecureToken(length: number = CREDENTIAL_LENGTH): string {
  // Generate random bytes - we need length/2 bytes since hex doubles the length
  const bytesNeeded = Math.ceil(length / 2);
  const randomBuffer = randomBytes(bytesNeeded);
  
  // Convert to hex and truncate to exact length
  return randomBuffer.toString("hex").slice(0, length);
}

/**
 * Authentication credentials for OpenCode server.
 * These credentials are stored only in memory and never persisted to disk.
 */
export interface ServerCredentials {
  /** Username for basic authentication */
  username: string;
  /** Password for basic authentication */
  password: string;
}

/**
 * Generate secure authentication credentials for the OpenCode server.
 * Returns a username/password pair with cryptographically random values.
 *
 * @returns ServerCredentials object with random username and password
 */
export function generateServerCredentials(): ServerCredentials {
  return {
    username: generateSecureToken(CREDENTIAL_LENGTH),
    password: generateSecureToken(CREDENTIAL_LENGTH),
  };
}

/**
 * Create the authentication header value for HTTP Basic Auth.
 *
 * @param credentials - The credentials to encode
 * @returns The base64-encoded Authorization header value
 */
export function createAuthHeader(credentials: ServerCredentials): string {
  const authString = `${credentials.username}:${credentials.password}`;
  return `Basic ${Buffer.from(authString).toString("base64")}`;
}

/**
 * Validate that credentials meet the required format.
 *
 * @param credentials - The credentials to validate
 * @returns true if credentials are valid
 * @throws Error if credentials are invalid
 */
export function validateCredentials(credentials: ServerCredentials): boolean {
  if (!credentials) {
    throw new Error("Credentials are required");
  }
  
  if (!credentials.username || credentials.username.length < CREDENTIAL_LENGTH) {
    throw new Error(`Username must be at least ${CREDENTIAL_LENGTH} characters`);
  }
  
  if (!credentials.password || credentials.password.length < CREDENTIAL_LENGTH) {
    throw new Error(`Password must be at least ${CREDENTIAL_LENGTH} characters`);
  }
  
  return true;
}
