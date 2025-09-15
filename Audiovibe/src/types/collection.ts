import type { Collection, CreateCollectionDto, Audiobook } from './audiobook';

export interface CollectionAudiobook {
  id: string;
  collection_id: string;
  audiobook_id: string;
  added_at: string;
  sort_order: number;
}

export interface CollectionWithAudiobooks extends Collection {
  audiobooks?: Audiobook[];
  audiobook_count?: number;
}

// Smart collection types
export interface SmartCriteria {
  rules: SmartRule[];
  operator: 'AND' | 'OR';
}

export interface SmartRule {
  field: AudiobookField;
  operator: ComparisonOperator;
  value: string;
}

export type AudiobookField = 
  | 'title'
  | 'author'
  | 'narrator'
  | 'genre'
  | 'duration'
  | 'publish_date'
  | 'added_date'
  | 'file_size'
  | 'chapters_count';

export type ComparisonOperator = 
  | 'equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface CreateSmartCollectionDto {
  name: string;
  description?: string;
  color?: string;
  smart_criteria: SmartCriteria;
}

// Re-export from audiobook types for convenience
export type { Collection, CreateCollectionDto };