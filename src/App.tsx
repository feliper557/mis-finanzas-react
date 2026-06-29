import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { Login } from './components/Login'
import { Layout } from './components/Layout'

function Gate() {
  const { user, loading } = useAuth()
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center text-white/30 text-sm">
        Cargando…
      </div>
    )
  if (!user) return <Login />
  return (
    <DataProvider>
      <Layout />
    </DataProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
