import { useEffect, useContext, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { AppContext } from '../context/AppContext'
import { usePDF } from '../hooks/usePDF'
import { useChat } from '../hooks/useChat'
import { useDocuments } from '../hooks/useDocuments'
import { useAuth } from '../hooks/useAuth'
import ErrorNotification from '../components/ErrorNotification'
import { FiArrowLeft, FiChevronLeft, FiChevronRight, FiSend, FiFile, FiUser, FiLogOut, FiFolder, FiMinus, FiPlus } from 'react-icons/fi'
import { BsRobot } from 'react-icons/bs'
import { cleanAIResponse } from '../utils/helpers'

// Configure PDF.js worker - use the correct path for pdfjs-dist v6.4.299
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function DocumentWorkspace() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { currentDocument, setCurrentDocument, selectDocument, currentPage, setCurrentPage } = useContext(AppContext)
  const { documents, fetchDocuments } = useDocuments()
  const { loadPDF, pdfBlob, numPages, handleNumPages, nextPage, prevPage } = usePDF()
  const { chatHistory, loadChatHistory, sendMessage, streaming } = useChat()
  const [question, setQuestion] = useState('')
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const chatEndRef = useRef(null)

  // Load document from URL parameter if needed
  useEffect(() => {
    const initializeDocument = async () => {
      if (documentId && (!currentDocument || currentDocument.id !== documentId)) {
        // Try to find document in existing documents first
        const existingDoc = documents.find(doc => doc.id === documentId)
        if (existingDoc) {
          selectDocument(existingDoc)
        } else {
          // If not found, fetch documents and then select
          await fetchDocuments()
        }
      }
      setLoading(false)
    }

    initializeDocument()
  }, [documentId, currentDocument?.id, documents.length, selectDocument, fetchDocuments])

  // Load document when it becomes available
  useEffect(() => {
    if (currentDocument && documentId === currentDocument.id) {
      loadPDF(currentDocument.id)
      loadChatHistory(currentDocument.id)
    }
  }, [currentDocument?.id, documentId])  // Remove loadPDF and loadChatHistory from deps


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleBackToDashboard = () => {
    selectDocument(null)
    setCurrentPage(1)
    navigate('/dashboard', { replace: true })
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!question.trim() || streaming) return

    const questionText = question
    setQuestion('')

    try {
      await sendMessage(currentDocument.id, questionText)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handlePageReference = (pageNum) => {
    if (pageNum && pageNum >= 1 && pageNum <= numPages) {
      setCurrentPage(pageNum)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      ready: 'bg-green-50 text-green-700 border-green-200',
      processing: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      failed: 'bg-red-50 text-red-700 border-red-200'
    }
    return badges[status] || badges.processing
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading document...</p>
        </div>
      </div>
    )
  }

  if (!currentDocument || currentDocument.id !== documentId) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">Document not found</p>
          <button
            onClick={handleBackToDashboard}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!pdfBlob) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <ErrorNotification />
      
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side */}
            <div className="flex items-center space-x-3">
              <img src="/icon.png" alt="TechManual AI" className="w-10 h-10" />
              <h1 className="text-xl font-semibold text-gray-900">TechManual AI</h1>
            </div>

            {/* Center */}
            <div className="flex-1"></div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-gray-600">
                <FiUser size={16} />
                <span className="text-sm">{user?.name || 'no name'}</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 text-sm"
              >
                <FiLogOut size={16} />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Document Header */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-9 sm:px-8 lg:px-10 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 text-sm"
              >
                <FiArrowLeft size={16} />
                <span>Back to dashboard</span>
              </button>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                <FiFile className="text-red-500" size={16} />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">{currentDocument.title}</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>{currentDocument.pageCount || numPages} pages</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(currentDocument.status)}`}>
                    • {currentDocument.status === 'ready' ? 'Ready' : currentDocument.status === 'processing' ? 'Processing' : 'Failed'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-10xl mx-auto px-4 sm:px-6 lg:px-1 h-full">
          <div className="flex gap-6 h-full p-4">
            {/* Left Sidebar - Chat Interface */}
            <div className="w-98 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 h-full">
              {/* Overview Section */}
              <div className="p-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center space-x-2 mb-3">
                  <FiFile size={16} className="text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-900">Overview</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {currentDocument.summary || 'Service manual for the X200 industrial pump. Covers installation, maintenance, error codes, and calibration.'}
                </p>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {chatHistory.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Ask questions about this manual to get started.</p>
                  </div>
                )}

                {chatHistory.map((msg, idx) => (
                  <div key={msg.id || idx}>
                    {msg.role === 'user' ? (
                      <div className="flex justify-end mb-4">
                        <div className="bg-blue-600 text-white px-4 py-2 rounded-2xl rounded-br-md max-w-xs">
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <BsRobot className="w-6 h-6 text-blue-600" />
                          <span className="text-sm font-medium text-gray-900">AI Assistant</span>
                        </div>
                          <div className="prose prose-sm text-gray-700">
                            {msg.content.split('\n').filter(line => line.trim().length > 0).map((line, i) => {
                              // Check if line contains numbered list items (with optional bold text)
                              const numberedMatch = line.match(/^(\d+)\.\s+(.+)/)
                              if (numberedMatch) {
                                const content = numberedMatch[2]
                                // Check if content has bold markdown (**text**)
                                const boldMatch = content.match(/\*\*(.+?)\*\*:\s*(.+)/)

                                return (
                                  <div key={i} className="mb-3">
                                    <div className="flex items-start">
                                      <span className="font-medium text-gray-900 mr-2 flex-shrink-0">{numberedMatch[1]}.</span>
                                      <div>
                                        {boldMatch ? (
                                          <>
                                            <span className="font-semibold text-gray-900">{cleanAIResponse(boldMatch[1])}:</span>
                                            <span className="text-gray-700"> {cleanAIResponse(boldMatch[2])}</span>
                                          </>
                                        ) : (
                                          <span className="text-gray-700">{cleanAIResponse(content)}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              }

                              // Strip markdown asterisks and inline page references for clean display
                              const cleanedLine = cleanAIResponse(line)
                              if (!cleanedLine.trim()) return null

                              // Handle warning callouts (lines that might be warnings)
                              if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('caution')) {
                                return (
                                  <div key={i} className="bg-yellow-50 border-l-4 border-yellow-400 p-3 my-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs">!</span>
                                      </div>
                                      <span className="text-sm text-yellow-800">{cleanedLine}</span>
                                    </div>
                                  </div>
                                )
                              }

                              // Handle citation lines (e.g., "Citations: [page 4, page 5...]")
                              if (line.toLowerCase().startsWith('citations:')) {
                                // Skip if only the label remains after stripping page refs — the citation buttons below already show pages
                                if (!cleanedLine.replace(/^citations:\s*/i, '').trim()) return null
                                return (
                                  <div key={i} className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                                    {cleanedLine}
                                  </div>
                                )
                              }

                              return <p key={i} className="mb-2 text-gray-700">{cleanedLine}</p>
                            })}
                          </div>
                          
                          {/* Page References */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex flex-wrap gap-2">
                                {msg.citations.map((citation, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handlePageReference(citation.page)}
                                    className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded hover:bg-blue-100 transition"
                                  >
                                    Page {citation.page}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                    )}
                  </div>
                ))}

                {streaming && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <BsRobot className="w-6 h-6 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">AI Assistant</span>
                    </div>
                    <p className="text-sm text-gray-600 animate-pulse">Analyzing document...</p>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t border-gray-200 p-4 flex-shrink-0">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about this manual"
                    disabled={streaming}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={streaming || !question.trim()}
                    className="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    <FiSend size={16} />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Panel - PDF Viewer */}
            <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200">
              {/* PDF Controls */}
              <div className="border-b border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className="p-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 rounded transition text-gray-700 border border-gray-300"
                  >
                    <FiChevronLeft size={20} />
                  </button>

                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max={numPages}
                      value={currentPage}
                      onChange={(e) => {
                        const page = parseInt(e.target.value) || 1
                        setCurrentPage(page)
                      }}
                      className="w-12 px-2 py-1 border border-gray-500 rounded text-center text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-sm"
                    />
                    <span className="text-sm text-gray-500">/ {numPages}</span>
                  </div>

                  <button
                    onClick={nextPage}
                    disabled={currentPage === numPages}
                    className="p-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 rounded transition text-gray-700 border border-gray-300"
                  >
                    <FiChevronRight size={20} />
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                    className="p-2 bg-gray-200 hover:bg-gray-300 rounded transition text-gray-700 border border-gray-300"
                  >
                    <FiMinus size={16} />
                  </button>
                  <span className="text-sm text-gray-600 w-12 text-center">{Math.round(scale * 100)}%</span>
                  <button
                    onClick={() => setScale(Math.min(3, scale + 0.25))}
                    className="p-2 bg-gray-200 hover:bg-gray-300 rounded transition text-gray-700 border border-gray-300"
                  >
                    <FiPlus size={16} />
                  </button>
                </div>
              </div>

              {/* PDF Document */}
              <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
                {pdfBlob && (
                  <div className="bg-white shadow-lg">
                    <Document
                      file={pdfBlob}
                      onLoadSuccess={({ numPages }) => handleNumPages(numPages)}
                      loading={<p className="text-gray-600 p-8">Loading PDF...</p>}
                      error={<p className="text-red-600 p-8">Failed to load PDF</p>}
                    >
                      <Page pageNumber={currentPage} scale={scale} />
                    </Document>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}