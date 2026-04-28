import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthUser {
  id: string;
  username: string;
  publicKey: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  secretKey: Uint8Array | null; // decrypted private key, stored in memory only
  setAuth: (token: string, user: AuthUser, secretKey: Uint8Array) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      secretKey: null,

      setAuth: (token, user, secretKey) => {
        set({ token, user, secretKey });
      },

      clearAuth: () => {
        set({ token: null, user: null, secretKey: null });
      },

      isAuthenticated: () => {
        return get().token !== null && get().user !== null;
      },
    }),
    {
      name: 'nexus-auth',
      storage: createJSONStorage(() => localStorage),
      // Only persist token and user, NOT secretKey
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);
