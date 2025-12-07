import React from 'react';
import { useReaderStore } from '../../store/reader';
import { PDFReader } from './PDFReader';
import { EPUBReader } from './EPUBReader';

export const EbookReader: React.FC = () => {
  const { currentEbook } = useReaderStore();

  if (!currentEbook) return null;

  const ReaderComponent = currentEbook.file_format === 'pdf' ? PDFReader : EPUBReader;

  return (
    <div className="h-full w-full bg-gray-900">
      <ReaderComponent />
    </div>
  );
};
