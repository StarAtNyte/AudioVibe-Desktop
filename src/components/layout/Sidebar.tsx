import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpenIcon,
  PlayIcon,
  Cog6ToothIcon,
  HomeIcon,
  FolderIcon,
  PlusCircleIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { NavigationItem } from '../../types';
import clsx from 'clsx';

interface SidebarProps {
  collapsed: boolean;
  className?: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/home',
    icon: ({ className }) => <HomeIcon className={className} />,
  },
  {
    id: 'library',
    label: 'Library',
    path: '/library',
    icon: ({ className }) => <BookOpenIcon className={className} />,
  },
  {
    id: 'ebooks',
    label: 'Ebooks',
    path: '/ebooks',
    icon: ({ className }) => <DocumentTextIcon className={className} />,
  },
  {
    id: 'player',
    label: 'Now Playing',
    path: '/player',
    icon: ({ className }) => <PlayIcon className={className} />,
  },
  {
    id: 'collections',
    label: 'Collections',
    path: '/collections',
    icon: ({ className }) => <FolderIcon className={className} />,
  },
  {
    id: 'downloads',
    label: 'Downloads',
    path: '/downloads',
    icon: ({ className }) => <ArrowDownTrayIcon className={className} />,
  },
];

const secondaryItems: NavigationItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: ({ className }) => <Cog6ToothIcon className={className} />,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, className }) => {
  return (
    <aside 
      className={clsx(
        'bg-white/90 dark:bg-surface-900/95 backdrop-blur-xl border-r border-white/20 dark:border-surface-800/50',
        'flex flex-col h-full transition-all duration-300 ease-in-out',
        'fixed top-0 left-0 z-40 shadow-glass-lg',
        collapsed ? 'w-20' : 'w-72',
        className
      )}
    >
      {/* Enhanced Logo Section */}
      <div className={clsx(
        'flex items-center h-20 px-6 border-b border-white/10 dark:border-surface-800/30',
        collapsed && 'justify-center px-4'
      )}>
        {!collapsed && (
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary-500 via-accent-emerald-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-xl">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                AudioVibe
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Your Audio Library
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-10 h-10 bg-gradient-to-r from-primary-500 via-accent-emerald-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300">
            <span className="text-white font-bold text-lg">A</span>
          </div>
        )}
      </div>

      {/* Enhanced Navigation */}
      <nav className="flex-1 p-4 space-y-6">
        {/* Main Navigation */}
        <div className="space-y-2">
          {navigationItems.map((item, index) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => clsx(
                'group relative flex items-center transition-all duration-300 ease-in-out',
                collapsed ? 'justify-center p-3' : 'px-4 py-3',
                'rounded-2xl border border-transparent',
                isActive 
                  ? 'bg-gradient-to-r from-primary-500/10 via-accent-emerald-500/10 to-primary-500/10 border-primary-200/30 dark:border-primary-700/30 text-primary-700 dark:text-primary-300 shadow-lg backdrop-blur-sm' 
                  : 'hover:bg-white/40 dark:hover:bg-surface-800/40 hover:border-white/20 dark:hover:border-surface-700/30 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:shadow-lg',
                'transform hover:scale-105 active:scale-95'
              )}
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <div className={clsx(
                    'flex items-center justify-center w-6 h-6 transition-all duration-300',
                    isActive ? 'text-primary-600 dark:text-primary-400' : 'group-hover:text-gray-900 dark:group-hover:text-white'
                  )}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  
                  {!collapsed && (
                    <div className="ml-4 flex-1">
                      <span className="font-semibold text-sm tracking-wide">{item.label}</span>
                    </div>
                  )}
                  
                  {/* Glow effect for active item */}
                  {isActive && (
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary-500/20 to-accent-emerald-500/20 rounded-2xl blur opacity-50 animate-pulse" />
                  )}
                  
                  {/* Enhanced Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="absolute left-16 px-3 py-2 bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 text-sm font-medium rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 shadow-xl backdrop-blur-sm border border-white/10 dark:border-gray-700/30">
                      {item.label}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900/90 dark:bg-white/90 rotate-45" />
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Enhanced Quick Actions */}
        {!collapsed && (
          <div className="pt-4">
            <button className="w-full flex items-center px-4 py-3 rounded-2xl bg-gradient-to-r from-accent-emerald-500 to-primary-500 hover:from-accent-emerald-600 hover:to-primary-600 text-white font-semibold text-sm shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300 group">
              <PlusCircleIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              <span className="ml-4">Add Audiobook</span>
              <div className="ml-auto">
                <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse" />
              </div>
            </button>
          </div>
        )}

        {/* Floating Add Button for collapsed state */}
        {collapsed && (
          <div className="flex justify-center">
            <button className="w-12 h-12 bg-gradient-to-r from-accent-emerald-500 to-primary-500 hover:from-accent-emerald-600 hover:to-primary-600 text-white rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-110 active:scale-95 transition-all duration-300 group relative">
              <PlusCircleIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              <div className="absolute left-16 px-3 py-2 bg-gray-900/90 text-white text-sm font-medium rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 shadow-xl backdrop-blur-sm">
                Add Audiobook
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900/90 rotate-45" />
              </div>
            </button>
          </div>
        )}
      </nav>

      {/* Enhanced Bottom Section */}
      <div className="p-4 border-t border-white/10 dark:border-surface-800/30">
        {secondaryItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => clsx(
              'group relative flex items-center transition-all duration-300 ease-in-out',
              collapsed ? 'justify-center p-3' : 'px-4 py-3',
              'rounded-2xl border border-transparent',
              isActive 
                ? 'bg-gradient-to-r from-accent-amber-500/10 to-accent-rose-500/10 border-accent-amber-200/30 dark:border-accent-amber-700/30 text-accent-amber-700 dark:text-accent-amber-300 shadow-lg' 
                : 'hover:bg-white/40 dark:hover:bg-surface-800/40 hover:border-white/20 dark:hover:border-surface-700/30 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:shadow-lg',
              'transform hover:scale-105 active:scale-95'
            )}
            title={collapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                <div className={clsx(
                  'flex items-center justify-center w-6 h-6 transition-all duration-300',
                  isActive ? 'text-accent-amber-600 dark:text-accent-amber-400' : 'group-hover:text-gray-900 dark:group-hover:text-white'
                )}>
                  <item.icon className="w-6 h-6" />
                </div>
                
                {!collapsed && (
                  <div className="ml-4 flex-1">
                    <span className="font-semibold text-sm tracking-wide">{item.label}</span>
                  </div>
                )}
                
                {/* Enhanced Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-16 px-3 py-2 bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 text-sm font-medium rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 shadow-xl backdrop-blur-sm border border-white/10 dark:border-gray-700/30">
                    {item.label}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900/90 dark:bg-white/90 rotate-45" />
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </aside>
  );
};