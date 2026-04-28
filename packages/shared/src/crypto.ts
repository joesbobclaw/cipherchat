import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

/**
 * Generate an X25519 keypair for ECDH key exchange.
 */
export function generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
  return nacl.box.keyPair();
}

/**
 * Get a short hex fingerprint of a public key (first 8 bytes).
 */
export function getKeyFingerprint(publicKey: Uint8Array): string {
  return Array.from(publicKey.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encrypt a private key with a password using PBKDF2 + AES-GCM.
 * Uses the Web Crypto API (browser/Node 18+).
 */
export async function encryptPrivateKey(
  privateKey: Uint8Array,
  password: string
): Promise<{ encrypted: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    privateKey
  );

  // Prepend the IV to the ciphertext
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return {
    encrypted: encodeBase64(combined),
    salt: encodeBase64(saltBytes),
  };
}

/**
 * Decrypt a private key that was encrypted with encryptPrivateKey.
 */
export async function decryptPrivateKey(
  encrypted: string,
  salt: string,
  password: string
): Promise<Uint8Array> {
  const combined = decodeBase64(encrypted);
  const saltBytes = decodeBase64(salt);
  const enc = new TextEncoder();

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    ciphertext
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Encrypt a direct message using X25519-XSalsa20-Poly1305 (nacl.box).
 */
export function encryptDM(
  message: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = encodeUTF8(message);
  const encrypted = nacl.box(messageBytes, nonce, recipientPublicKey, senderSecretKey);

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a direct message.
 */
export function decryptDM(
  ciphertext: string,
  nonce: string,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string {
  const decrypted = nacl.box.open(
    decodeBase64(ciphertext),
    decodeBase64(nonce),
    senderPublicKey,
    recipientSecretKey
  );

  if (!decrypted) {
    throw new Error('Failed to decrypt DM: invalid ciphertext or keys');
  }

  return decodeUTF8(decrypted);
}

/**
 * Generate a random symmetric channel key (32 bytes for XSalsa20).
 */
export function generateChannelKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

/**
 * Encrypt a channel key for a specific recipient using nacl.box.
 * Returns a base64 string.
 */
export function encryptChannelKey(
  channelKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(channelKey, nonce, recipientPublicKey, senderSecretKey);

  // Prepend nonce to ciphertext
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce, 0);
  combined.set(encrypted, nonce.length);

  return encodeBase64(combined);
}

/**
 * Decrypt a channel key that was encrypted with encryptChannelKey.
 */
export function decryptChannelKey(
  encryptedKey: string,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): Uint8Array {
  const combined = decodeBase64(encryptedKey);
  const nonce = combined.slice(0, nacl.box.nonceLength);
  const ciphertext = combined.slice(nacl.box.nonceLength);

  const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);

  if (!decrypted) {
    throw new Error('Failed to decrypt channel key: invalid ciphertext or keys');
  }

  return decrypted;
}

/**
 * Encrypt a channel message using the symmetric channel key (nacl.secretbox).
 */
export function encryptMessage(
  message: string,
  channelKey: Uint8Array
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = encodeUTF8(message);
  const encrypted = nacl.secretbox(messageBytes, nonce, channelKey);

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a channel message using the symmetric channel key.
 */
export function decryptMessage(
  ciphertext: string,
  nonce: string,
  channelKey: Uint8Array
): string {
  const decrypted = nacl.secretbox.open(
    decodeBase64(ciphertext),
    decodeBase64(nonce),
    channelKey
  );

  if (!decrypted) {
    throw new Error('Failed to decrypt message: invalid ciphertext or key');
  }

  return decodeUTF8(decrypted);
}
