import React from 'react';
import clsx from 'clsx';

interface MainContentProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export const MainContent: React.FC<MainContentProps> = ({ 
  children, 
  className,
  padding = true 
}) => {
  return (
    <main 
      className={clsx(
        'main-content bg-gray-50 dark:bg-dark-900',
        'flex flex-col min-h-0',
        padding && 'p-6',
        className
      )}
    >
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </main>
  );
};