import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider, firebaseReady } from '../firebase'

interface AuthCtx {
  user: User | null
  loading: boolean
  loginGoogle: () => Promise<void>
  loginEmail: (email: string, pass: string) => Promise<void>
  signupEmail: (email: string, pass: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const value: AuthCtx = {
    user,
    loading,
    loginGoogle: async () => { await signInWithPopup(auth, googleProvider) },
    loginEmail: async (e, p) => { await signInWithEmailAndPassword(auth, e, p) },
    signupEmail: async (e, p) => { await createUserWithEmailAndPassword(auth, e, p) },
    logout: async () => { await signOut(auth) },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return c
}
