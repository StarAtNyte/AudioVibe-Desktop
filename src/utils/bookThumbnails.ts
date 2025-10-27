// Compressed base64 thumbnails for better loading performance
// These are small, low-quality placeholders that load instantly

export const bookThumbnails = {
  // Classic Literature thumbnails (64x64 compressed)
  'c1': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAQABADASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAABAUGB//EACgQAAIBAwMCBgMBAAAAAAAAAAECAwAEEQUSITFBBhMiUWFxFDKBkf/EABcBAAMBAAAAAAAAAAAAAAAAAAECAwT/xAAeEQACAgICAwAAAAAAAAAAAAABAgARAyESMVFhcf/aAAwDAQACEQMRAD8A2elapdanc+VbWsk8mMhI1JOPsKs9P0q5spFeWaKZCM8Pkj74NVOlWcOnWKwlZJJHYGSXdl3J9TWhRa1KO7OTKByarggpwBOa1jh6mTqmZa00wqBkEnOaUP8AiY8cV1BqsrMhHwakuozNNHyaTyFhUmhj0pYeIJZtQmWOKGKxdGYktGvmZyAOCeaZx+HdT0nUZ7t9SgkSRBFKjrjcAc8VqXRxPqR0XTZ54WLXLQNG8WMgowzyK66vG+N9G1LSNPnBN3M9zCBtZCqhdw6H3rVzKn0ggUPrJ4cZZ9t7iIjwyf/Z',
  
  'c2': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAQABADASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAABAUGB//EACgQAAIBAwMCBgMBAAAAAAAAAAECAwAEEQUSITFBBhMiUWFxFDKBkf/EABcBAAMBAAAAAAAAAAAAAAAAAAECAwT/xAAeEQACAgICAwAAAAAAAAAAAAABAgARAyESMVFhcf/aAAwDAQACEQMRAD8A2elapdanc+VbWsk8mMhI1JOPsKs9P0q5spFeWaKZCM8Pkj74NVOlWcOnWKwlZJJHYGSXdl3J9TWhRa1KO7OTKByarggpwBOa1jh6mTqmZa00wqBkEnOaUP8AiY8cV1BqsrMhHwakuozNNHyaTyFhUmhj0pYeIJZtQmWOKGKxdGYktGvmZyAOCeaZx+HdT0nUZ7t9SgkSRBFKjrjcAc8VqXRxPqR0XTZ54WLXLQNG8WMgowzyK66vG+N9G1LSNPnBN3M9zCBtZCqhdw6H3rVzKn0ggUPrJ4cZZ9t7iIjwyf/Z',
  
  'c3': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAQABADASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAABAUGB//EACgQAAIBAwMCBgMBAAAAAAAAAAECAwAEEQUSITFBBhMiUWFxFDKBkf/EABcBAAMBAAAAAAAAAAAAAAAAAAECAwT/xAAeEQACAgICAwAAAAAAAAAAAAABAgARAyESMVFhcf/aAAwDAQACEQMRAD8A2elapdanc+VbWsk8mMhI1JOPsKs9P0q5spFeWaKZCM8Pkj74NVOlWcOnWKwlZJJHYGSXdl3J9TWhRa1KO7OTKByarggpwBOa1jh6mTqmZa00wqBkEnOaUP8AiY8cV1BqsrMhHwakuozNNHyaTyFhUmhj0pYeIJZtQmWOKGKxdGYktGvmZyAOCeaZx+HdT0nUZ7t9SgkSRBFKjrjcAc8VqXRxPqR0XTZ54WLXLQNG8WMgowzyK66vG+N9G1LSNPnBN3M9zCBtZCqhdw6H3rVzKn0ggUPrJ4cZZ9t7iIjwyf/Z'
};

// Function to get thumbnail with fallback to gradient
export const getBookThumbnail = (bookId: string, title: string): string => {
  const thumbnail = bookThumbnails[bookId as keyof typeof bookThumbnails];
  
  // If we have a thumbnail, return it, otherwise return a data URL for a gradient
  if (thumbnail) {
    return thumbnail;
  }
  
  // Generate a simple gradient based on the first letter
  const letter = title.charAt(0).toUpperCase();
  const colors = [
    ['#667eea', '#764ba2'], // Blue to purple
    ['#f093fb', '#f5576c'], // Pink to red
    ['#4facfe', '#00f2fe'], // Blue to cyan
    ['#43e97b', '#38f9d7'], // Green to teal
    ['#ffecd2', '#fcb69f'], // Cream to peach
    ['#a8edea', '#fed6e3'], // Mint to pink
    ['#d299c2', '#fef9d7'], // Purple to yellow
    ['#89f7fe', '#66a6ff']  // Light blue to blue
  ];
  
  const colorIndex = letter.charCodeAt(0) % colors.length;
  const [color1, color2] = colors[colorIndex];
  
  // Create SVG gradient as data URL
  const svg = `
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#grad)" />
      <text x="32" y="40" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">${letter}</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};