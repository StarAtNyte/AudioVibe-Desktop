import React, { useEffect, useRef, useState } from 'react';
import { useReaderStore } from '../../store/reader';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const PDFReader: React.FC = () => {
  const { currentEbook, currentPage, setCurrentPage, setTotalPages, readerSettings } = useReaderStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.0);

  // Load PDF document
  useEffect(() => {
    if (!currentEbook) return;

    const loadPDF = async () => {
      try {
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const fileUrl = convertFileSrc(currentEbook.file_path);

        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };

    loadPDF();

    return () => {
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [currentEbook]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        // Calculate scale to fit container
        const container = containerRef.current;
        if (container) {
          const containerWidth = container.clientWidth;
          const viewport = page.getViewport({ scale: 1.0 });
          const calculatedScale = (containerWidth * 0.9) / viewport.width;
          setScale(calculatedScale);
        }

        const viewport = page.getViewport({ scale });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (error) {
        console.error('Error rendering PDF page:', error);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // Apply theme
  const backgroundColor = readerSettings.theme === 'dark' ? '#1f2937' :
                        readerSettings.theme === 'sepia' ? '#f5f5dc' : '#ffffff';

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center h-full overflow-auto p-4"
      style={{ backgroundColor }}
    >
      <canvas ref={canvasRef} className="shadow-2xl" />
    </div>
  );
};
