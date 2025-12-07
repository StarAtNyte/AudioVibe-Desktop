// Ebook types matching Rust backend

export interface Ebook {
  id: string;
  title: string;
  author?: string;
  file_path: string;
  file_format: 'pdf' | 'epub';
  cover_path?: string;
  total_pages?: number;
  file_size?: number;
  language?: string;
  publisher?: string;
  publication_date?: string;
  description?: string;
  genre?: string;
  added_date: string;
  modified_date: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingProgress {
  id: string;
  ebook_id: string;
  current_page?: number; // for PDF
  current_cfi?: string; // for EPUB (Canonical Fragment Identifier)
  current_chapter_href?: string; // fallback for EPUB
  percentage_complete: number;
  reading_time_seconds: number;
  last_read_date: string;
  created_at: string;
  updated_at: string;
}

export interface Bookmark {
  id: string;
  ebook_id: string;
  page_number?: number; // for PDF
  cfi?: string; // for EPUB
  chapter_title?: string;
  note?: string;
  created_date: string;
  created_at: string;
  updated_at: string;
}

export interface Annotation {
  id: string;
  ebook_id: string;
  annotation_type: 'highlight' | 'underline' | 'note';
  color?: string; // for highlights (yellow, green, blue, pink)
  cfi_range?: string; // EPUB selection range
  position_data?: string; // JSON for PDF coordinates
  selected_text?: string;
  note?: string;
  created_date: string;
  created_at: string;
  updated_at: string;
}

export interface ReaderSettings {
  ebook_id: string;
  font_family: string;
  font_size: number;
  line_height: number;
  letter_spacing: number;
  text_align: 'left' | 'justify' | 'center' | 'right';
  theme: 'light' | 'dark' | 'sepia' | 'custom';
  background_color?: string;
  text_color?: string;
  flow_mode: 'paginated' | 'scrolled';
  created_at: string;
  updated_at: string;
}

// DTOs for API communication
export interface CreateEbookDto {
  title: string;
  file_path: string;
  file_format: 'pdf' | 'epub';
  author?: string;
  description?: string;
  genre?: string;
  language?: string;
  publisher?: string;
  publication_date?: string;
  total_pages?: number;
  file_size?: number;
  cover_path?: string;
}

export interface UpdateEbookDto {
  title?: string;
  author?: string;
  description?: string;
  genre?: string;
  cover_path?: string;
  publisher?: string;
  publication_date?: string;
}

export interface UpdateReadingProgressDto {
  current_page?: number;
  current_cfi?: string;
  current_chapter_href?: string;
  percentage_complete?: number;
  reading_time_seconds?: number;
}

export interface CreateBookmarkDto {
  ebook_id: string;
  page_number?: number;
  cfi?: string;
  chapter_title?: string;
  note?: string;
}

export interface CreateAnnotationDto {
  ebook_id: string;
  annotation_type: 'highlight' | 'underline' | 'note';
  color?: string;
  cfi_range?: string;
  position_data?: string;
  selected_text?: string;
  note?: string;
}

export interface UpdateReaderSettingsDto {
  font_family?: string;
  font_size?: number;
  line_height?: number;
  letter_spacing?: number;
  text_align?: 'left' | 'justify' | 'center' | 'right';
  theme?: 'light' | 'dark' | 'sepia' | 'custom';
  background_color?: string;
  text_color?: string;
  flow_mode?: 'paginated' | 'scrolled';
}

// Metadata extraction result
export interface EbookMetadata {
  title?: string;
  author?: string;
  publisher?: string;
  language?: string;
  publication_date?: string;
  total_pages?: number;
  cover_image?: string; // base64 encoded
  description?: string;
}

// PDF-specific types
export interface PDFTextBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  pageNumber: number;
}

// EPUB-specific types
export interface EPUBTocItem {
  label: string;
  href: string;
  subitems?: EPUBTocItem[];
}

export interface EPUBLocation {
  cfi: string;
  href: string;
  displayed: {
    page: number;
    total: number;
  };
}
