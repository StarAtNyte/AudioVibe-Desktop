import React from 'react';

export * from './audiobook';
export * from './collection';

// Navigation and UI types
export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface Theme {
  mode: 'light' | 'dark';
}