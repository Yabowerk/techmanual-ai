import { useContext } from 'react'
import { AppContext } from '../context/AppContext'

export const useAuth = () => {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useAuth must be used within AppProvider')
  }

  return {
    user: context.user,
    token: context.token,
    isAuthenticated: context.isAuthenticated,
    login: context.login,
    logout: context.logout,
  }
}
