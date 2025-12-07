import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useReaderStore } from '../../store/reader';
import ePub, { Book, Rendition, NavItem } from 'epubjs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Settings,
  X,
  Menu,
  Sun,
  Moon,
  Minus,
  Plus,
  Type,
  Columns,
  Maximize,
  Minimize,
  Square,
} from 'lucide-react';

export const EPUBReader: React.FC = () => {
  const { currentEbook, currentCFI, setCurrentCFI, setCurrentPage: setCurrentPageStore, setTotalPages, readerSettings, updateSettings } = useReaderStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [toc, setToc] = useState<NavItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPagesCount, setTotalPagesCount] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const hideControlsTimeoutRef = useRef<number | undefined>(undefined);

  // Settings
  const [fontSize, setFontSize] = useState(readerSettings.font_size || 18);
  const [theme, setTheme] = useState(readerSettings.theme || 'dark');
  const [flowMode, setFlowMode] = useState<'paginated' | 'scrolled'>(readerSettings.flow_mode || 'paginated');
  const [spread, setSpread] = useState<'none' | 'auto'>('auto');

  // Navigation functions
  const goToNextPage = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.next();
    }
  }, []);

  const goToPrevPage = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.prev();
    }
  }, []);

  const goToLocation = useCallback((href: string) => {
    if (renditionRef.current) {
      renditionRef.current.display(href);
      setShowTOC(false);
    }
  }, []);

  // Mouse move handler to show/hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);

    // Clear existing timeout
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    // Hide controls after 2 seconds of inactivity
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (!showSettings && !showTOC) {
        setShowControls(false);
      }
    }, 2000);
  }, [showSettings, showTOC]);

  // Show controls when settings/TOC are open
  useEffect(() => {
    if (showSettings || showTOC) {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    }
  }, [showSettings, showTOC]);

  // Auto-focus the container when component mounts and when settings/TOC close
  useEffect(() => {
    if (mainContainerRef.current && !showSettings && !showTOC) {
      // Use a small delay to ensure DOM is ready
      setTimeout(() => {
        mainContainerRef.current?.focus();
      }, 100);
    }
  }, [showSettings, showTOC]);

  // Focus on initial mount and when rendering finishes
  useEffect(() => {
    if (!isRendering && mainContainerRef.current) {
      setTimeout(() => {
        mainContainerRef.current?.focus();
      }, 100);
    }
  }, [isRendering]);

  // Apply theme and font size changes dynamically
  useEffect(() => {
    if (!renditionRef.current) return;

    console.log('Applying theme change:', theme, 'fontSize:', fontSize);

    const themeConfig = getThemeStyles(theme, fontSize);

    // Apply styles directly to all iframe documents using CSS injection
    const applyStylesToIframes = () => {
      try {
        const contents = renditionRef.current?.getContents();
        if (contents && contents.length > 0) {
          console.log(`Applying styles to ${contents.length} iframe(s)`);
          contents.forEach((content: any, index: number) => {
            if (content.document) {
              // Remove old custom style if exists
              const oldStyle = content.document.getElementById('custom-reader-theme');
              if (oldStyle) {
                oldStyle.remove();
              }

              // Inject new style tag with theme CSS
              const styleEl = content.document.createElement('style');
              styleEl.id = 'custom-reader-theme';
              styleEl.textContent = themeConfig.css;
              content.document.head.appendChild(styleEl);

              console.log(`Theme CSS injected into iframe ${index + 1}`);
            }
          });
        } else {
          console.log('No iframe contents found yet');
        }
      } catch (error) {
        console.error('Error applying styles to iframes:', error);
      }
    };

    // Apply immediately to current iframes
    applyStylesToIframes();

    // Also apply when new pages are rendered
    const handleRendered = () => {
      console.log('Page rendered, applying theme immediately...');
      // Apply immediately without delay
      applyStylesToIframes();
    };

    renditionRef.current.on('rendered', handleRendered);

    console.log('Theme setup complete');

    return () => {
      if (renditionRef.current) {
        renditionRef.current.off('rendered', handleRendered);
      }
    };
  }, [theme, fontSize]);

  // Save settings to store separately (debounced to avoid excessive DB writes)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateSettings({ theme, font_size: fontSize });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [theme, fontSize, updateSettings]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't handle if settings or TOC is open
      if (showSettings || showTOC) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' && !e.shiftKey) {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === ' ' && e.shiftKey) {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'Escape') {
        setShowSettings(false);
        setShowTOC(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [goToNextPage, goToPrevPage, showSettings, showTOC]);

  const getThemeStyles = (themeName: string, size: number = 18) => {
    const themes = {
      light: {
        bg: '#ffffff',
        fg: '#1f2937',
        css: `
          html, body {
            font-family: Georgia, serif !important;
            font-size: ${size}px !important;
            line-height: 1.6 !important;
            color: #1f2937 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            padding: 40px 40px 80px 40px !important;
            margin: 0 !important;
          }
          * {
            color: #1f2937 !important;
          }
          a {
            color: #2563eb !important;
          }
        `
      },
      dark: {
        bg: '#1f2937',
        fg: '#e5e7eb',
        css: `
          html, body {
            font-family: Georgia, serif !important;
            font-size: ${size}px !important;
            line-height: 1.6 !important;
            color: #e5e7eb !important;
            background: #1f2937 !important;
            background-color: #1f2937 !important;
            padding: 40px 40px 80px 40px !important;
            margin: 0 !important;
          }
          * {
            color: #e5e7eb !important;
          }
          a {
            color: #60a5fa !important;
          }
        `
      },
      sepia: {
        bg: '#f4ecd8',
        fg: '#5c4a3a',
        css: `
          html, body {
            font-family: Georgia, serif !important;
            font-size: ${size}px !important;
            line-height: 1.6 !important;
            color: #5c4a3a !important;
            background: #f4ecd8 !important;
            background-color: #f4ecd8 !important;
            padding: 40px 40px 80px 40px !important;
            margin: 0 !important;
          }
          * {
            color: #5c4a3a !important;
          }
          a {
            color: #92400e !important;
          }
        `
      },
    };
    return themes[themeName as keyof typeof themes] || themes.dark;
  };

  const recreateRendition = useCallback(async (newFlowMode?: 'paginated' | 'scrolled', newSpread?: 'none' | 'auto') => {
    if (!bookRef.current || !containerRef.current) return;

    const book = bookRef.current;
    const location = renditionRef.current?.currentLocation() as any;
    const currentCfi = location?.start?.cfi;

    // Destroy old rendition
    if (renditionRef.current) {
      renditionRef.current.destroy();
    }

    // Create new rendition with updated settings
    const rendition = book.renderTo(containerRef.current, {
      width: '100%',
      height: '100%',
      flow: newFlowMode || flowMode,
      spread: newSpread || spread,
      minSpreadWidth: 800,
      allowScriptedContent: true,
    } as any);

    renditionRef.current = rendition;

    // Apply theme immediately using CSS injection via content hook
    const themeConfig = getThemeStyles(theme, fontSize);

    // Use content hook to apply theme BEFORE the page is rendered
    rendition.hooks.content.register((contents: any) => {
      try {
        if (contents.document) {
          // Remove old style if exists
          const oldStyle = contents.document.getElementById('custom-reader-theme');
          if (oldStyle) oldStyle.remove();

          // Inject theme CSS immediately
          const styleEl = contents.document.createElement('style');
          styleEl.id = 'custom-reader-theme';
          styleEl.textContent = themeConfig.css;
          contents.document.head.appendChild(styleEl);

          // Add click listener to close sidebars when clicking on content
          contents.document.addEventListener('click', () => {
            setShowSettings(false);
            setShowTOC(false);
          });

          // Add keyboard navigation inside iframe
          contents.document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (showSettings || showTOC) return;

            if (e.key === 'ArrowRight' || e.key === 'PageDown') {
              e.preventDefault();
              goToNextPage();
            } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
              e.preventDefault();
              goToPrevPage();
            }
          });
        }
      } catch (error) {
        console.error('Error applying theme in recreateRendition:', error);
      }
    });

    // Track location changes
    rendition.on('relocated', (location: any) => {
      setCurrentCFI(location.start.cfi);

      // Update progress
      if (location.start.percentage !== undefined) {
        setProgress(Math.round(location.start.percentage * 100));
      }

      // Update page numbers (current page and total)
      if (location.start.displayed) {
        const currentPageNum = location.start.displayed.page || 0;
        const totalPagesNum = location.start.displayed.total || 0;

        setCurrentPage(currentPageNum);
        setCurrentPageStore(currentPageNum);

        // Set total pages every time to ensure it's always updated
        if (totalPagesNum > 0) {
          setTotalPagesCount(totalPagesNum);
          setTotalPages(totalPagesNum);
        }
      }
    });

    // Display at saved position or start
    try {
      if (currentCfi) {
        await rendition.display(currentCfi);
      } else {
        await rendition.display();
      }
    } catch (error) {
      console.error('Error displaying after recreation:', error);
      await rendition.display();
    }
  }, [flowMode, spread, theme, fontSize, setCurrentCFI, setTotalPages]);

  // Load EPUB
  useEffect(() => {
    if (!currentEbook || !containerRef.current) {
      console.log('EPUBReader: Missing currentEbook or container');
      return;
    }

    let cancelled = false;

    const loadEPUB = async () => {
      try {
        setIsRendering(true);
        console.log('EPUBReader: Loading EPUB file:', currentEbook.file_path);

        // Read file as ArrayBuffer
        const { invoke } = await import('@tauri-apps/api/core');
        const fileData = await invoke<number[]>('read_file_binary', {
          filePath: currentEbook.file_path,
        });
        if (cancelled) return;

        const arrayBuffer = new Uint8Array(fileData).buffer;
        console.log('EPUBReader: File loaded, size:', arrayBuffer.byteLength, 'bytes');

        // Create book from ArrayBuffer
        const book = ePub(arrayBuffer);
        if (cancelled) return;
        bookRef.current = book;
        console.log('EPUBReader: Book instance created');

        // Wait for book to be ready
        await book.ready;
        if (cancelled) return;
        console.log('EPUBReader: Book is ready');

        // Load table of contents
        const navigation = await book.loaded.navigation;
        if (navigation && navigation.toc) {
          setToc(navigation.toc);
        }

        // Create rendition with proper configuration
        const rendition = book.renderTo(containerRef.current!, {
          width: '100%',
          height: '100%',
          flow: flowMode,
          spread: spread,
          minSpreadWidth: 800,
          allowScriptedContent: true,
        } as any);

        if (cancelled) return;
        renditionRef.current = rendition;
        console.log('EPUBReader: Rendition created');

        // Apply theme immediately using CSS injection via content hook
        const themeConfig = getThemeStyles(theme, fontSize);

        // Use content hook to apply theme BEFORE the page is rendered
        rendition.hooks.content.register((contents: any) => {
          try {
            console.log('Content hook: Applying theme to new page');

            if (contents.document) {
              // Remove old style if exists
              const oldStyle = contents.document.getElementById('custom-reader-theme');
              if (oldStyle) oldStyle.remove();

              // Inject theme CSS immediately
              const styleEl = contents.document.createElement('style');
              styleEl.id = 'custom-reader-theme';
              styleEl.textContent = themeConfig.css;
              contents.document.head.appendChild(styleEl);

              // Add click listener to close sidebars when clicking on content
              contents.document.addEventListener('click', () => {
                setShowSettings(false);
                setShowTOC(false);
              });

              // Add keyboard navigation inside iframe
              contents.document.addEventListener('keydown', (e: KeyboardEvent) => {
                if (showSettings || showTOC) return;

                if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                  e.preventDefault();
                  goToNextPage();
                } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                  e.preventDefault();
                  goToPrevPage();
                }
              });

              console.log('Theme CSS injected into page');
            }
          } catch (error) {
            console.error('Error applying theme in content hook:', error);
          }
        });

        // Track location changes
        rendition.on('relocated', (location: any) => {
          console.log('EPUBReader: Location changed');
          setCurrentCFI(location.start.cfi);

          // Update progress
          if (location.start.percentage !== undefined) {
            setProgress(Math.round(location.start.percentage * 100));
          }

          // Update current page from location
          if (location.start.displayed) {
            const currentPageNum = location.start.displayed.page || 0;
            setCurrentPage(currentPageNum);
            setCurrentPageStore(currentPageNum);
            console.log('Current page:', currentPageNum);
          }

          // Get actual total pages from generated locations
          if (book.locations && book.locations.total > 0) {
            const totalPagesNum = book.locations.total;
            setTotalPagesCount(totalPagesNum);
            setTotalPages(totalPagesNum);
            console.log('Total pages set to:', totalPagesNum);
          }
        });

        // Display book
        console.log('EPUBReader: Displaying book');
        try {
          if (currentCFI) {
            await rendition.display(currentCFI);
          } else {
            await rendition.display();
          }
          if (cancelled) return;
          console.log('EPUBReader: Book displayed successfully');
          setIsRendering(false);
        } catch (displayError) {
          console.error('Error displaying book:', displayError);
          if (cancelled) return;
          // Fallback
          try {
            await rendition.display();
            if (cancelled) return;
            console.log('EPUBReader: Book displayed (fallback)');
            setIsRendering(false);
          } catch (fallbackError) {
            console.error('EPUBReader: Fallback display failed:', fallbackError);
            if (!cancelled) {
              setIsRendering(false);
            }
          }
        }

        // Generate locations in background (for better progress tracking)
        console.log('EPUBReader: Generating locations...');
        book.locations.generate(1024).then(() => {
          if (cancelled) return;
          console.log('EPUBReader: Locations generated');

          // Set total pages from generated locations
          if (book.locations && book.locations.total > 0) {
            const totalPagesNum = book.locations.total;
            setTotalPagesCount(totalPagesNum);
            setTotalPages(totalPagesNum);
            console.log('Total pages set from locations:', totalPagesNum);
          }
        }).catch((err: any) => {
          if (!cancelled) {
            console.error('Failed to generate locations:', err);
          }
        });
      } catch (error) {
        if (!cancelled) {
          console.error('EPUBReader: Error loading EPUB:', error);
          setIsRendering(false);
        }
      }
    };

    loadEPUB();

    return () => {
      cancelled = true;
      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, [currentEbook?.id]);


  // Handle flow mode change (paginated vs scrolled)
  const handleFlowModeChange = useCallback((newMode: 'paginated' | 'scrolled') => {
    setFlowMode(newMode);
    updateSettings({ flow_mode: newMode });
    recreateRendition(newMode, spread);
  }, [spread, recreateRendition, updateSettings]);

  // Handle spread change (single vs two pages)
  const handleSpreadChange = useCallback((newSpread: 'none' | 'auto') => {
    setSpread(newSpread);
    recreateRendition(flowMode, newSpread);
  }, [flowMode, recreateRendition]);

  const getBackgroundColor = () => {
    switch (theme) {
      case 'light': return '#ffffff';
      case 'sepia': return '#f5f5dc';
      default: return '#1f2937';
    }
  };

  const getTOCStyles = () => {
    switch (theme) {
      case 'light':
        return {
          bg: 'bg-gradient-to-br from-gray-50 via-white to-gray-50',
          border: 'border-gray-300',
          headerBg: 'bg-gradient-to-r from-gray-100/50 to-gray-50/50',
          text: 'text-gray-900',
          textSecondary: 'text-gray-600',
          buttonBg: 'bg-gray-200/30 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-purple-500/10',
          buttonHoverBorder: 'hover:border-blue-500/30',
          buttonText: 'text-gray-700 hover:text-gray-900',
          closeBtn: 'bg-gray-200/50 hover:bg-gray-300 text-gray-700 hover:text-gray-900',
        };
      case 'sepia':
        return {
          bg: 'bg-gradient-to-br from-[#e8dcc4] via-[#f5f5dc] to-[#e8dcc4]',
          border: 'border-[#d4c4a8]',
          headerBg: 'bg-gradient-to-r from-[#d4c4a8]/50 to-[#e8dcc4]/50',
          text: 'text-[#5c4a3a]',
          textSecondary: 'text-[#7d6b57]',
          buttonBg: 'bg-[#d4c4a8]/30 hover:bg-gradient-to-r hover:from-[#b8a88c]/20 hover:to-[#a8947c]/20',
          buttonHoverBorder: 'hover:border-[#b8a88c]/50',
          buttonText: 'text-[#5c4a3a] hover:text-[#4a3828]',
          closeBtn: 'bg-[#d4c4a8]/50 hover:bg-[#c4b498] text-[#5c4a3a] hover:text-[#4a3828]',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
          border: 'border-gray-700/50',
          headerBg: 'bg-gradient-to-r from-gray-800/50 to-gray-900/50',
          text: 'text-white',
          textSecondary: 'text-gray-300',
          buttonBg: 'bg-gray-800/30 hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-purple-500/20',
          buttonHoverBorder: 'hover:border-blue-500/30',
          buttonText: 'text-gray-300 hover:text-white',
          closeBtn: 'bg-gray-800/50 hover:bg-gray-700 text-gray-400 hover:text-white',
        };
    }
  };

  const getSettingsStyles = () => {
    switch (theme) {
      case 'light':
        return {
          bg: 'bg-white',
          text: 'text-gray-900',
          textSecondary: 'text-gray-600',
          label: 'text-gray-700',
          buttonBg: 'bg-gray-200 hover:bg-gray-300',
          buttonText: 'text-gray-700',
          closeBtn: 'hover:bg-gray-200 text-gray-600 hover:text-gray-900',
          inputBg: 'bg-gray-100',
        };
      case 'sepia':
        return {
          bg: 'bg-[#f4ecd8]',
          text: 'text-[#5c4a3a]',
          textSecondary: 'text-[#7d6b57]',
          label: 'text-[#5c4a3a]',
          buttonBg: 'bg-[#d4c4a8] hover:bg-[#c4b498]',
          buttonText: 'text-[#5c4a3a]',
          closeBtn: 'hover:bg-[#d4c4a8] text-[#7d6b57] hover:text-[#5c4a3a]',
          inputBg: 'bg-[#e8dcc4]',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gray-800',
          text: 'text-white',
          textSecondary: 'text-gray-400',
          label: 'text-gray-300',
          buttonBg: 'bg-gray-700 hover:bg-gray-600',
          buttonText: 'text-white',
          closeBtn: 'hover:bg-gray-700 text-gray-400 hover:text-white',
          inputBg: 'bg-gray-700',
        };
    }
  };

  return (
    <div
      ref={mainContainerRef}
      tabIndex={0}
      className="relative h-full w-full outline-none"
      style={{ backgroundColor: getBackgroundColor() }}
      onMouseMove={handleMouseMove}
      onClick={(e) => {
        const target = e.target as HTMLElement;

        // Don't close if clicking on sidebars or their buttons
        const isClickOnSidebar = target.closest('.settings-panel, .toc-panel');
        const isClickOnTopBar = target.closest('.top-bar-controls');

        if (isClickOnSidebar || isClickOnTopBar) {
          mainContainerRef.current?.focus();
          return;
        }

        // Close sidebars when clicking anywhere else (reading area, nav areas, etc)
        if (showSettings || showTOC) {
          setShowSettings(false);
          setShowTOC(false);
        }

        mainContainerRef.current?.focus();
      }}
    >
      {/* Top Bar */}
      <div className={`top-bar-controls absolute top-0 left-0 right-0 z-20 transition-opacity duration-300 ${isRendering || !showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent" data-tauri-drag-region>
          {/* Left side - Reader controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTOC(!showTOC)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Table of Contents"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Center - Book title */}
          <div className="flex-1 mx-4 text-center" data-tauri-drag-region>
            <h1 className="text-white text-lg font-medium truncate">{currentEbook?.title}</h1>
            {currentEbook?.author && (
              <p className="text-white/70 text-sm truncate">{currentEbook.author}</p>
            )}
          </div>

          {/* Right side - Window controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                const window = getCurrentWindow();
                await window.minimize();
              }}
              className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
              title="Minimize"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              onClick={async () => {
                const window = getCurrentWindow();
                const isMaximized = await window.isMaximized();
                if (isMaximized) {
                  await window.unmaximize();
                } else {
                  await window.maximize();
                }
              }}
              className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
              title="Maximize"
            >
              <Square className="w-5 h-5" />
            </button>
            <button
              onClick={async () => {
                const window = getCurrentWindow();
                await window.close();
              }}
              className="p-2 rounded-lg hover:bg-red-600/90 text-white transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading Spinner */}
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
            <p className="mt-4 text-gray-300">Loading book...</p>
          </div>
        </div>
      )}

      {/* EPUB Container */}
      <div
        ref={containerRef}
        className="epub-container h-full w-full"
        style={{ backgroundColor: getBackgroundColor() }}
      />

      {/* Navigation Areas */}
      {!isRendering && (
        <>
          <div
            onClick={goToPrevPage}
            className="absolute left-0 top-0 bottom-0 w-1/4 cursor-pointer hover:bg-black/5 transition-colors z-10"
            title="Previous page"
          />
          <div
            onClick={goToNextPage}
            className="absolute right-0 top-0 bottom-0 w-1/4 cursor-pointer hover:bg-black/5 transition-colors z-10"
            title="Next page"
          />
        </>
      )}

      {/* Bottom Progress Bar */}
      {!isRendering && (
        <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${!showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="p-4 bg-gradient-to-t from-black/50 to-transparent">
            <div className="flex items-center gap-4">
              <button
                onClick={goToPrevPage}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex-1">
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-white/70">
                  <span>{progress}%</span>
                  {totalPagesCount > 0 && (
                    <span>Page {currentPage} of {totalPagesCount}</span>
                  )}
                </div>
              </div>

              <button
                onClick={goToNextPage}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className={`settings-panel absolute inset-y-0 right-0 w-80 ${getSettingsStyles().bg} shadow-2xl z-30 overflow-y-auto`}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-semibold ${getSettingsStyles().text}`}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className={`p-1 rounded-lg ${getSettingsStyles().closeBtn} transition-colors`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Font Size */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className={`text-sm font-medium ${getSettingsStyles().label} flex items-center gap-2`}>
                  <Type className="w-4 h-4" />
                  Font Size
                </label>
                <span className={`text-sm ${getSettingsStyles().textSecondary}`}>{fontSize}px</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                  className={`p-2 rounded-lg ${getSettingsStyles().buttonBg} ${getSettingsStyles().buttonText} transition-colors`}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="12"
                  max="32"
                  step="2"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1"
                />
                <button
                  onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                  className={`p-2 rounded-lg ${getSettingsStyles().buttonBg} ${getSettingsStyles().buttonText} transition-colors`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="mb-6">
              <label className={`text-sm font-medium ${getSettingsStyles().label} mb-3 flex items-center gap-2`}>
                <Sun className="w-4 h-4" />
                Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    theme === 'light'
                      ? 'border-blue-500 bg-white text-gray-900'
                      : 'border-gray-600 bg-white text-gray-900 hover:border-gray-500'
                  }`}
                >
                  <Sun className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs">Light</div>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-gray-900 text-white'
                      : 'border-gray-600 bg-gray-900 text-white hover:border-gray-500'
                  }`}
                >
                  <Moon className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs">Dark</div>
                </button>
                <button
                  onClick={() => setTheme('sepia')}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    theme === 'sepia'
                      ? 'border-blue-500 bg-[#f5f5dc] text-[#5c4a3a]'
                      : 'border-gray-600 bg-[#f5f5dc] text-[#5c4a3a] hover:border-gray-500'
                  }`}
                >
                  <BookOpen className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs">Sepia</div>
                </button>
              </div>
            </div>

            {/* Spread Mode */}
            <div className="mb-6">
              <label className={`text-sm font-medium ${getSettingsStyles().label} mb-3 flex items-center gap-2`}>
                <Columns className="w-4 h-4" />
                Page Layout
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSpreadChange('none')}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    spread === 'none'
                      ? `border-blue-500 ${getSettingsStyles().inputBg} ${getSettingsStyles().text}`
                      : `border-gray-600 ${getSettingsStyles().inputBg} ${getSettingsStyles().textSecondary} hover:border-gray-500`
                  }`}
                >
                  <div className="text-sm">Single Page</div>
                </button>
                <button
                  onClick={() => handleSpreadChange('auto')}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    spread === 'auto'
                      ? `border-blue-500 ${getSettingsStyles().inputBg} ${getSettingsStyles().text}`
                      : `border-gray-600 ${getSettingsStyles().inputBg} ${getSettingsStyles().textSecondary} hover:border-gray-500`
                  }`}
                >
                  <div className="text-sm">Two Pages</div>
                </button>
              </div>
            </div>

            {/* Flow Mode */}
            <div className="mb-6">
              <label className={`text-sm font-medium ${getSettingsStyles().label} mb-3`}>Reading Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleFlowModeChange('paginated')}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    flowMode === 'paginated'
                      ? `border-blue-500 ${getSettingsStyles().inputBg} ${getSettingsStyles().text}`
                      : `border-gray-600 ${getSettingsStyles().inputBg} ${getSettingsStyles().textSecondary} hover:border-gray-500`
                  }`}
                >
                  <div className="text-sm">Paginated</div>
                </button>
                <button
                  onClick={() => handleFlowModeChange('scrolled')}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    flowMode === 'scrolled'
                      ? `border-blue-500 ${getSettingsStyles().inputBg} ${getSettingsStyles().text}`
                      : `border-gray-600 ${getSettingsStyles().inputBg} ${getSettingsStyles().textSecondary} hover:border-gray-500`
                  }`}
                >
                  <div className="text-sm">Scrolled</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table of Contents */}
      {showTOC && (
        <div className={`toc-panel absolute inset-y-0 left-0 w-72 ${getTOCStyles().bg} shadow-2xl z-30 flex flex-col border-r ${getTOCStyles().border}`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-4 border-b ${getTOCStyles().border} ${getTOCStyles().headerBg} backdrop-blur-sm flex-shrink-0`}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <BookOpen className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className={`text-base font-semibold ${getTOCStyles().text}`}>Contents</h2>
            </div>
            <button
              onClick={() => setShowTOC(false)}
              className={`p-1.5 rounded-lg border ${getTOCStyles().border} ${getTOCStyles().closeBtn} transition-all`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* TOC List */}
          <div className="flex-1 overflow-y-auto p-3">
            {toc.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-64 ${getTOCStyles().textSecondary}`}>
                <BookOpen className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-xs">No table of contents available</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {toc.map((item, index) => {
                  // Calculate nesting level from item properties or subitems
                  const level = item.subitems ? 0 : (item.parent ? 1 : 0);

                  return (
                    <React.Fragment key={index}>
                      <button
                        onClick={() => goToLocation(item.href)}
                        className={`group w-full text-left p-2 rounded-md ${getTOCStyles().buttonBg} border border-transparent ${getTOCStyles().buttonHoverBorder} ${getTOCStyles().buttonText} transition-all`}
                        style={{ paddingLeft: `${8 + level * 12}px` }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-blue-400 group-hover:bg-blue-300 transition-colors flex-shrink-0" />
                          <span className="text-xs leading-relaxed">{item.label}</span>
                        </div>
                      </button>

                      {/* Render subitems if they exist */}
                      {item.subitems && item.subitems.map((subitem: any, subIndex: number) => (
                        <button
                          key={`${index}-${subIndex}`}
                          onClick={() => goToLocation(subitem.href)}
                          className={`group w-full text-left p-2 rounded-md ${getTOCStyles().buttonBg} border border-transparent ${getTOCStyles().buttonHoverBorder} ${getTOCStyles().textSecondary} hover:${getTOCStyles().text} transition-all ml-3`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-0.5 h-0.5 rounded-full bg-gray-400 group-hover:bg-blue-400 transition-colors flex-shrink-0" />
                            <span className="text-[11px] leading-relaxed">{subitem.label}</span>
                          </div>
                        </button>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with book info */}
          <div className={`p-4 border-t ${getTOCStyles().border} ${getTOCStyles().headerBg} backdrop-blur-sm flex-shrink-0`}>
            <div className={`text-xs ${getTOCStyles().textSecondary}`}>
              <div className="flex items-center justify-between">
                <span>{toc.length} chapter{toc.length !== 1 ? 's' : ''}</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
