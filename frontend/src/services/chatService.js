import api from './api'

export const getChatHistory = async (docId) => {
  const response = await api.get(`/chat/${docId}`)
  return response.data
}

export const streamChatResponse = (docId, question, onEvent) => {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('token')
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

    // Use POST with fetch instead of EventSource for better control
    fetch(`${baseUrl}/chat/${docId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ question }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullResponse = ''
        let buffer = ''

        const read = async () => {
          try {
            const { done, value } = await reader.read()
            if (done) {
              resolve({ fullResponse, metadata: {} })
              return
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')

            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))

                  if (data.type === 'progress') {
                    onEvent({ type: 'progress', data })
                  } else if (data.token) {
                    fullResponse += data.token
                    onEvent({ type: 'token', token: data.token })
                  } else if (data.error) {
                    throw new Error(data.error)
                  }
                } catch (err) {
                  console.error('Error parsing SSE data:', err)
                }
              }
            }

            read()
          } catch (err) {
            reject(err)
          }
        }

        read()
      })
      .catch((err) => {
        reject(err)
      })
  })
}

export const clearChatHistory = async (docId) => {
  const response = await api.delete(`/chat/${docId}`)
  return response.data
}
