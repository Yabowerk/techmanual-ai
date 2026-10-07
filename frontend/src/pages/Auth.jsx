import { useState, useContext, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import * as authService from '../services/authService'
import ErrorNotification from '../components/ErrorNotification'
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff } from 'react-icons/fi'

export default function Auth() {
  const { login, setErrorMessage, isAuthenticated } = useContext(AppContext)
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  })

  const navigate = useNavigate()
  const location = useLocation()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const switchMode = () => {
    setIsLogin((prev) => !prev)
    setFormData({ email: '', password: '', name: '' })
    setShowPassword(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      let response

      if (isLogin) {
        response = await authService.login(formData.email, formData.password)
      } else {
        response = await authService.register(
          formData.email,
          formData.password,
          formData.name
        )
      }

      login(response.user, response.token, response.refreshToken)

      // Navigation will be handled by the useEffect above
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message
      setErrorMessage(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ErrorNotification />

      {/* Top Navigation - matches Dashboard */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <img src="/icon.png" alt="TechManual AI" className="w-8 h-8 sm:w-10 sm:h-10" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">TechManual AI</h1>
            </div>
          </div>
        </div>
      </nav>

      {/* Auth Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-gray-600 text-sm">
                {isLogin
                  ? 'Sign in to access your technical manuals'
                  : 'Start managing your technical knowledge today'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Name
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      required={!isLogin}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="text-center mt-6 text-sm text-gray-600">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={switchMode}
                className="ml-2 text-blue-600 hover:text-blue-700 font-medium focus:outline-none"
              >
                {isLogin ? 'Register' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
