import type { AuthResponse } from "../types";
import { ApiError } from "./medmatch";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export interface BiometricCredentialInfo {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface BiometricStatusResponse {
  enabled: boolean;
  credentials: BiometricCredentialInfo[];
}

interface RawCredentialDescriptor {
  type?: string;
  id: string;
  transports?: string[];
}

interface RawCreationOptions {
  rp: { id?: string; name: string };
  challenge: string;
  user: { id: string; name: string; displayName: string };
  timeout?: number;
  excludeCredentials?: RawCredentialDescriptor[];
  authenticatorSelection?: Record<string, unknown>;
  attestation?: string;
  pubKeyCredParams?: Array<{ type: string; alg: number }>;
}

interface RawAssertionOptions {
  challenge: string;
  rpId?: string;
  allowCredentials?: RawCredentialDescriptor[];
  userVerification?: string;
  timeout?: number;
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {})
      }
    });
  } catch {
    throw new ApiError("Tidak dapat terhubung ke MedMatch API.", 0);
  }

  const rawBody = await response.text();
  let body: unknown = null;

  if (rawBody) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      body = rawBody;
    }
  }

  if (!response.ok) {
    const errorBody = body as { error?: string; detail?: string } | null;
    const message = errorBody?.error ?? errorBody?.detail ?? "Permintaan API gagal diproses.";
    throw new ApiError(message, response.status);
  }

  return body as T;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function getBiometricStatus(token: string): Promise<BiometricStatusResponse> {
  return request<BiometricStatusResponse>("/api/auth/biometric/status", { method: "GET" }, token);
}

function toCreationOptions(raw: RawCreationOptions): PublicKeyCredentialCreationOptions {
  return {
    rp: raw.rp,
    challenge: base64urlToBuffer(raw.challenge),
    user: {
      id: base64urlToBuffer(raw.user.id),
      name: raw.user.name,
      displayName: raw.user.displayName
    },
    pubKeyCredParams: (raw.pubKeyCredParams ?? [{ type: "public-key", alg: -7 }]) as PublicKeyCredentialParameters[],
    timeout: raw.timeout,
    excludeCredentials: raw.excludeCredentials?.map((item) => ({
      ...item,
      id: base64urlToBuffer(item.id)
    } as PublicKeyCredentialDescriptor)),
    authenticatorSelection: raw.authenticatorSelection as AuthenticatorSelectionCriteria | undefined,
    attestation: raw.attestation as AttestationConveyancePreference | undefined
  };
}

export async function registerBiometric(token: string): Promise<void> {
  const options = await request<RawCreationOptions>(
    "/api/auth/biometric/register/options",
    { method: "POST", body: JSON.stringify({}) },
    token
  );

  const credential = (await navigator.credentials.create({
    publicKey: toCreationOptions(options)
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new ApiError("Pendaftaran sidik jari dibatalkan.", 0);
  }

  const response = credential.response as AuthenticatorAttestationResponse;

  await request(
    "/api/auth/biometric/register",
    {
      method: "POST",
      body: JSON.stringify({
        credential: {
          id: credential.id,
          rawId: bufferToBase64url(credential.rawId),
          type: credential.type,
          response: {
            clientDataJSON: bufferToBase64url(response.clientDataJSON),
            attestationObject: bufferToBase64url(response.attestationObject),
            transports: typeof response.getTransports === "function" ? response.getTransports() : undefined
          },
          clientExtensionResults: credential.getClientExtensionResults()
        }
      })
    },
    token
  );
}

export async function deleteBiometric(token: string, credentialId: string): Promise<void> {
  await request(
    `/api/auth/biometric/${encodeURIComponent(credentialId)}`,
    { method: "DELETE" },
    token
  );
}

export async function loginWithBiometric(email: string): Promise<AuthResponse> {
  const options = await request<RawAssertionOptions>("/api/auth/biometric/login/options", {
    method: "POST",
    body: JSON.stringify({ email })
  });

  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64urlToBuffer(options.challenge),
      rpId: options.rpId,
      allowCredentials: options.allowCredentials?.map((item) => ({
        ...item,
        id: base64urlToBuffer(item.id)
      } as PublicKeyCredentialDescriptor)),
      userVerification: options.userVerification as UserVerificationRequirement | undefined,
      timeout: options.timeout
    }
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new ApiError("Login sidik jari dibatalkan.", 0);
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  return request<AuthResponse>("/api/auth/biometric/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      credential: {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          authenticatorData: bufferToBase64url(response.authenticatorData),
          signature: bufferToBase64url(response.signature),
          userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null
        },
        clientExtensionResults: credential.getClientExtensionResults()
      }
    })
  });
}
