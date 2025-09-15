import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  HomeIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  Cog6ToothIcon,
  BellIcon,
  BookOpenIcon,
  MinusIcon,
  Square2StackIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  Bars3Icon
} from '@heroicons/react/24/outline';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store';
import { useResponsive } from '../../hooks/useResponsive';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { leftSidebarOpen, setLeftSidebarOpen } = useAppStore();
  const { isMobile, isTablet, isSmallDesktop } = useResponsive();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('TopBar search submitted:', searchQuery);
    if (searchQuery.trim()) {
      const encodedQuery = encodeURIComponent(searchQuery);
      const url = `/search?q=${encodedQuery}`;
      console.log('Navigating to:', url);
      navigate(url);
    } else {
      console.log('Empty search query, not navigating');
    }
  };

  const goBack = () => {
    window.history.back();
  };

  const goForward = () => {
    window.history.forward();
  };

  const minimizeWindow = async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  };

  const maximizeWindow = async () => {
    try {
      await invoke('maximize_window');
    } catch (error) {
      console.error('Failed to maximize window:', error);
    }
  };

  const closeWindow = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-50 via-gray-100 to-slate-50 dark:from-slate-900 dark:via-gray-800 dark:to-slate-900 border-b border-gray-200/50 dark:border-gray-600/50 backdrop-blur-md">
      <div className="flex items-center px-4 py-1 h-14 bg-white/10 dark:bg-black/10 backdrop-blur-sm" data-tauri-drag-region>
        {/* Left Section - Logo, Mobile Menu, and Navigation */}
        <div className="flex items-center space-x-2">
          {/* Mobile Menu Button */}
          {(isMobile || isTablet) && (
            <button
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/30 dark:hover:bg-gray-700/30 rounded-full transition-all duration-200"
              title="Toggle Menu"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
          )}
          
          {/* Logo */}
          <div className="flex items-center">
            <img 
              src="/logo.png" 
              alt="AudioVibe" 
              className={`${isMobile ? 'w-10 h-10' : 'w-14 h-14'}`}
            />
          </div>

          {/* Navigation Arrows - Hidden on mobile */}
          {!isMobile && (
            <div className="flex items-center space-x-1">
              <button
                onClick={goBack}
                className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                title="Go back"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={goForward}
                className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                title="Go forward"
              >
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Center Section - Responsive Search and Navigation */}
        <div className={`
          ${isMobile 
            ? 'flex-1 mx-3' 
            : 'absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-2'
          }
        `} style={isMobile ? {} : { width: isTablet ? '300px' : isSmallDesktop ? '400px' : '500px' }}>
          
          {!isMobile && (
            <button
              onClick={() => navigate('/')}
              className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              title="Home"
            >
              <HomeIcon className="w-5 h-5" />
            </button>
          )}

          {/* Search Bar - Responsive sizing */}
          <div className={`${isMobile ? 'w-full' : 'flex-1 min-w-0'}`}>
            <form onSubmit={handleSearch} className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={isMobile ? "Search..." : "What do you want to listen to?"}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`
                  w-full pl-10 pr-4 
                  ${isMobile ? 'py-2' : 'py-3'} 
                  bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full 
                  text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 
                  ${isMobile ? 'text-sm' : 'text-sm'} 
                  focus:outline-none focus:border-green-500 focus:bg-gray-50 dark:focus:bg-gray-700 
                  transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-700
                `}
              />
            </form>
          </div>

          {!isMobile && (
            <button
              onClick={() => navigate('/library')}
              className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              title="Your Library"
            >
              <BookOpenIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Right Section - Responsive App Icons and Window Controls */}
        <div className="flex items-center ml-auto">
          {/* App Icons - Reduced on mobile */}
          <div className={`flex items-center ${isMobile ? 'space-x-0' : 'space-x-1'} mr-2`}>
            {/* Settings - Always visible */}
            <button
              onClick={() => navigate('/settings')}
              className="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/30 dark:hover:bg-gray-700/30 rounded-full transition-all duration-200"
              title="Settings"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </button>

            {/* Downloads - Hidden on mobile to save space */}
            {!isMobile && (
              <button
                onClick={() => navigate('/downloads')}
                className="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/30 dark:hover:bg-gray-700/30 rounded-full transition-all duration-200"
                title="Downloads"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
            )}

          </div>

          {/* Window Controls - Moved to the very end */}
          <div className="flex items-center ml-2">
            {/* Minimize */}
            <button
              onClick={minimizeWindow}
              className="w-10 h-6 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300/50 dark:hover:bg-gray-600/50 transition-colors rounded-sm"
              title="Minimize"
            >
              <MinusIcon className="w-4 h-4" />
            </button>

            {/* Maximize */}
            <button
              onClick={maximizeWindow}
              className="w-10 h-6 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-300/50 dark:hover:bg-gray-600/50 transition-colors rounded-sm"
              title="Maximize"
            >
              <Square2StackIcon className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={closeWindow}
              className="w-10 h-6 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-white hover:bg-red-600/80 transition-colors rounded-sm"
              title="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};