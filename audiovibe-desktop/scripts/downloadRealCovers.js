// Improved script to download real book covers, avoiding Archive.org generic logos
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { allBooks } from './bookData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create covers directory
const coversDir = path.join(__dirname, '..', 'public', 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

// Size of Archive.org generic logo (to detect and avoid)
const GENERIC_LOGO_SIZE = 6831;

// Function to extract Archive.org identifier
function extractArchiveId(coverImageUrl) {
  const match = coverImageUrl.match(/archive\.org\/download\/([^\/]+)/);
  return match ? match[1] : null;
}

// Generate multiple cover URL strategies
function generateCoverUrls(archiveId) {
  const urls = [];
  
  // Strategy 1: Archive.org thumbnail service (what we tried before)
  urls.push(`https://archive.org/services/get-item-image.php?identifier=${archiveId}`);
  
  // Strategy 2: Direct cover file patterns (most likely to work)
  const baseId = archiveId.replace(/_librivox$/, '');
  urls.push(
    `https://archive.org/download/${archiveId}/picture_${baseId}_1006.jpg`,
    `https://archive.org/download/${archiveId}/${archiveId}_1006.jpg`,
    `https://archive.org/download/${archiveId}/cover.jpg`,
    `https://archive.org/download/${archiveId}/folder.jpg`,
    `https://archive.org/download/${archiveId}/${baseId}.jpg`,
    `https://archive.org/download/${archiveId}/${archiveId}.jpg`
  );
  
  // Strategy 3: LibriVox covers (if we can extract numeric ID)
  // This would need the LibriVox ID which we don't have easily accessible
  
  return urls;
}

// Function to download and validate an image
function downloadAndValidateImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(coversDir, filename);
    const protocol = url.startsWith('https:') ? https : http;
    
    console.log(`📥 Trying: ${filename} from ${url}`);
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`🔄 Redirecting to: ${response.headers.location}`);
        return downloadAndValidateImage(response.headers.location, filename).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        reject(new Error(`Not an image: ${contentType}`));
        return;
      }
      
      // Get content length to detect generic logos
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (contentLength === GENERIC_LOGO_SIZE) {
        reject(new Error('Generic Archive.org logo detected'));
        return;
      }
      
      const fileStream = fs.createWriteStream(filePath);
      let downloadedBytes = 0;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
      });
      
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        
        // Final check: if downloaded file is generic logo size, reject it
        if (downloadedBytes === GENERIC_LOGO_SIZE) {
          fs.unlinkSync(filePath); // Delete the generic logo
          reject(new Error('Downloaded file is generic Archive.org logo'));
          return;
        }
        
        console.log(`✅ Downloaded real cover: ${filename} (${downloadedBytes} bytes)`);
        resolve({ filePath, size: downloadedBytes });
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Try multiple URLs until we find a real cover
async function downloadRealCover(book) {
  const archiveId = extractArchiveId(book.cover_image_url);
  if (!archiveId) {
    throw new Error('Could not extract Archive.org ID');
  }
  
  const filename = path.basename(book.local_cover_path);
  const filePath = path.join(coversDir, filename);
  
  // Check if we already have a good cover (not generic logo size)
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size !== GENERIC_LOGO_SIZE && stats.size > 1000) {
      console.log(`✓ ${filename} already exists with good size (${stats.size} bytes), skipping...`);
      return { success: true, filename, skipped: true };
    } else {
      console.log(`🗑️  Removing existing generic logo: ${filename}`);
      fs.unlinkSync(filePath);
    }
  }
  
  const coverUrls = generateCoverUrls(archiveId);
  
  for (let i = 0; i < coverUrls.length; i++) {
    try {
      const result = await downloadAndValidateImage(coverUrls[i], filename);
      return { success: true, filename, size: result.size, url: coverUrls[i] };
    } catch (error) {
      console.log(`  ❌ URL ${i + 1} failed: ${error.message}`);
      if (i < coverUrls.length - 1) {
        console.log(`  🔄 Trying next URL...`);
      }
    }
  }
  
  throw new Error('All cover URLs failed');
}

// Main function
async function downloadAllRealCovers() {
  console.log('🚀 Starting download of REAL book covers (avoiding generic logos)...');
  console.log(`📚 Processing ${allBooks.length} books`);
  console.log('-'.repeat(70));
  
  const results = [];
  
  for (let i = 0; i < allBooks.length; i++) {
    const book = allBooks[i];
    console.log(`\n[${i + 1}/${allBooks.length}] Processing: ${book.title}`);
    
    try {
      const result = await downloadRealCover(book);
      results.push({ book, ...result });
      
      // Small delay between books
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.error(`❌ Failed to get real cover for ${book.title}: ${error.message}`);
      results.push({ book, success: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 REAL COVERS DOWNLOAD SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success);
  const skipped = results.filter(r => r.success && r.skipped);
  const downloaded = results.filter(r => r.success && !r.skipped);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Total successful: ${successful.length}`);
  console.log(`📥 Downloaded new covers: ${downloaded.length}`);
  console.log(`⏭️  Skipped (good existing): ${skipped.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📝 Total processed: ${results.length}`);
  
  if (downloaded.length > 0) {
    console.log('\n📥 Successfully downloaded real covers:');
    downloaded.forEach(result => {
      console.log(`  - ${result.book.title}: ${result.filename} (${result.size} bytes)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Could not find real covers for:');
    failed.forEach(result => {
      console.log(`  - ${result.book.title}: ${result.error}`);
    });
  }
  
  // Update bookCovers.ts if we have any successful downloads
  if (successful.length > 0) {
    updateBookCoversFile(successful);
  }
}

// Update bookCovers.ts
function updateBookCoversFile(successfulBooks) {
  const bookCoversPath = path.join(__dirname, '..', 'src', 'data', 'bookCovers.ts');
  
  const coverMappings = successfulBooks.map(result => {
    const filename = path.basename(result.book.local_cover_path);
    return `  "${result.book.id}": "/covers/${filename}"`;
  }).join(',\n');
  
  const updatedContent = `// Local book cover images
// These are real book covers (not Archive.org generic logos)

export const bookCovers: { [bookId: string]: string } = {
${coverMappings}
};

// Fallback covers as base64 data URLs for books without real covers
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
    // Try to get from bookCovers first (real downloaded covers)
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
    console.log(`\n📝 Updated bookCovers.ts with ${successfulBooks.length} real cover paths`);
  } catch (error) {
    console.error(`❌ Failed to update bookCovers.ts: ${error.message}`);
  }
}

downloadAllRealCovers().catch(console.error);