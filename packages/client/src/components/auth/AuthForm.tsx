'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import {
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  getKeyFingerprint,
  encodeBase64,
} from '@/lib/crypto';
import { auth } from '@/lib/api';

interface AuthFormProps {
  mode: 'login' | 'register';
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [keyFingerprint, setKeyFingerprint] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        setLoadingMessage('Generating your encryption keys...');

        // Generate X25519 keypair
        const keyPair = generateKeyPair();

        setLoadingMessage('Encrypting your private key...');

        // Encrypt private key with password
        const { encrypted, salt } = await encryptPrivateKey(keyPair.secretKey, password);

        const fingerprint = getKeyFingerprint(keyPair.publicKey);
        setKeyFingerprint(fingerprint);

        setLoadingMessage('Creating your account...');

        const result = await auth.register({
          username,
          password,
          publicKey: encodeBase64(keyPair.publicKey),
          encryptedPrivateKey: encrypted,
          salt,
        });

        setAuth(result.token, result.user, keyPair.secretKey);
        router.push('/channels');
      } else {
        setLoadingMessage('Verifying credentials...');

        const result = await auth.login({ username, password });

        setLoadingMessage('Decrypting your private key...');

        // Decrypt the private key using the password
        const secretKey = await decryptPrivateKey(
          result.encryptedPrivateKey,
          result.salt,
          password
        );

        setAuth(result.token, result.user, secretKey);
        router.push('/channels');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-nexus-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-nexus-surface border border-nexus-border mb-4">
            <span className="text-3xl">&#128274;</span>
          </div>
          <h1 className="text-2xl font-bold text-nexus-text">Nexus Chat</h1>
          <p className="text-nexus-muted text-sm mt-1">End-to-end encrypted messaging</p>
        </div>

        {/* Form card */}
        <div className="bg-nexus-sidebar border border-nexus-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-nexus-text mb-6">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nexus-muted mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={2}
                maxLength={32}
                placeholder="Enter your username"
                className="w-full px-4 py-2.5 bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-blue transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nexus-muted mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 8 : 1}
                placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                className="w-full px-4 py-2.5 bg-nexus-bg border border-nexus-border rounded-lg text-nexus-text placeholder-nexus-muted focus:outline-none focus:border-nexus-blue transition-colors"
                disabled={loading}
              />
              {mode === 'register' && (
                <p className="text-xs text-nexus-muted mt-1">
                  This password encrypts your private key. If lost, your messages cannot be recovered.
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {loading && loadingMessage && (
              <div className="bg-nexus-surface border border-nexus-border rounded-lg px-4 py-3 text-sm text-nexus-muted flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-nexus-blue border-t-transparent rounded-full animate-spin" />
                {loadingMessage}
              </div>
            )}

            {keyFingerprint && (
              <div className="bg-nexus-accent/10 border border-nexus-accent/30 rounded-lg px-4 py-3 text-sm">
                <p className="text-nexus-accent font-medium">Keys generated successfully</p>
                <p className="text-nexus-muted mt-1">
                  Your key fingerprint:{' '}
                  <code className="font-mono text-nexus-text">{keyFingerprint}</code>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-nexus-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-nexus-muted mt-6">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-nexus-blue hover:underline">
                  Register
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/login" className="text-nexus-blue hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>

        {/* E2E notice */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-nexus-muted">
          <span>&#128274;</span>
          <span>Messages are encrypted on your device and cannot be read by Nexus servers.</span>
        </div>
      </div>
    </div>
  );
}
