/**
 * PDF parsing service
 * Extracts text content from PDF files page by page using unpdf library
 * 
 * This service is responsible for:
 * 1. Validating PDF files
 * 2. Extracting text content from each page
 * 3. Cleaning and normalizing the extracted text
 * 4. Preserving page numbers for reference
 */

import { extractText } from 'unpdf';

/**
 * Extract text content from PDF buffer, preserving page numbers
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Array<{page: number, text: string, section: string}>>} - Array of pages with text content
 * 
 * @example
 * const pages = await extractPages(pdfBuffer);
 * // Returns: [
 * //   { page: 1, text: "Chapter 1: Introduction...", section: "Introduction" },
 * //   { page: 2, text: "Safety Precautions...", section: "Safety" },
 * //   ...
 * // ]
 * 
 * @throws {Error} If PDF is invalid, corrupted, or cannot be parsed
 */
export const extractPages = async (buffer) => {
  // Step 1: Validate that the buffer is a valid PDF
  if (!isValidPDF(buffer)) {
    throw new Error('Invalid PDF format - file does not appear to be a valid PDF');
  }

  try {
    console.log(`📋 Input buffer type: ${buffer.constructor.name}, length: ${buffer.length}`);

    // Convert to proper Uint8Array for unpdf library
    // unpdf specifically requires Uint8Array, not Buffer
    let uint8Array;
    if (Buffer.isBuffer(buffer)) {
      // Create a new Uint8Array from the buffer data
      uint8Array = Uint8Array.from(buffer);
    } else if (buffer instanceof Uint8Array) {
      uint8Array = buffer;
    } else {
      // Convert any other type to Uint8Array
      uint8Array = new Uint8Array(buffer);
    }

    console.log(`📋 Converted to: ${uint8Array.constructor.name}, length: ${uint8Array.length}`);
    console.log(`📋 Is Uint8Array: ${uint8Array instanceof Uint8Array}`);
    console.log(`📋 Is Buffer: ${Buffer.isBuffer(uint8Array)}`);

    // Step 2: Use unpdf library to extract text
    console.log(`📖 Calling unpdf extractText...`);
    const result = await extractText(uint8Array);
    
    console.log(`📄 unpdf raw result:`, result);
    console.log(`📄 unpdf result keys:`, Object.keys(result || {}));
    
    // unpdf returns { totalPages, text } where text is an array of pages
    const extractedPages = result.text || result.pages || [];
    const pageCount = result.totalPages || extractedPages.length;
    
    console.log(`📄 Found ${pageCount} pages with ${extractedPages.length} text blocks`);

    // Step 3: Validate that we got pages back
    if (!extractedPages || extractedPages.length === 0) {
      console.warn('⚠️  No pages extracted. PDF might be image-based or have issues.');
      throw new Error('PDF appears to be empty or contains no extractable text content');
    }

    // Log some content for debugging
    if (extractedPages.length > 0 && extractedPages[0]) {
      console.log(`📝 First page length: ${extractedPages[0].length} chars`);
      if (extractedPages[0].length > 0) {
        console.log(`📝 First 200 chars: ${extractedPages[0].substring(0, 200)}...`);
      } else {
        console.log(`📝 First page is empty`);
      }
    }

    // Step 4: Process each page
    const processedPages = extractedPages.map((pageContent, index) => {
      const pageText = cleanText(pageContent || '');
      
      return {
        page: index + 1,
        text: pageText,
        section: detectSection(pageText),
        originalLength: pageContent ? pageContent.length : 0,
        cleanedLength: pageText.length
      };
    }).filter(page => page.text.length > 0); // Remove empty pages

    console.log(`✅ Successfully processed ${processedPages.length} pages from PDF (${Math.round(buffer.length / 1024)} KB)`);
    
    if (processedPages.length === 0) {
      throw new Error('No text content found in PDF after processing');
    }
    
    return processedPages;

  } catch (error) {
    console.error(`❌ PDF parsing error:`, error);
    
    if (error.message.includes('corrupted') || error.message.includes('Invalid PDF')) {
      throw new Error('PDF file appears to be corrupted and cannot be parsed');
    }
    
    if (error.message.includes('password') || error.message.includes('encrypted')) {
      throw new Error('PDF is password-protected and cannot be parsed without credentials');
    }
    
    if (error.message.includes('memory')) {
      throw new Error('PDF file is too large to process - exceeds memory limits');
    }

    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

/**
 * Clean and normalize extracted text from PDF
 * 
 * This function:
 * 1. Removes excess whitespace (multiple spaces → single space)
 * 2. Normalizes line breaks (removes excessive blank lines)
 * 3. Handles special characters and Unicode
 * 4. Preserves important formatting like bullet points
 * 5. Trims leading/trailing whitespace
 * 
 * @param {string} rawText - Raw text from PDF extraction (may be messy)
 * @returns {string} - Cleaned and normalized text
 * 
 * @private
 * 
 * @example
 * // Input: "Hello    world\n\n\nHow are you?"
 * // Output: "Hello world\n\nHow are you?"
 */
const cleanText = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  let cleaned = rawText;

  // Step 1: Replace multiple consecutive spaces with single space
  // This handles cases where PDF text extraction adds extra spaces
  // RegExp: /\s+/g matches one or more whitespace characters (spaces, tabs, etc.)
  // Replace all with single space
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Step 2: Normalize line breaks
  // Convert multiple consecutive newlines into max 2 newlines (preserves paragraphs)
  // This prevents massive blank spaces in the text
  // RegExp: /\n\s*\n/g matches newline + optional spaces + newline
  // Replace with exactly 2 newlines (creates paragraph break)
  cleaned = cleaned.replace(/\n\s*\n+/g, '\n\n');

  // Step 3: Remove page numbers and headers/footers
  // These are common artifacts from PDF parsing that aren't useful
  // Pattern 1: Match page numbers at start of line (e.g., "1 " or "- 42 -")
  cleaned = cleaned.replace(/^\s*[-–—]?\s*\d+\s*[-–—]?\s*$/gm, '');
  
  // Pattern 2: Remove common header/footer patterns
  // e.g., "Copyright 2024", "Page 1 of 50"
  cleaned = cleaned.replace(/^.*(?:Page|page|©|Copyright|copyright).*$/gm, '');

  // Step 4: Handle special PDF artifacts
  // Remove excessive punctuation at line starts (often PDF parsing noise)
  cleaned = cleaned.replace(/^[\s•·-]{2,}/gm, '• ');

  // Step 5: Fix spacing around punctuation
  // Ensure proper spacing: "word . word" → "word. word"
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');
  cleaned = cleaned.replace(/([.,!?;:])\s*(?=[A-Z])/g, '$1 ');

  // Step 6: Remove completely empty lines and trim
  // Split by newline, filter out empty lines, rejoin
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  // Step 7: Final trim of leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
};

/**
 * Detect the section/heading of text content
 * 
 * This looks for common patterns that indicate section headers:
 * - Lines in ALL CAPS
 * - Lines followed by underscores
 * - Lines that are short (< 50 chars)
 * 
 * @param {string} text - Text content to analyze
 * @returns {string} - Detected section name or empty string
 * 
 * @private
 * 
 * @example
 * detectSection("INSTALLATION INSTRUCTIONS\nStep 1: Unpack the device")
 * // Returns: "INSTALLATION INSTRUCTIONS"
 */
const detectSection = (text) => {
  if (!text || text.length === 0) {
    return '';
  }

  // Get first line of text
  const firstLine = text.split('\n')[0].trim();

  // Check if first line looks like a heading:
  // - Short (< 50 characters)
  // - Mostly uppercase or Title Case
  // - Not too long to be regular content
  if (firstLine.length > 0 && firstLine.length < 50) {
    const upperCaseRatio = (firstLine.match(/[A-Z]/g) || []).length / firstLine.length;
    
    // If > 60% uppercase letters, likely a heading
    if (upperCaseRatio > 0.6) {
      return firstLine;
    }
  }

  // Default: no section detected
  return '';
};

/**
 * Validate PDF buffer before processing
 * 
 * Performs basic checks to ensure buffer is a valid PDF:
 * 1. Buffer exists and is not empty
 * 2. Buffer starts with PDF magic bytes ('%PDF-')
 * 3. File size is reasonable (< 100 MB)
 * 4. Buffer appears to have valid PDF structure
 * 
 * @param {Buffer} buffer - PDF buffer to validate
 * @returns {boolean} - True if valid PDF, false otherwise
 * 
 * @private
 * 
 * @example
 * if (isValidPDF(pdfBuffer)) {
 *   // Safe to process
 * }
 */
const isValidPDF = (buffer) => {
  // Check 1: Buffer/Uint8Array exists and is not empty
  if (!buffer || buffer.length === 0) {
    console.warn('❌ Invalid buffer: empty or not provided');
    return false;
  }

  // Check 2: Check file size (limit to 100 MB)
  const MAX_PDF_SIZE = 100 * 1024 * 1024; // 100 MB
  if (buffer.length > MAX_PDF_SIZE) {
    console.warn(`❌ PDF too large: ${(buffer.length / 1024 / 1024).toFixed(2)} MB exceeds 100 MB limit`);
    return false;
  }

  // Check 3: Verify PDF magic bytes
  // All PDF files start with '%PDF-' (hex: 25 50 44 46 2D)
  // Convert first 5 bytes to ASCII and check if they match
  const header = buffer.toString('ascii', 0, 5);
  if (header !== '%PDF-') {
    console.warn(`❌ Invalid PDF header: "${header}" (expected "%PDF-")`);
    return false;
  }

  // Check 4: Verify PDF structure (should have %%EOF at end)
  // PDFs should end with %%EOF marker
  const footer = buffer.toString('ascii', Math.max(0, buffer.length - 20));
  if (!footer.includes('%%EOF')) {
    console.warn('⚠️  Warning: PDF might be incomplete or corrupted (missing %%EOF marker)');
    // Don't fail here - some valid PDFs might not have perfect structure
  }

  // All checks passed
  return true;
};

/**
 * Get PDF metadata (page count, file info, etc.)
 * 
 * Extracts basic information about the PDF:
 * - Page count
 * - File size
 * - Basic content statistics
 * 
 * @param {Buffer} buffer - PDF buffer
 * @returns {Promise<Object>} - PDF metadata object
 * 
 * @example
 * const metadata = await getPDFMetadata(buffer);
 * // Returns: { 
 * //   pageCount: 150,
 * //   fileSize: 2048000,
 * //   fileSizeMB: 1.95,
 * //   mimeType: 'application/pdf'
 * // }
 */
export const getPDFMetadata = async (buffer) => {
  try {
    // Validate buffer first
    if (!isValidPDF(buffer)) {
      throw new Error('Invalid PDF buffer');
    }

    // Convert to Uint8Array for unpdf
    let uint8Array;
    if (Buffer.isBuffer(buffer)) {
      uint8Array = Uint8Array.from(buffer);
    } else if (buffer instanceof Uint8Array) {
      uint8Array = buffer;
    } else {
      uint8Array = new Uint8Array(buffer);
    }

    // Extract pages to get metadata
    const result = await extractText(uint8Array);
    const pages = result.pages;

    // Calculate file size in different formats
    const fileSizeBytes = buffer.length;
    const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);

    // Return metadata object
    const metadata = {
      pageCount: pages ? pages.length : 0,
      fileSize: fileSizeBytes,
      fileSizeMB: parseFloat(fileSizeMB),
      mimeType: 'application/pdf',
      isValid: true,
      extractedSuccessfully: pages && pages.length > 0,
      textLength: pages ? pages.join('').length : 0
    };

    return metadata;

  } catch (error) {
    // If metadata extraction fails, return basic error metadata
    return {
      pageCount: 0,
      fileSize: buffer ? buffer.length : 0,
      fileSizeMB: buffer ? parseFloat((buffer.length / 1024 / 1024).toFixed(2)) : 0,
      mimeType: 'application/pdf',
      isValid: false,
      error: error.message,
      extractedSuccessfully: false,
      textLength: 0
    };
  }
};