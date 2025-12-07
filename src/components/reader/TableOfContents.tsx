import React from 'react';
import { ChevronRight } from 'lucide-react';

interface TOCItem {
  label: string;
  href: string;
  page?: number;
  subitems?: TOCItem[];
}

interface TableOfContentsProps {
  items: TOCItem[];
  onNavigate: (item: TOCItem) => void;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ items, onNavigate }) => {
  const renderItem = (item: TOCItem, depth: number = 0) => (
    <div key={item.href} style={{ paddingLeft: `${depth * 12}px` }}>
      <button
        onClick={() => onNavigate(item)}
        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center justify-between group"
      >
        <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
          {item.label}
        </span>
        {item.page && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{item.page}</span>
        )}
      </button>
      {item.subitems && item.subitems.map(sub => renderItem(sub, depth + 1))}
    </div>
  );

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Table of Contents</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center p-4">
            No table of contents available
          </p>
        ) : (
          items.map(item => renderItem(item))
        )}
      </div>
    </div>
  );
};
