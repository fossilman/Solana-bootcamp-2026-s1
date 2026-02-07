import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface Participant {
  id: number
  wallet_address: string
  nickname?: string
}

interface AuthState {
  walletAddress: string | null
  token: string | null
  participantId: number | null
  participant: Participant | null
  connectWallet: (address: string, token: string, participantId: number, participant?: Participant) => void
  setParticipant: (participant: Participant) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      walletAddress: null,
      token: null,
      participantId: null,
      participant: null,
      connectWallet: (address, token, participantId, participant) =>
        set({ walletAddress: address, token, participantId, participant: participant || null }),
      setParticipant: (participant) => set({ participant }),
      clearAuth: () => set({ walletAddress: null, token: null, participantId: null, participant: null }),
    }),
    {
      name: 'arena-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

