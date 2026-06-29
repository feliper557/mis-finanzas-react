import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { firebaseReady } from '../firebase'
import { Btn } from './ui'
import { inputCls } from './Sheet'

function traduce(e: { code?: string; message?: string }): string {
  const map: Record<string, string> = {
    'auth/invalid-email': 'Correo inválido',
    'auth/user-not-found': 'No existe una cuenta con ese correo',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta',
    'auth/weak-password': 'Contraseña muy débil (mínimo 6 caracteres)',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google',
    'auth/invalid-credential': 'Correo o contraseña incorrectos',
    'auth/network-request-failed': 'Sin conexión a internet',
  }
  return map[e?.code ?? ''] ?? e?.message ?? 'Error desconocido'
}

export function Login() {
  const { loginGoogle, loginEmail, signupEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')

  const run = (p: Promise<void>) => {
    setErr('')
    p.catch((e) => setErr(traduce(e)))
  }

  return (
    <div
      className="grid min-h-screen place-items-center p-5"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #2e1065 0%, #0F1117 65%)' }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-white/[0.04] p-7 backdrop-blur-sm">
        <div className="flex justify-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/20 text-3xl">
            💜
          </div>
        </div>
        <h1 className="mt-3 text-center text-2xl font-bold tracking-tight">Mis Finanzas</h1>
        <p className="mt-1 text-center text-sm text-white/40">Tu presupuesto, en cualquier dispositivo</p>

        {!firebaseReady && (
          <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-400">
            Falta configurar Firebase. Crea el archivo <code className="font-mono">.env</code> con tus credenciales.
          </p>
        )}

        <button
          onClick={() => run(loginGoogle())}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] bg-white py-3 text-sm font-bold text-slate-800 transition hover:bg-white/90 active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Entrar con Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-white/25">
          <span className="h-px flex-1 bg-white/10" />
          o con tu correo
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <input
          className={inputCls}
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className={`${inputCls} mt-2`}
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        <div className="mt-3 flex gap-2">
          <Btn className="flex-1" onClick={() => run(loginEmail(email, pass))}>
            Entrar
          </Btn>
          <Btn variant="ghost" className="flex-1" onClick={() => run(signupEmail(email, pass))}>
            Crear cuenta
          </Btn>
        </div>

        {err && <p className="mt-3 text-center text-sm text-rose-400">{err}</p>}
      </div>
    </div>
  )
}
