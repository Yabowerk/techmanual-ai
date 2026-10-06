import { useState, useCallback, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import * as docService from '../services/docService'

export const useDocuments = () => {
  const context = useContext(AppContext)
  const [documents, setDocuments] = useState([])
  const [uploadProgress, setUploadProgress] = useState(null)

  if (!context) {
    throw new Error('useDocuments must be used within AppProvider')
  }

  const fetchDocuments = useCallback(async () => {
    try {
      context.setLoading(true)
      const docs = await docService.listDocuments()
      setDocuments(docs)
      return docs
    } catch (error) {
      context.setErrorMessage(`Failed to load documents: ${error.message}`)
      throw error
    } finally {
      context.setLoading(false)
    }
  }, [context])  // Only depend on context object

  const uploadDocument = useCallback(
    async (file) => {
      try {
        context.setLoading(true)
        setUploadProgress({ stage: 'uploading', percentage: 0 })

        const uploadData = await docService.uploadDocument(
          file,
          (progress) => {
            if (progress && typeof progress.percentage === 'number') {
              setUploadProgress({
                stage: 'uploading',
                percentage: Math.min(100, Math.max(0, progress.percentage)),
              })
            }
          }
        )

        const uploadId = uploadData.documentId
        setUploadProgress({ stage: 'processing', percentage: 0 })

        return new Promise((resolve, reject) => {
          const pollInterval = setInterval(async () => {
            try {
              const status = await docService.getUploadStatus(uploadId)

              if (status.status === 'processing') {
                const percentage = typeof status.percentage === 'number' 
                  ? Math.min(100, Math.max(0, status.percentage))
                  : 0
                setUploadProgress({
                  stage: 'processing',
                  percentage,
                })
              } else if (status.status === 'ready') {
                clearInterval(pollInterval)
                setUploadProgress(null)
                const updatedDocs = await fetchDocuments()
                resolve(updatedDocs)
              } else if (status.status === 'failed') {
                clearInterval(pollInterval)
                setUploadProgress(null)
                reject(new Error(status.message || 'Upload failed'))
              }
            } catch (error) {
              clearInterval(pollInterval)
              setUploadProgress(null)
              reject(error)
            }
          }, 1000)

          const timeoutId = setTimeout(() => {
            clearInterval(pollInterval)
            setUploadProgress(null)
            reject(new Error('Upload timeout'))
          }, 5 * 60 * 1000)

          // Clear timeout if polling completes successfully
          const originalResolve = resolve
          const originalReject = reject
          
          resolve = (value) => {
            clearTimeout(timeoutId)
            originalResolve(value)
          }
          
          reject = (error) => {
            clearTimeout(timeoutId)
            originalReject(error)
          }
        })
      } catch (error) {
        context.setErrorMessage(`Upload failed: ${error.message}`)
        setUploadProgress(null)
        throw error
      } finally {
        context.setLoading(false)
      }
    },
    [context, fetchDocuments]
  )

  const deleteDocument = useCallback(
    async (docId) => {
      try {
        context.setLoading(true)
        await docService.deleteDocument(docId)
        setDocuments((prev) => prev.filter((doc) => doc.id !== docId))
      } catch (error) {
        context.setErrorMessage(`Failed to delete document: ${error.message}`)
        throw error
      } finally {
        context.setLoading(false)
      }
    },
    [context]
  )

  return {
    documents,
    setDocuments,
    fetchDocuments,
    uploadDocument,
    uploadProgress,
    deleteDocument,
  }
}
