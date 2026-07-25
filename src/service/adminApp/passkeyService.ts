import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";
import type { AxiosInstance } from "axios";

function base64UrlToBuffer(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function bufferToBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

class PasskeyService {
  private serverip: string;
  private axios: AxiosInstance;
  private authenticationAbortController: AbortController | null = null;

  constructor(serverip: string, axios: AxiosInstance) {
    this.serverip = serverip;
    this.axios = axios;
  }

  supportsPasskeys() {
    return browserSupportsWebAuthn();
  }

  platformAuthenticatorAvailable() {
    return platformAuthenticatorIsAvailable();
  }

  async getPasskeys() {
    const response = await this.axios.get(`${this.serverip}/auth/passkeys`);
    return response.data as Array<{
      id: number;
      name: string;
      deviceType: string | null;
      backedUp: boolean;
      transports: string[];
      createdAt: string;
      lastUsedAt: string | null;
    }>;
  }

  async register(name?: string) {
    const options = (await this.axios.post(
      `${this.serverip}/auth/passkeys/registration/options`,
    )).data;
    const response = await startRegistration({ optionsJSON: options });
    await this.axios.post(`${this.serverip}/auth/passkeys/registration/verify`, {
      name,
      response,
    });
  }

  async authenticate() {
    const options = (await this.axios.post(
      `${this.serverip}/auth/passkeys/authentication/options`,
    )).data;
    this.cancelAuthentication();
    this.authenticationAbortController = new AbortController();
    const publicKey = {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      allowCredentials: options.allowCredentials?.map((credential: any) => ({
        ...credential,
        id: base64UrlToBuffer(credential.id),
      })),
    };
    let credential: PublicKeyCredential | null;
    try {
      credential = await navigator.credentials.get({
        publicKey,
        signal: this.authenticationAbortController.signal,
      }) as PublicKeyCredential | null;
    } finally {
      this.authenticationAbortController = null;
    }
    if (!credential) throw new Error("Authentication was not completed");
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
      id: credential.id,
      rawId: bufferToBase64Url(credential.rawId),
      response: {
        authenticatorData: bufferToBase64Url(response.authenticatorData),
        clientDataJSON: bufferToBase64Url(response.clientDataJSON),
        signature: bufferToBase64Url(response.signature),
        userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined,
      },
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
    };
  }

  cancelAuthentication() {
    if (!this.authenticationAbortController) return;
    this.authenticationAbortController.abort();
    this.authenticationAbortController = null;
  }

  async verify() {
    const response = await this.authenticate();
    await this.axios.post(`${this.serverip}/auth/passkeys/authentication/verify`, {
      response,
    });
  }

  async delete(id: number) {
    await this.axios.delete(`${this.serverip}/auth/passkeys/${id}`);
  }
}

export default PasskeyService;
