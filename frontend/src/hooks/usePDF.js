import { useState, useCallback, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import * as docService from '../services/docService'

export const usePDF = () => {
  const context = useContext(AppContext)
  const [pdfBlob, setPdfBlob] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [pdfError, setPdfError] = useState(null)

  if (!context) {
    throw new Error('usePDF must be used within AppProvider')
  }

  const loadPDF = useCallback(async (docId) => {
    try {
      setPdfError(null)
      context.setLoading(true)
      const blob = await docService.getDocumentFile(docId)
      setPdfBlob(blob)
      return blob
    } catch (error) {
      console.error('PDF load error:', error)
      setPdfError(`Failed to load PDF: ${error.message}`)
      context.setErrorMessage(`Failed to load PDF: ${error.message}`)
      throw error
    } finally {
      context.setLoading(false)
    }
  }, [context.setLoading, context.setErrorMessage])

  const handleNumPages = useCallback((numPages) => {
    setNumPages(numPages)
  }, [])

  const goToPage = useCallback(
    (pageNum) => {
      if (pageNum < 1 || pageNum > numPages) {
        context.setErrorMessage(`Invalid page number. Use 1 to ${numPages}`)
        return
      }
      const validPage = Math.max(1, Math.min(pageNum, numPages))
      context.setCurrentPage(validPage)
    },
    [numPages, context.setErrorMessage, context.setCurrentPage]
  )

  const nextPage = useCallback(() => {
    if (context.currentPage < numPages) {
      goToPage(context.currentPage + 1)
    }
  }, [context.currentPage, numPages, goToPage])

  const prevPage = useCallback(() => {
    if (context.currentPage > 1) {
      goToPage(context.currentPage - 1)
    }
  }, [context.currentPage, goToPage])

  return {
    pdfBlob,
    setPdfBlob,
    numPages,
    setNumPages,
    handleNumPages,
    loadPDF,
    goToPage,
    nextPage,
    prevPage,
    pdfError,
    setPdfError,
  }
}
