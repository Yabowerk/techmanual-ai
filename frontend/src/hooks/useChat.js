import { useContext, useCallback, useState } from 'react'
import { AppContext } from '../context/AppContext'
import * as chatService from '../services/chatService'

export const useChat = () => {
  const context = useContext(AppContext)
  const [streaming, setStreaming] = useState(false)

  if (!context) {
    throw new Error('useChat must be used within AppProvider')
  }

  const loadChatHistory = useCallback(async (docId) => {
    try {
      context.setLoading(true)
      const data = await chatService.getChatHistory(docId)
      context.setChatHistory(data.messages || [])
      return data
    } catch (error) {
      console.error('Chat history error:', error)
      context.setErrorMessage(`Failed to load chat: ${error.message}`)
      throw error
    } finally {
      context.setLoading(false)
    }
  }, [context])  // Only depend on context object itself, not its methods

  const sendMessage = useCallback(
    async (docId, question) => {
      try {
        setStreaming(true)
        context.setLoading(true)

        // Add user message immediately for responsive UI
        const userMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: question,
          createdAt: new Date().toISOString(),
        }
        context.setChatHistory((prev) => [...prev, userMessage])

        // Stream the response (no optimistic AI placeholder — streaming indicator handles the UI)
        await chatService.streamChatResponse(docId, question, (event) => {
          if (event.type === 'progress') {
            console.log('Progress:', event.data)
          }
          // No token handler needed — we reload from server after completion
        })

        // Reload from server to get the canonical saved copy with proper citations
        await loadChatHistory(docId)

      } catch (error) {
        console.error('Send message error:', error)
        context.setErrorMessage(`Failed to send message: ${error.message}`)
        throw error
      } finally {
        setStreaming(false)
        context.setLoading(false)
      }
    },
    [context, loadChatHistory]
  )

  return {
    chatHistory: context.chatHistory,
    setChatHistory: context.setChatHistory,
    loadChatHistory,
    sendMessage,
    streaming,
  }
}
