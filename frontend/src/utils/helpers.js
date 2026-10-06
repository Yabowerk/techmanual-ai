/**
 * Format file size in human readable format
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Format date to readable string
 */
export const formatDate = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

/**
 * Get status badge color and text
 */
export const getStatusDisplay = (status) => {
  const statusMap = {
    ready: { color: 'bg-green-900 text-green-200', text: '✅ Ready' },
    processing: { color: 'bg-orange-900 text-orange-200', text: '⏳ Processing' },
    failed: { color: 'bg-red-900 text-red-200', text: '❌ Failed' },
    uploading: { color: 'bg-blue-900 text-blue-200', text: '📤 Uploading' },
  }
  return statusMap[status] || { color: 'bg-slate-700 text-slate-200', text: status }
}

/**
 * Validate file before upload
 */
export const validateFile = (file, maxSizeMB = 20) => {
  if (!file) return { valid: false, error: 'No file selected' }
  
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Only PDF files are allowed' }
  }
  
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` }
  }
  
  return { valid: true, error: null }
}

/**
 * Clean AI response text for display:
 * - Remove inline page references like "[page 1]" or "[page 4, page 5]"
 * - Remove markdown asterisks (bold ** and italic * markers) so text reads as plain text
 */
export const cleanAIResponse = (text) => {
  if (!text) return text
  return text
    .replace(/\s*\[page[^\]]*\]/gi, '') // strip inline page citations
    .replace(/\*/g, '')                 // strip markdown asterisks
}
