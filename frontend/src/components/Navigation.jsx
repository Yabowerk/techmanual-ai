import { useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppContext } from '../context/AppContext'

const Navigation = () => {
  const { user, logout } = useContext(AppContext)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/auth')
  }

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xl font-bold text-slate-50 hover:text-blue-400 transition"
          >
            TechManual AI
          </button>
          
          <div className="flex space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                isActive('/dashboard')
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              Dashboard
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-slate-300 text-sm">
            Welcome, {user?.name || user?.email}
          </span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navigation