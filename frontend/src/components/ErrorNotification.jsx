import { useContext } from 'react'
import { AppContext } from '../context/AppContext'

const ErrorNotification = () => {
  const { error } = useContext(AppContext)

  if (!error) return null

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md bg-red-900 text-red-200 px-4 py-3 rounded-lg text-sm z-50">
      <div className="flex items-center">
        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <span className="break-words">{error}</span>
      </div>
    </div>
  )
}

export default ErrorNotification