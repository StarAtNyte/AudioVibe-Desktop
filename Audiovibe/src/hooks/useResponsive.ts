import { useEffect } from 'react';
import { useAppStore } from '../store';

export const useResponsive = () => {
  const { isMobile, isTablet, setIsMobile, setIsTablet, setLeftSidebarOpen, setRightPanelOpen } = useAppStore();

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      
      // Define breakpoints
      const mobile = width < 768; // sm
      const tablet = width >= 768 && width < 1024; // md
      const smallDesktop = width >= 1024 && width < 1280; // lg
      const desktop = width >= 1280; // xl
      
      // Update mobile/tablet state
      setIsMobile(mobile);
      setIsTablet(tablet);
      
      // Auto-close panels on smaller screens
      if (mobile) {
        setLeftSidebarOpen(false);
        setRightPanelOpen(false);
      } else if (tablet) {
        setLeftSidebarOpen(true);
        setRightPanelOpen(false);
      } else if (smallDesktop) {
        setLeftSidebarOpen(true);
        setRightPanelOpen(false);
      } else if (desktop) {
        setLeftSidebarOpen(true);
        setRightPanelOpen(true);
      }
    };

    // Check on mount with slight delay to ensure DOM is ready
    setTimeout(checkScreenSize, 100);

    // Listen for resize events
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, [setIsMobile, setIsTablet, setLeftSidebarOpen, setRightPanelOpen]);

  return {
    isMobile,
    isTablet,
    isSmallDesktop: !isMobile && !isTablet, // For screens between 1024px and 1280px
    isDesktop: !isMobile && !isTablet && window.innerWidth >= 1280
  };
};