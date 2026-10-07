import { useEffect, useContext, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { useDocuments } from '../hooks/useDocuments'
import { useAuth } from '../hooks/useAuth'
import ErrorNotification from '../components/ErrorNotification'
import { FiFile, FiUploadCloud, FiSearch, FiUser, FiLogOut, FiFolder, FiTrash2, FiList } from 'react-icons/fi'
import { validateFile } from '../utils/helpers'

export default function Dashboard() {
  const { selectDocument } = useContext(AppContext)
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const {
    documents,
    fetchDocuments,
    uploadProgress,
    uploadDocument,
    deleteDocument,
  } = useDocuments()
  const fileInputRef = useRef(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [mobileView, setMobileView] = useState('documents') // 'documents' or 'upload'

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleFileSelect = (file) => {
    const validation = validateFile(file)
    if (!validation.valid) {
      alert(validation.error)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setSelectedFile(file)
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    // Switch to documents view on mobile after upload starts
    if (window.innerWidth < 768) {
      setMobileView('documents')
    }

    try {
      const result = await uploadDocument(selectedFile)
      // Find the uploaded document and navigate to it
      const uploadedDoc = result.find(doc => doc.title === selectedFile.name.replace('.pdf', ''))
      if (uploadedDoc) {
        selectDocument(uploadedDoc)
        navigate(`/document/${uploadedDoc.id}`)
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSelectDocument = (doc) => {
    if (doc.status === 'ready') {
      selectDocument(doc)
      navigate(`/document/${doc.id}`)
    }
  }

  const handleDeleteDocument = async (e, docId) => {
    e.stopPropagation() // Prevent document selection when clicking delete
    
    if (window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      try {
        await deleteDocument(docId)
      } catch (error) {
        console.error('Delete failed:', error)
      }
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
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

  const filteredDocuments = documents.filter(doc =>
    doc.title?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const usedSlots = documents.length
  const totalSlots = 5

  return (
    <div className="min-h-screen bg-gray-50">
      <ErrorNotification />
      
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and Title */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <img src="/icon.png" alt="TechManual AI" className="w-8 h-8 sm:w-10 sm:h-10" />
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">TechManual AI</h1>
            </div>

            {/* Center - Spacer */}
            <div className="flex-1"></div>

            {/* Right side */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-gray-600">
                <FiUser size={16} />
                <span className="text-sm">{user?.name || 'no name'}</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 text-sm touch-target"
              >
                <FiLogOut size={16} />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Page Header */}
        <div className="flex justify-center items-start mb-5 text-center">
          <div>
            <p className="text-gray-600 text-sm md:text-base">
              Upload technical documents and keep your reference library in one place.
            </p>
          </div>
        </div>

        {/* Mobile Toggle Bar */}
        <div className="md:hidden bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden">
          <div className="flex">
            <button
              onClick={() => setMobileView('documents')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
                mobileView === 'documents'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FiList size={18} />
              <span>Documents ({documents.length})</span>
            </button>
            <button
              onClick={() => setMobileView('upload')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
                mobileView === 'upload'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FiUploadCloud size={18} />
              <span>Upload</span>
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8">
          {/* Left Column - Documents List */}
          <div className={`md:col-span-3 ${mobileView === 'upload' ? 'hidden md:block' : 'block'}`}>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900">Your manuals</h3>
                  <span className="text-xs sm:text-sm text-gray-500">{documents.length} uploaded</span>
                </div>
                
                {/* Search Bar */}
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search documents"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              {/* Documents List - Scrollable Container */}
              <div className="h-64 sm:h-80 md:h-96 overflow-y-auto divide-y divide-gray-200">
                {filteredDocuments.length === 0 && !searchTerm ? (
                  <div className="p-8 text-center text-gray-500">
                    <FiFile size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg mb-2">No manuals yet</p>
                    <p className="text-sm">Upload your first document to get started</p>
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p>No manuals match your search</p>
                  </div>
                ) : (
                  filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDocument(doc)}
                      className={`p-4 md:p-5 flex items-center space-x-4 hover:bg-gray-50 transition-colors group ${
                        doc.status === 'ready' ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 sm:w-8 sm:h-8 bg-red-100 rounded flex items-center justify-center">
                          <FiFile className="text-red-500" size={16} />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">{doc.title}</h4>
                        <p className="text-xs sm:text-sm text-gray-500">{doc.pageCount || '?'} pages</p>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(doc.status)}`}>
                          {doc.status === 'ready' ? 'Ready' : doc.status === 'processing' ? 'Processing' : 'Failed'}
                        </span>
                        
                        <button
                          onClick={(e) => handleDeleteDocument(e, doc.id)}
                          className="opacity-0 group-hover:opacity-100 p-3 sm:p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 touch-target"
                          title="Delete document"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Upload Section */}
          <div className={`md:col-span-2 ${mobileView === 'documents' ? 'hidden md:block' : 'block'}`}>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              {uploadProgress ? (
                /* Upload Progress View - Replaces entire upload section */
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                  
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {uploadProgress.stage === 'uploading' ? 'Uploading your manual' : 'Processing your manual'}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-6">
                    {uploadProgress.stage === 'uploading' 
                      ? 'Uploading your document to the server...' 
                      : 'Analyzing and preparing your document for AI assistance...'
                    }
                  </p>

                  <div className="max-w-xs mx-auto mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span className="capitalize">{uploadProgress.stage}</span>
                      <span>{uploadProgress.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress.percentage}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    This may take a few minutes depending on document size
                  </p>
                </div>
              ) : (
                /* Normal Upload View */
                <>
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Add a new manual</h3>
                  <p className="text-gray-600 text-xs sm:text-sm mb-6">Bring your technical knowledge into your workspace.</p>

                  {/* Drag & Drop Area */}
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                    }`}
                  >
                    <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-lg flex items-center justify-center">
                      <FiFile className="text-red-500" size={24} />
                    </div>
                    {selectedFile ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-center space-x-2 text-green-600 mb-2">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">File Selected</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <button
                          onClick={() => {
                            setSelectedFile(null)
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ''
                            }
                          }}
                          className="mt-2 text-xs text-red-600 hover:text-red-800"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <>
                        <h4 className="text-base font-medium text-gray-900 mb-2">Drop your document here</h4>
                        <p className="text-sm text-gray-500 mb-4">PDF only, up to 20 MB</p>
                      </>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 touch-target"
                    >
                      <FiFolder className="mr-2" size={16} />
                      {selectedFile ? 'Choose different file' : 'Browse files'}
                    </button>
                  </div>

                  {/* Upload Button */}
                  <button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || usedSlots >= totalSlots}
                    className="w-full mt-4 flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed touch-target"
                  >
                    <FiUploadCloud className="mr-2" size={16} />
                    {selectedFile ? 'Upload manual' : 'Select a file first'}
                  </button>

                  {/* Progress Info */}
                  <div className="mt-6 space-y-4">
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Free upload allowance</span>
                        <span>{usedSlots} of {totalSlots} used</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${(usedSlots / totalSlots) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        You have {totalSlots - usedSlots} free uploads remaining
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button for Mobile - Quick Toggle */}
      <button
        onClick={() => setMobileView(mobileView === 'documents' ? 'upload' : 'documents')}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-20 transition-all active:scale-95"
        aria-label={mobileView === 'documents' ? 'Upload Document' : 'View Documents'}
      >
        {mobileView === 'documents' ? (
          <FiUploadCloud size={24} />
        ) : (
          <FiList size={24} />
        )}
      </button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelect(file)
        }}
        className="hidden"
      />
    </div>
  )
}
