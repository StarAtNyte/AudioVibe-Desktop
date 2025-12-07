# AudioVibe Desktop
<img width="1918" height="1017" alt="Screenshot 2025-09-15 233936" src="https://github.com/user-attachments/assets/9e335228-737f-41d4-a8ca-289d0d7527be" />

https://youtu.be/f0MmAFeqGqI

AudioVibe is a cross-platform desktop application for playing and managing audiobooks and reading ebooks. Built with Rust and Tauri for optimal performance, it provides a modern interface for organizing audiobook libraries, reading ebooks, and playing content from local files and online sources.

## 🎯 Project Overview

AudioVibe Desktop is a comprehensive audiobook management and playback solution featuring local library management, ebook reader with multi-window support, text-to-speech generation, and integration with free audiobook sources like LibriVox.

## Technology Stack

- **Backend**: Rust with Tauri framework
- **Frontend**: React 19 with TypeScript
- **Styling**: Tailwind CSS v3
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library
- **Database**: SQLite with SQLx
- **Audio Engine**: Rodio + Symphonia
- **Ebook Rendering**: ePub.js for EPUB, PDF.js for PDF

## Development Setup

### Prerequisites

- Node.js (v18 or later)
- Rust (latest stable)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Install Rust dependencies:
   ```bash
   cd src-tauri
   cargo check
   ```

### Development Commands

- **Start development server**: `npm run tauri:dev`
- **Build for production**: `npm run tauri:build`
- **Run tests**: `npm test`
- **Run Rust tests**: `cd src-tauri && cargo test`
- **Type checking**: `npm run type-check`
- **Linting**: `npm run lint`

### Project Structure

```
audiovibe-desktop/
├── src/                    # React frontend source
│   ├── components/         # React components
│   │   ├── ebooks/         # Ebook library components
│   │   ├── reader/         # EPUB/PDF reader components
│   │   ├── library/        # Audiobook library components
│   │   └── player/         # Audio player components
│   ├── data/               # Static data
│   ├── pages/              # Application pages
│   ├── services/           # API services
│   ├── store/              # Zustand state management
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── src-tauri/              # Rust backend source
│   ├── src/
│   │   ├── audio/          # Audio engine module
│   │   ├── database/       # Database operations
│   │   ├── download/       # Download management
│   │   ├── ebook/          # Ebook processing module
│   │   ├── filesystem/     # File operations
│   │   ├── models/         # Data models
│   │   └── services/       # External services
│   ├── capabilities/       # Tauri window capabilities
│   └── Cargo.toml          # Rust dependencies
└── package.json            # Node.js dependencies
```

## Current Features

### Ebook Reader
- 📖 **Multi-format Support**: Read EPUB and PDF files
- 🪟 **Multi-window**: Open multiple books simultaneously in separate windows
- 🎨 **Reading Modes**:
  - Paginated and scrolled reading modes
  - Single page and two-page spread layouts
  - Dark, light, and sepia themes
- ⚙️ **Customization**:
  - Adjustable font size
  - Auto-hiding controls (Readest-style)
  - Table of contents navigation
  - Progress bar with page numbers
- 📑 **Reading Progress**: Track current page and total pages
- ⌨️ **Keyboard Navigation**: Arrow keys for page turning
- 🖱️ **Window Controls**: Custom minimize, maximize, and close buttons

### Audio Playback
- 🎵 Audio playback with WAV, MP3 format support
- ⏯️ Basic playback controls (play, pause, seek)
- 📖 Chapter navigation for multi-file audiobooks
- 🔄 Progress tracking and resume functionality

### Library Management
- 📚 Local audiobook library with SQLite database
- 📕 Ebook library with metadata storage
- 📁 File system scanning for audiobook directories
- 📋 Metadata display (title, author, duration)
- 🗂️ Collections for organizing audiobooks

### Content Sources
- 🔍 LibriVox browser for free public domain audiobooks
- 📁 Local file import from directories
- 📄 Document import (text files)
- 📚 EPUB and PDF import for ebooks

### Text-to-Speech
- 🤖 TTS audiobook generation from text documents
- 📝 Chapter-based TTS processing
- 🎧 Generated audiobook playback

### User Interface
- 🎨 React-based modern interface
- 📱 Responsive design
- 🌙 Basic theming support
- 🔍 Search functionality
- 🪟 Multi-window support for reading multiple books

### Technical Implementation
This project showcases modern desktop application development:
- Full-stack application architecture with Rust and React
- Cross-platform desktop application with Tauri
- Modern React frontend with TypeScript
- SQLite database integration with SQLx
- Custom audio engine implementation

## 🚀 Getting Started

### Building the Application

1. **Development Mode**:
   ```bash
   npm run tauri dev
   ```

2. **Production Build**:
   ```bash
   npm run tauri build
   ```

3. **Frontend Only** (for UI development):
   ```bash
   npm run dev
   ```

### Usage

1. **Adding Audiobooks**: Use the "+" button to import local audiobook folders
2. **Reading Ebooks**: Import EPUB/PDF files and open them in separate reader windows
3. **TTS Generation**: Import text documents and convert them to audiobooks
4. **LibriVox Browse**: Explore free public domain audiobooks
5. **Playback**: Click any audiobook to start listening with chapter navigation

### Ebook Reader Features

The integrated ebook reader provides a Readest-inspired reading experience:

- **Multi-window Support**: Each ebook opens in its own window, allowing you to browse your library while reading
- **Reading Customization**:
  - Switch between paginated and scrolled modes
  - Toggle between single-page and two-page spread layouts
  - Choose from dark, light, and sepia themes
  - Adjust font size for comfortable reading
- **Navigation**: Use arrow keys or click to turn pages, access table of contents
- **Auto-hiding Interface**: Controls fade away while reading and appear on mouse movement
- **Progress Tracking**: Visual progress bar with current page and total page count

## 🔧 Architecture

### Backend (Rust/Tauri)
- **Audio Engine**: Built with Rodio for cross-platform audio playback
- **Database**: SQLite with SQLx for audiobook and ebook metadata and progress tracking
- **File System**: Handles local file scanning and organization
- **TTS Integration**: Text-to-speech processing for document conversion
- **Ebook Processing**: EPUB and PDF metadata extraction and file handling

### Frontend (React/TypeScript)
- **State Management**: Zustand for audio, library, and reader state
- **UI Components**: Modern component architecture with Tailwind CSS
- **Audio Controls**: Real-time playback controls and progress tracking
- **Ebook Reader**: ePub.js and PDF.js integration for ebook rendering
- **Multi-window**: Tauri WebviewWindow API for separate reader windows
- **Responsive Design**: Optimized for desktop usage

## 💡 Key Technical Features

### Advanced Audio Processing
- Multi-format audio support with efficient decoding
- Real-time playback controls with smooth seeking
- Chapter-based navigation and progress tracking
- Cross-platform audio engine optimization

### Ebook Reader Integration
- **ePub.js**: Full-featured EPUB rendering with reflowable content
- **PDF.js**: Native PDF viewing capabilities
- **Multi-window Architecture**: Tauri WebviewWindow for isolated reader instances
- **Reading Customization**: Theme switching, layout modes, font size control
- **Auto-hiding UI**: Mouse-movement based control visibility with smooth transitions
- **Progress Persistence**: CFI-based location tracking for EPUB files

### Database Integration
- SQLite database with comprehensive schema design
- Efficient metadata storage and retrieval for audiobooks and ebooks
- Progress tracking and bookmark management
- Optimized queries for large audiobook and ebook collections

## 📋 Development Commands

- `npm run tauri dev` - Start development server with hot reload
- `npm run tauri build` - Create production build and installer
- `npm run dev` - Frontend development server only
- `npm test` - Run frontend tests
- `cd src-tauri && cargo test` - Run Rust tests
- `npm run lint` - Code linting
- `npm run type-check` - TypeScript checking

## 🛠️ Technical Requirements

### System Requirements
- **OS**: Windows 10+, macOS 10.15+, or Linux
- **Memory**: 4GB RAM minimum
- **Storage**: 500MB for application + audiobook storage

### Developer Requirements
- Node.js 18+
- Rust (latest stable)
- Platform-specific build tools (Visual Studio on Windows, Xcode on macOS)

## 📄 License

This project is built for demonstration purposes showcasing modern desktop application development.

## 🎥 Demo Video

A 3-minute demonstration video showcasing the application features and development process is available for review.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

