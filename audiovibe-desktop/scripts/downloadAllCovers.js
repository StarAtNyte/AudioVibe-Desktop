// Script to download all book cover images using Archive.org thumbnail service
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { allBooks } from './bookData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create covers directory
const coversDir = path.join(__dirname, '..', 'public', 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
  console.log('Created covers directory');
}

// Function to extract Archive.org identifier from cover_image_url
function extractArchiveId(coverImageUrl) {
  // URLs are like: https://archive.org/download/pride_prejudice_librivox/__ia_thumb.jpg
  const match = coverImageUrl.match(/archive\.org\/download\/([^\/]+)/);
  return match ? match[1] : null;
}

// Function to generate Archive.org thumbnail service URL
function generateThumbnailUrl(archiveId) {
  return `https://archive.org/services/get-item-image.php?identifier=${archiveId}`;
}

// Function to download a single image
function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(coversDir, filename);
    
    console.log(`📥 Downloading: ${filename}`);
    console.log(`    from: ${url}`);
    
    const request = https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`🔄 Redirecting to: ${response.headers.location}`);
        return downloadImage(response.headers.location, filename).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        reject(new Error(`Not an image: ${contentType}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`✅ Downloaded: ${filename} (${response.headers['content-length'] || 'unknown'} bytes)`);
        resolve(filePath);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(filePath, () => {}); // Delete partial file
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// Download all covers
async function downloadAllCovers() {
  console.log('🚀 Starting download of all book cover images...');
  
  // Get all books from the data file
  console.log(`📚 Found ${allBooks.length} books to download covers for`);
  console.log('-'.repeat(60));
  
  const results = [];
  
  for (let i = 0; i < allBooks.length; i++) {
    const book = allBooks[i];
    console.log(`\n[${i + 1}/${allBooks.length}] Processing: ${book.title}`);
    
    try {
      // Extract Archive.org identifier
      const archiveId = extractArchiveId(book.cover_image_url);
      if (!archiveId) {
        console.log(`❌ Could not extract Archive.org ID from: ${book.cover_image_url}`);
        results.push({ book, success: false, error: 'Invalid Archive.org URL' });
        continue;
      }
      
      console.log(`🔍 Archive ID: ${archiveId}`);
      
      // Generate thumbnail service URL
      const thumbnailUrl = generateThumbnailUrl(archiveId);
      
      // Determine filename from local_cover_path
      const filename = path.basename(book.local_cover_path);
      const filePath = path.join(coversDir, filename);
      
      // Check if file already exists
      if (fs.existsSync(filePath)) {
        console.log(`✓ ${filename} already exists, skipping...`);
        results.push({ book, success: true, filename, skipped: true });
        continue;
      }
      
      // Download the image
      await downloadImage(thumbnailUrl, filename);
      results.push({ book, success: true, filename });
      
      // Small delay between downloads to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Failed to download ${book.title}: ${error.message}`);
      results.push({ book, success: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DOWNLOAD SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const skipped = results.filter(r => r.success && r.skipped);
  const downloaded = results.filter(r => r.success && !r.skipped);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Total successful: ${successful.length}`);
  console.log(`📥 Downloaded: ${downloaded.length}`);
  console.log(`⏭️  Skipped (already existed): ${skipped.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📝 Total processed: ${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed downloads:');
    failed.forEach(result => {
      console.log(`  - ${result.book.title}: ${result.error}`);
    });
  }
  
  if (downloaded.length > 0) {
    console.log('\n📥 Successfully downloaded:');
    downloaded.forEach(result => {
      console.log(`  - ${result.book.title}: ${result.filename}`);
    });
  }
  
  // Update bookCovers.ts with local paths
  if (successful.length > 0) {
    updateBookCoversFile(successful);
  }
}

// Update the bookCovers.ts file to use local paths
function updateBookCoversFile(successfulBooks) {
  const bookCoversPath = path.join(__dirname, '..', 'src', 'data', 'bookCovers.ts');
  
  // Create the updated bookCovers mapping with local paths
  const coverMappings = successfulBooks.map(result => {
    const filename = path.basename(result.book.local_cover_path);
    return `  "${result.book.id}": "/covers/${filename}"`;
  }).join(',\n');
  
  const updatedContent = `// Local book cover images
// These are locally downloaded cover images for better performance

export const bookCovers: { [bookId: string]: string } = {
${coverMappings}
};

// Fallback covers as base64 data URLs for books without downloaded covers
export const fallbackCovers: { [bookId: string]: string } = {
  "pride-prejudice": "data:image/svg+xml;base64," + btoa(\`
    <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#8B4513;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#D2691E;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="200" height="300" fill="url(#grad1)"/>
      <rect x="15" y="15" width="170" height="270" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <text x="100" y="120" text-anchor="middle" fill="white" font-family="serif" font-size="18" font-weight="bold">
        <tspan x="100" dy="0">Pride and</tspan>
        <tspan x="100" dy="25">Prejudice</tspan>
      </text>
      <text x="100" y="180" text-anchor="middle" fill="rgba(255,255,255,0.8)" font-family="serif" font-size="14">
        Jane Austen
      </text>
    </svg>
  \`),
  
  "great-gatsby": "data:image/svg+xml;base64," + btoa(\`
    <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FF8C00;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="200" height="300" fill="url(#grad2)"/>
      <rect x="15" y="15" width="170" height="270" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2"/>
      <text x="100" y="130" text-anchor="middle" fill="black" font-family="serif" font-size="18" font-weight="bold">
        <tspan x="100" dy="0">The Great</tspan>
        <tspan x="100" dy="25">Gatsby</tspan>
      </text>
      <text x="100" y="190" text-anchor="middle" fill="rgba(0,0,0,0.8)" font-family="serif" font-size="14">
        F. Scott Fitzgerald
      </text>
    </svg>
  \`)
};

export const getBookCover = (bookId: string): string => {
  try {
    // Try to get from bookCovers first (locally downloaded images)
    if (bookId && bookCovers[bookId]) {
      return bookCovers[bookId];
    }
    
    // Fall back to generated SVG covers
    if (bookId && fallbackCovers[bookId]) {
      return fallbackCovers[bookId];
    }
    
    // Ultimate fallback - generate a simple cover
    return generateSimpleCover(bookId || 'unknown');
  } catch (error) {
    console.warn('Error getting book cover:', error);
    return generateSimpleCover(bookId || 'unknown');
  }
};

const generateSimpleCover = (bookId: string): string => {
  const colors = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'], 
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#ffecd2', '#fcb69f'],
    ['#a8edea', '#fed6e3'],
    ['#ff9a9e', '#fecfef'],
    ['#a8e6cf', '#dcedc1']
  ];
  
  const colorIndex = bookId.charCodeAt(0) % colors.length;
  const [color1, color2] = colors[colorIndex];
  
  const svg = \`
    <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:\${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:\${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="200" height="300" fill="url(#grad)"/>
      <rect x="15" y="15" width="170" height="270" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <circle cx="100" cy="150" r="40" fill="rgba(255,255,255,0.2)"/>
      <text x="100" y="150" text-anchor="middle" fill="white" font-family="Arial" font-size="32" font-weight="bold">
        \${bookId.charAt(0).toUpperCase()}
      </text>
      <text x="100" y="220" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="Arial" font-size="12">
        AudioBook
      </text>
    </svg>
  \`;
  
  return \`data:image/svg+xml;base64,\${btoa(svg)}\`;
};
`;
  
  try {
    fs.writeFileSync(bookCoversPath, updatedContent);
    console.log(`\n📝 Updated bookCovers.ts with ${successfulBooks.length} local image paths`);
    console.log(`    File: ${bookCoversPath}`);
  } catch (error) {
    console.error(`❌ Failed to update bookCovers.ts: ${error.message}`);
  }
}

// Run the download process
downloadAllCovers().catch(console.error);