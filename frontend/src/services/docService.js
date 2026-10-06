import api from './api'

export const listDocuments = async () => {
  const response = await api.get('/docs')
  return response.data.documents // Extract the documents array from the response
}

export const getDocument = async (docId) => {
  const response = await api.get(`/docs/${docId}`)
  return response.data
}

export const uploadDocument = async (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      )
      onProgress?.({ type: 'upload', percentage: percentCompleted })
    },
  })

  return response.data
}

export const getUploadStatus = async (uploadId) => {
  const response = await api.get(`/upload/status/${uploadId}`)
  return response.data.document
}

export const getDocumentFile = async (docId) => {
  try {
    const response = await api.get(`/docs/${docId}/file`, {
      responseType: 'blob',
      headers: {
        'X-Requested-With': 'XMLHttpRequest', // Helps bypass some download managers
        'Accept': 'application/pdf',
      },
      // Add cache busting to prevent IDM from caching detection
      params: {
        t: new Date().getTime()
      }
    })
    return response.data
  } catch (error) {
    console.error('Error fetching document file:', error)
    throw error
  }
}

export const deleteDocument = async (docId) => {
  const response = await api.delete(`/docs/${docId}`)
  return response.data
}
