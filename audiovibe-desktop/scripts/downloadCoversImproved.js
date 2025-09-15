// Improved script to download book covers with multiple fallback strategies
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Better cover URLs from LibriVox and Archive.org
const bookCovers = [
  {
    id: "pride-prejudice",
    title: "Pride and Prejudice",
    urls: [
      "https://ia801309.us.archive.org/31/items/pride_prejudice_librivox/pride_prejudice_1005.jpg",
      "https://ia801309.us.archive.org/31/items/pride_prejudice_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/prideprejudice_1005.jpg"
    ]
  },
  {
    id: "great-gatsby",
    title: "The Great Gatsby", 
    urls: [
      "https://ia801404.us.archive.org/3/items/great_gatsby_fitzgerald_jc/great_gatsby_fitzgerald_jc.jpg",
      "https://ia801404.us.archive.org/3/items/great_gatsby_fitzgerald_jc/__ia_thumb.jpg",
      "https://covers.librivox.org/greatgatsby_jc.jpg"
    ]
  },
  {
    id: "dorian-gray",
    title: "The Picture of Dorian Gray",
    urls: [
      "https://ia904505.us.archive.org/4/items/dorian_gray_librivox/dorian_gray_1006.jpg",
      "https://ia904505.us.archive.org/4/items/dorian_gray_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/picturedoriangray_1006.jpg"
    ]
  },
  {
    id: "jane-eyre",
    title: "Jane Eyre",
    urls: [
      "https://ia803204.us.archive.org/28/items/jane_eyre_librivox/jane_eyre_1006.jpg",
      "https://ia803204.us.archive.org/28/items/jane_eyre_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/janeeyre_1006.jpg"
    ]
  },
  {
    id: "alice-wonderland",
    title: "Alice's Adventures in Wonderland",
    urls: [
      "https://ia601507.us.archive.org/20/items/alices_adventures_wonderland_1311_librivox/alices_adventures_wonderland_1311.jpg",
      "https://ia601507.us.archive.org/20/items/alices_adventures_wonderland_1311_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/alice_1311.jpg"
    ]
  },
  {
    id: "frankenstein",
    title: "Frankenstein",
    urls: [
      "https://ia803101.us.archive.org/7/items/frankenstein_0911_librivox/frankenstein_0911.jpg",
      "https://ia803101.us.archive.org/7/items/frankenstein_0911_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/frankenstein_0911.jpg"
    ]
  },
  {
    id: "sherlock-study-scarlet",
    title: "A Study in Scarlet",
    urls: [
      "https://ia801602.us.archive.org/21/items/study_in_scarlet_1204_librivox/study_in_scarlet_1204.jpg",
      "https://ia801602.us.archive.org/21/items/study_in_scarlet_1204_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/studyscarlet_1204.jpg"
    ]
  },
  {
    id: "hound-baskervilles", 
    title: "The Hound of the Baskervilles",
    urls: [
      "https://ia601600.us.archive.org/4/items/hound_baskervilles_librivox/hound_baskervilles_1006.jpg",
      "https://ia601600.us.archive.org/4/items/hound_baskervilles_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/houndbaskervilles_1006.jpg"
    ]
  },
  {
    id: "mysterious-affair-styles",
    title: "The Mysterious Affair at Styles",
    urls: [
      "https://ia800801.us.archive.org/21/items/mysterious_affair_styles_1511_librivox/mysterious_affair_styles_1511.jpg",
      "https://ia800801.us.archive.org/21/items/mysterious_affair_styles_1511_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/mysteriousaffair_1511.jpg"
    ]
  },
  {
    id: "treasure-island",
    title: "Treasure Island", 
    urls: [
      "https://ia800308.us.archive.org/14/items/treasure_island_librivox/treasure_island_1006.jpg",
      "https://ia800308.us.archive.org/14/items/treasure_island_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/treasureisland_1006.jpg"
    ]
  },
  {
    id: "adventures-tom-sawyer",
    title: "The Adventures of Tom Sawyer",
    urls: [
      "https://ia600308.us.archive.org/32/items/adventures_tom_sawyer_librivox/adventures_tom_sawyer_1006.jpg",
      "https://ia600308.us.archive.org/32/items/adventures_tom_sawyer_librivox/__ia_thumb.jpg", 
      "https://covers.librivox.org/tomsawyer_1006.jpg"
    ]
  },
  {
    id: "time-machine",
    title: "The Time Machine",
    urls: [
      "https://ia601408.us.archive.org/11/items/time_machine_librivox/time_machine_1006.jpg",
      "https://ia601408.us.archive.org/11/items/time_machine_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/timemachine_1006.jpg"
    ]
  },
  {
    id: "war-worlds", 
    title: "The War of the Worlds",
    urls: [
      "https://ia600607.us.archive.org/17/items/war_worlds_librivox/war_worlds_1006.jpg",
      "https://ia600607.us.archive.org/17/items/war_worlds_librivox/__ia_thumb.jpg",
      "https://covers.librivox.org/warworlds_1006.jpg"
    ]
  }
];

// Create covers directory
const coversDir = path.join(__dirname, '..', 'public', 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
  console.log('Created covers directory');
}

// Function to download a file with multiple URL attempts
async function downloadImageWithFallbacks(book) {
  const filename = `${book.id}.jpg`;
  const filePath = path.join(coversDir, filename);
  
  // Check if file already exists
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${filename} already exists, skipping...`);
    return { success: true, filename };
  }
  
  console.log(`📥 Attempting to download: ${filename} for "${book.title}"`);
  
  // Try each URL until one works
  for (let i = 0; i < book.urls.length; i++) {
    const url = book.urls[i];
    console.log(`  🔗 Trying URL ${i + 1}/${book.urls.length}: ${url}`);
    
    try {
      await downloadImage(url, filename);
      console.log(`✅ Downloaded: ${filename} from URL ${i + 1}`);
      return { success: true, filename };
    } catch (error) {
      console.log(`  ❌ Failed URL ${i + 1}: ${error.message}`);
      
      // If this was the last URL, wait a bit before giving up
      if (i === book.urls.length - 1) {
        console.log(`  💔 All URLs failed for ${book.title}`);
      }
    }
  }
  
  return { success: false, error: 'All URLs failed' };
}

// Function to download a single image
function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(coversDir, filename);
    const protocol = url.startsWith('https:') ? https : http;
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`    🔄 Redirecting to: ${response.headers.location}`);
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
    
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

// Download all covers
async function downloadAllCovers() {
  console.log('🚀 Starting improved cover download process...\\n');
  
  const results = [];
  
  // Download sequentially to be nice to servers
  for (const book of bookCovers) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      const result = await downloadImageWithFallbacks(book);
      results.push({ book, ...result });
    } catch (error) {
      console.error(`💥 Unexpected error for ${book.title}: ${error.message}`);
      results.push({ book, success: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\\n📊 Download Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log('\\n❌ Failed downloads:');
    failed.forEach(result => {
      console.log(`  - ${result.book.title}: ${result.error}`);
    });
  }
  
  if (successful.length > 0) {
    console.log('\\n✅ Successful downloads:');
    successful.forEach(result => {
      console.log(`  - ${result.book.title}: ${result.filename}`);
    });
  }
  
  // Update bookCovers.ts with successful downloads
  updateBookCoversFile(successful);
}

// Update the bookCovers.ts file
function updateBookCoversFile(successfulDownloads) {
  const bookCoversPath = path.join(__dirname, '..', 'src', 'data', 'bookCovers.ts');
  
  // Create the updated bookCovers mapping
  const coverMappings = successfulDownloads.map(download => {
    return `  "${download.book.id}": "/covers/${download.filename}"`;
  }).join(',\\n');
  
  const updatedContent = `// Local book cover images
// These are actual downloaded cover images from Archive.org/LibriVox

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
      <text x="100" y="130" text-anchor="middle" fill="white" font-family="serif" font-size="16" font-weight="bold">
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
      <text x="100" y="130" text-anchor="middle" fill="black" font-family="serif" font-size="16" font-weight="bold">
        <tspan x="100" dy="0">The Great</tspan>
        <tspan x="100" dy="20">Gatsby</tspan>
        <tspan x="100" dy="40" font-size="12">F. Scott Fitzgerald</tspan>
      </text>
    </svg>
  \`),

  "alice-wonderland": "data:image/svg+xml;base64," + btoa(\`
    <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#00CED1;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#4169E1;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="200" height="300" fill="url(#grad5)"/>
      <text x="100" y="120" text-anchor="middle" fill="white" font-family="serif" font-size="14" font-weight="bold">
        <tspan x="100" dy="0">Alice's Adventures</tspan>
        <tspan x="100" dy="18">in Wonderland</tspan>
        <tspan x="100" dy="35" font-size="12">Lewis Carroll</tspan>
      </text>
    </svg>
  \`),

  "frankenstein": "data:image/svg+xml;base64," + btoa(\`
    <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad6" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2F4F4F;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#708090;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="200" height="300" fill="url(#grad6)"/>
      <text x="100" y="140" text-anchor="middle" fill="white" font-family="serif" font-size="18" font-weight="bold">
        <tspan x="100" dy="0">Frankenstein</tspan>
        <tspan x="100" dy="35" font-size="12">Mary Shelley</tspan>
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
  console.log(`\\n📝 Updated bookCovers.ts with ${successfulDownloads.length} cover mappings`);
}

// Run the download process
downloadAllCovers().catch(console.error);