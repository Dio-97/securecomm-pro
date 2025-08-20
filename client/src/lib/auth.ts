import { apiRequest } from "./queryClient";
import type { LoginRequest } from "@shared/schema";

// Storage keys for persistent login
const PERSISTENT_LOGIN_KEY = 'securecomm_persistent_login';
const CREDENTIALS_KEY = 'securecomm_credentials';

export interface StoredCredentials {
  username: string;
  encryptedPassword: string;
  timestamp: number;
}

// Simple encryption for localStorage (not cryptographically secure, just obfuscation)
function simpleEncrypt(text: string): string {
  return btoa(text.split('').reverse().join(''));
}

function simpleDecrypt(encrypted: string): string {
  return atob(encrypted).split('').reverse().join('');
}

export function isPersistentLoginEnabled(): boolean {
  return localStorage.getItem(PERSISTENT_LOGIN_KEY) === 'true';
}

export function enablePersistentLogin(): void {
  localStorage.setItem(PERSISTENT_LOGIN_KEY, 'true');
}

export function disablePersistentLogin(): void {
  localStorage.removeItem(PERSISTENT_LOGIN_KEY);
  localStorage.removeItem(CREDENTIALS_KEY);
}

export function saveCredentials(username: string, password: string): void {
  if (isPersistentLoginEnabled()) {
    const credentials: StoredCredentials = {
      username,
      encryptedPassword: simpleEncrypt(password),
      timestamp: Date.now()
    };
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  }
}

export function getStoredCredentials(): StoredCredentials | null {
  if (!isPersistentLoginEnabled()) return null;
  
  const stored = localStorage.getItem(CREDENTIALS_KEY);
  if (!stored) return null;
  
  try {
    const credentials: StoredCredentials = JSON.parse(stored);
    // Check if credentials are not older than 30 days
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - credentials.timestamp > thirtyDaysMs) {
      localStorage.removeItem(CREDENTIALS_KEY);
      return null;
    }
    return credentials;
  } catch {
    return null;
  }
}

export function getDecryptedPassword(credentials: StoredCredentials): string {
  return simpleDecrypt(credentials.encryptedPassword);
}

export async function login(credentials: LoginRequest) {
  const response = await apiRequest("POST", "/api/auth/login", credentials);
  return response.json();
}

export async function attemptAutoLogin(): Promise<any | null> {
  const storedCredentials = getStoredCredentials();
  if (!storedCredentials) return null;
  
  try {
    const password = getDecryptedPassword(storedCredentials);
    const result = await login({
      username: storedCredentials.username,
      password
    });
    return result;
  } catch {
    // If auto-login fails, remove stored credentials
    localStorage.removeItem(CREDENTIALS_KEY);
    return null;
  }
}
