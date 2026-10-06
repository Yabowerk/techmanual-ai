import React, { createContext, useState, useCallback, useEffect } from 'react'
import * as authService from '../services/authService'

export const AppContext = createContext()

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentDocument, setCurrentDocument] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token')
        const storedUser = localStorage.getItem('user')
        const storedRefreshToken = localStorage.getItem('refreshToken')

        if (storedToken && storedUser) {
          try {
            // Validate token with server
            const validation = await authService.validateToken()
            
            if (validation.valid) {
              const userData = JSON.parse(storedUser)
              setToken(storedToken)
              setUser(userData)
              setIsAuthenticated(true)
            } else {
              // Token invalid, try refresh if available
              if (storedRefreshToken) {
                try {
                  const refreshResponse = await authService.refreshToken(storedRefreshToken)
                  const userData = JSON.parse(storedUser)
                  
                  localStorage.setItem('token', refreshResponse.token)
                  if (refreshResponse.refreshToken) {
                    localStorage.setItem('refreshToken', refreshResponse.refreshToken)
                  }
                  
                  setToken(refreshResponse.token)
                  setUser(userData)
                  setIsAuthenticated(true)
                } catch (refreshError) {
                  console.warn('Token refresh failed:', refreshError.message)
                  clearAuthData()
                }
              } else {
                clearAuthData()
              }
            }
          } catch (validationError) {
            console.warn('Token validation failed:', validationError.message)
            clearAuthData()
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error)
        clearAuthData()
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  // Listen for logout events from API interceptor
  useEffect(() => {
    const handleAuthLogout = () => {
      clearAuthData()
    }

    window.addEventListener('auth:logout', handleAuthLogout)
    return () => window.removeEventListener('auth:logout', handleAuthLogout)
  }, [])

  const clearAuthData = useCallback(() => {
    setUser(null)
    setToken(null)
    setIsAuthenticated(false)
    setCurrentDocument(null)
    setCurrentPage(1)
    setChatHistory([])
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }, [])

  const login = useCallback((userData, authToken, refreshToken) => {
    setUser(userData)
    setToken(authToken)
    setIsAuthenticated(true)
    localStorage.setItem('token', authToken)
    localStorage.setItem('user', JSON.stringify(userData))
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.warn('Logout request failed:', error.message)
    } finally {
      clearAuthData()
    }
  }, [clearAuthData])

  const selectDocument = useCallback((doc) => {
    setCurrentDocument(doc)
    setCurrentPage(1)
    setChatHistory([])
  }, [])

  const setPageNumber = useCallback((page) => {
    setCurrentPage(page)
  }, [])

  const setLoadingState = useCallback((loadingState) => {
    setLoading(loadingState)
  }, [])

  const setChatHistoryState = useCallback((historyOrCallback) => {
    setChatHistory(historyOrCallback)
  }, [])

  const setErrorMessage = useCallback((msg) => {
    setError(msg)
    if (msg) {
      setTimeout(() => setError(null), 5000)
    }
  }, [])

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    currentDocument,
    selectDocument,
    currentPage,
    setCurrentPage: setPageNumber,
    chatHistory,
    setChatHistory: setChatHistoryState,
    loading,
    setLoading: setLoadingState,
    error,
    setErrorMessage,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
