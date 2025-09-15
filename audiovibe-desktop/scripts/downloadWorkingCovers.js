// Script to download working book cover images with fallback to simpler URLs
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Working book cover URLs from LibriVox Archive.org collections
const workingBookCovers = [
  {
    id: "pride-prejudice",
    title: "Pride and Prejudice",
    coverUrl: "https://ia902308.us.archive.org/24/items/prideandprejudice_1005_librivox/__ia_thumb.jpg"
  },
  {
    id: "great-gatsby", 
    title: "The Great Gatsby",
    coverUrl: "https://ia801404.us.archive.org/3/items/great_gatsby_fitzgerald_jc/__ia_thumb.jpg"
  },
  {
    id: "dorian-gray",
    title: "The Picture of Dorian Gray", 
    coverUrl: "https://ia904505.us.archive.org/4/items/dorian_gray_librivox/__ia_thumb.jpg"
  },
  {
    id: "jane-eyre",
    title: "Jane Eyre",
    coverUrl: "https://ia803204.us.archive.org/28/items/jane_eyre_librivox/__ia_thumb.jpg"
  },
  {
    id: "alice-wonderland",
    title: "Alice's Adventures in Wonderland",
    coverUrl: "https://ia601507.us.archive.org/20/items/alices_adventures_wonderland_1311_librivox/__ia_thumb.jpg"
  },
  {
    id: "frankenstein",
    title: "Frankenstein",
    coverUrl: "https://ia803101.us.archive.org/7/items/frankenstein_0911_librivox/__ia_thumb.jpg"
  },
  {
    id: "sherlock-study-scarlet",
    title: "A Study in Scarlet",
    coverUrl: "https://ia801602.us.archive.org/21/items/study_in_scarlet_1204_librivox/__ia_thumb.jpg"
  },
  {
    id: "hound-baskervilles",
    title: "The Hound of the Baskervilles", 
    coverUrl: "https://ia601600.us.archive.org/4/items/hound_baskervilles_librivox/__ia_thumb.jpg"
  },
  {
    id: "mysterious-affair-styles",
    title: "The Mysterious Affair at Styles",
    coverUrl: "https://ia800801.us.archive.org/21/items/mysterious_affair_styles_1511_librivox/__ia_thumb.jpg"
  },
  {
    id: "treasure-island",
    title: "Treasure Island",
    coverUrl: "https://ia800308.us.archive.org/14/items/treasure_island_librivox/__ia_thumb.jpg"
  },
  {
    id: "adventures-tom-sawyer", 
    title: "The Adventures of Tom Sawyer",
    coverUrl: "https://ia600308.us.archive.org/32/items/adventures_tom_sawyer_librivox/__ia_thumb.jpg"
  },
  {
    id: "time-machine",
    title: "The Time Machine",
    coverUrl: "https://ia601408.us.archive.org/11/items/time_machine_librivox/__ia_thumb.jpg"
  },
  {
    id: "war-worlds",
    title: "The War of the Worlds", 
    coverUrl: "https://ia600607.us.archive.org/17/items/war_worlds_librivox/__ia_thumb.jpg"
  }
];

// Create covers directory
const coversDir = path.join(__dirname, '..', 'public', 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
  console.log('Created covers directory');
}

// Function to download a single image with shorter timeout
function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(coversDir, filename);
    const protocol = url.startsWith('https:') ? https : http;
    
    console.log(`📥 Downloading: ${filename} from ${url}`);
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`🔄 Redirecting to: ${response.headers.location}`);
        downloadImage(response.headers.location, filename).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`✅ Downloaded: ${filename}`);
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
    
    // Shorter timeout for faster failures
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// Download all working covers
async function downloadAllWorkingCovers() {
  console.log('🚀 Starting working book cover download process...');
  console.log(`📚 Will download ${workingBookCovers.length} book covers\n`);
  
  const results = [];
  
  // Download sequentially to be nice to Archive.org servers
  for (const book of workingBookCovers) {
    try {
      // Check if file already exists
      const filename = `${book.id}.jpg`;
      const filePath = path.join(coversDir, filename);
      
      if (fs.existsSync(filePath)) {
        console.log(`✓ ${filename} already exists, replacing...`);
        fs.unlinkSync(filePath); // Delete the old version
      }
      
      await downloadImage(book.coverUrl, filename);
      results.push({ book, success: true, filename });
      
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Failed to download ${book.title}: ${error.message}`);
      results.push({ book, success: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\n📊 Download Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed downloads:');
    failed.forEach(result => {
      console.log(`  - ${result.book.title}: ${result.error}`);
    });
  }
  
  if (successful.length > 0) {
    console.log('\n✅ Successfully downloaded working covers:');
    successful.forEach(result => {
      console.log(`  - ${result.book.title}: ${result.filename}`);
    });
    
    // Update bookCovers.ts with all successful downloads
    updateBookCoversFile(successful);
  }
}

// Update the bookCovers.ts file
function updateBookCoversFile(successfulDownloads) {
  const bookCoversPath = path.join(__dirname, '..', 'src', 'data', 'bookCovers.ts');
  
  // Create the updated bookCovers mapping
  const coverMappings = successfulDownloads.map(download => {
    return `  "${download.book.id}": "/covers/${download.filename}"`;
  }).join(',\n');
  
  const updatedContent = `// Local book cover images
// These are actual book cover images from LibriVox/Archive.org

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
    // Try to get from bookCovers first (actual downloaded images)
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
  
  fs.writeFileSync(bookCoversPath, updatedContent);
  console.log(`\n📝 Updated bookCovers.ts with ${successfulDownloads.length} working cover mappings`);
}

// Run the download process
downloadAllWorkingCovers().catch(console.error);