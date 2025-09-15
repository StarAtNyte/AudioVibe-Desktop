// Script to download actual book covers from Archive.org and Open Library
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the book data
const localBooksPath = path.join(__dirname, '..', 'src', 'data', 'localBooks.ts');
const localBooksContent = fs.readFileSync(localBooksPath, 'utf8');

// Extract book data (this is a simple parser - in production you'd use a proper TS parser)
const books = [];

// Parse the books from the TypeScript file
const bookMatches = localBooksContent.match(/{\s*id: "([^"]+)",[\s\S]*?cover_image_url: "([^"]+)"[\s\S]*?}/g);

if (bookMatches) {
  bookMatches.forEach(match => {
    const idMatch = match.match(/id: "([^"]+)"/);
    const coverMatch = match.match(/cover_image_url: "([^"]+)"/);
    const titleMatch = match.match(/title: "([^"]+)"/);
    const isbnMatch = match.match(/isbn: "([^"]+)"/);
    
    if (idMatch && coverMatch && titleMatch) {
      books.push({
        id: idMatch[1],
        title: titleMatch[1],
        cover_url: coverMatch[1],
        isbn: isbnMatch ? isbnMatch[1] : null
      });
    }
  });
}

console.log(`Found ${books.length} books to download covers for...`);

// Create covers directory
const coversDir = path.join(__dirname, '..', 'public', 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
  console.log('Created covers directory');
}

// Function to check if a file is a generic Archive.org logo
function isGenericLogo(filePath) {
  const stats = fs.statSync(filePath);
  // Archive.org generic logos are typically very small (usually around 3-5KB)
  return stats.size < 6000;
}

// Function to generate Open Library cover URLs for a book
function generateOpenLibraryUrls(book) {
  const urls = [];
  
  // Try ISBN first (most reliable)
  if (book.isbn) {
    urls.push(`https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`);
    urls.push(`https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`);
  }
  
  // Try searching by title (less reliable but worth a shot)
  // Note: This is a simplified approach. In production, you'd want to use the Open Library Search API first
  const titleForSearch = book.title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '+');
  
  // These are example URLs - you'd need to implement proper Open Library search
  // For now, we'll focus on ISBN-based lookups
  
  return urls;
}

// Function to download a file with multiple URL attempts
function downloadImage(urls, filename, bookTitle) {
  return new Promise(async (resolve, reject) => {
    const filePath = path.join(coversDir, filename);
    
    // Check if file already exists and is not a generic logo
    if (fs.existsSync(filePath)) {
      if (!isGenericLogo(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✓ ${filename} already exists with good size (${stats.size} bytes), skipping...`);
        resolve(filePath);
        return;
      } else {
        console.log(`🔄 ${filename} exists but appears to be a generic logo, re-downloading...`);
        fs.unlinkSync(filePath);
      }
    }
    
    console.log(`📥 Attempting to download: ${filename} for "${bookTitle}"`);
    
    let lastError = null;
    
    // Try each URL in sequence
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const source = url.includes('archive.org') ? 'Archive.org' : 'Open Library';
      
      try {
        console.log(`  🔄 Trying ${source}: ${url}`);
        
        const success = await attemptDownload(url, filePath);
        
        if (success) {
          // Check if downloaded file is a generic logo
          if (isGenericLogo(filePath)) {
            console.log(`  ❌ Downloaded file appears to be a generic logo, trying next URL...`);
            fs.unlinkSync(filePath);
            continue;
          }
          
          const stats = fs.statSync(filePath);
          console.log(`  ✅ Successfully downloaded from ${source} (${stats.size} bytes)`);
          resolve(filePath);
          return;
        }
      } catch (error) {
        console.log(`  ❌ ${source} failed: ${error.message}`);
        lastError = error;
        
        // Clean up any partial download
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // Add delay between attempts
        if (i < urls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    reject(new Error(`All ${urls.length} cover URLs failed. Last error: ${lastError?.message || 'Unknown error'}`));
  });
}

// Function to attempt a single download
function attemptDownload(url, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`    🔄 Redirected to: ${response.headers.location}`);
        attemptDownload(response.headers.location, filePath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(true);
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
      reject(new Error('Timeout'));
    });
  });
}

// Download all covers
async function downloadAllCovers() {
  console.log('🚀 Starting cover download process with Archive.org + Open Library fallback...\n');
  
  const results = [];
  
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    console.log(`[${i + 1}/${books.length}] Processing: ${book.title}`);
    
    try {
      // Prepare URLs: Archive.org first, then Open Library fallback
      const archiveUrls = [book.cover_url]; // Original Archive.org URL
      const openLibraryUrls = generateOpenLibraryUrls(book);
      
      const filename = `${book.id}.jpg`;
      await downloadImage(archiveUrls, openLibraryUrls, filename, book.title);
      
      results.push({ book, success: true, filename });
      console.log(`✅ Successfully downloaded cover for: ${book.title}\n`);
      
    } catch (error) {
      console.error(`❌ Failed to download cover for ${book.title}: ${error.message}\n`);
      results.push({ book, success: false, error: error.message });
    }
    
    // Add delay between books to be respectful to servers
    if (i < books.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('📊 Download Summary:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful downloads: ${successful.length}`);
  console.log(`❌ Failed downloads: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ Successfully downloaded:');
    successful.forEach(result => {
      console.log(`  📖 ${result.book.title}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed downloads:');
    failed.forEach(result => {
      console.log(`  📖 ${result.book.title}: ${result.error}`);
    });
    
    console.log('\n💡 Suggestions for failed downloads:');
    console.log('  • Check if the books have ISBN numbers in your data');
    console.log('  • Consider adding manual cover URLs for specific books');
    console.log('  • Some books might not have covers available in either service');
  }
  
  // Update bookCovers.ts with successful downloads
  if (successful.length > 0) {
    updateBookCoversFile(successful);
  }
  
  return { successful: successful.length, failed: failed.length };
}

// Update the bookCovers.ts file with the downloaded images
function updateBookCoversFile(successfulDownloads) {
  const bookCoversPath = path.join(__dirname, '..', 'src', 'data', 'bookCovers.ts');
  
  // Create the updated bookCovers mapping
  const coverMappings = successfulDownloads.map(download => {
    return `  "${download.book.id}": "/covers/${download.filename}"`;
  }).join(',\n');
  
  const updatedContent = `// Local book cover images
// Downloaded from Archive.org and Open Library

export const bookCovers: { [bookId: string]: string } = {
${coverMappings}
};

// Fallback covers as base64 data URLs
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
      <text x="100" y="150" text-anchor="middle" fill="white" font-family="serif" font-size="16" font-weight="bold">
        <tspan x="100" dy="0">Pride and</tspan>
        <tspan x="100" dy="20">Prejudice</tspan>
        <tspan x="100" dy="40" font-size="12">Jane Austen</tspan>
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
      <text x="100" y="140" text-anchor="middle" fill="black" font-family="serif" font-size="16" font-weight="bold">
        <tspan x="100" dy="0">The Great</tspan>
        <tspan x="100" dy="20">Gatsby</tspan>
        <tspan x="100" dy="40" font-size="12">F. Scott Fitzgerald</tspan>
      </text>
    </svg>
  \`),
  
  "dorian-gray": "data:image/svg+xml;base64," + btoa(\`
    <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#4B0082;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8B008B;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="200" height="300" fill="url(#grad3)"/>
      <text x="100" y="130" text-anchor="middle" fill="white" font-family="serif" font-size="14" font-weight="bold">
        <tspan x="100" dy="0">The Picture of</tspan>
        <tspan x="100" dy="18">Dorian Gray</tspan>
        <tspan x="100" dy="35" font-size="12">Oscar Wilde</tspan>
      </text>
    </svg>
  \`)
};

export const getBookCover = (bookId: string): string => {
  try {
    // Try to get from bookCovers first (actual images)
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
    ['#a8edea', '#fed6e3']
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
      <circle cx="100" cy="150" r="40" fill="rgba(255,255,255,0.2)"/>
      <text x="100" y="150" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">
        \${bookId.charAt(0).toUpperCase()}
      </text>
    </svg>
  \`;
  
  return \`data:image/svg+xml;base64,\${btoa(svg)}\`;
};
`;
  
  fs.writeFileSync(bookCoversPath, updatedContent);
  console.log(`\n📝 Updated bookCovers.ts with ${successfulDownloads.length} cover mappings`);
}

// Run the download process
downloadAllCovers()
  .then(results => {
    console.log(`\n🎉 Download process completed!`);
    console.log(`📊 Final Results: ${results.successful} successful, ${results.failed} failed`);
    
    if (results.failed > 0) {
      console.log('\n💡 Next steps for failed downloads:');
      console.log('  1. Check that your books have ISBN numbers in localBooks.ts');
      console.log('  2. Consider manually adding cover URLs for important books');
      console.log('  3. Some classic books might need alternative sources');
    }
  })
  .catch(console.error);