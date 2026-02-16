# React Native OpenCode Client - Project Summary

## What Was Built

A comprehensive mobile application for interacting with OpenCode servers, built with React Native and Expo.

## Core Features

### 1. Server Management
- Add, edit, and delete OpenCode server configurations
- Support for custom host, port, SSL, and API key
- Persistent storage of server configurations

### 2. Session Management  
- Create and manage sessions on each server
- View session history
- Sync with remote server sessions

### 3. Chat Interface
- Real-time AI chat with streaming responses
- File attachment support (any file type)
- Image attachment from gallery
- Full chat history with attachments
- Mobile-optimized message display

### 4. Git Viewer
- View all modified files in the session
- Color-coded status indicators (M/A/D/R)
- Full diff viewer with syntax highlighting
- Line-by-line additions/deletions count

### 5. Terminal Emulator
- Execute commands on remote session
- Command history navigation (↑/↓)
- Color-coded output (commands, output, errors)
- Clear terminal functionality

### 6. File Annotation System
- Load files for annotation
- Annotate specific line ranges with notes
- Visual indicators for annotated lines
- Batch send multiple annotated files with message

## Technical Implementation

### Stack
- React Native with Expo (TypeScript)
- Navigation: React Navigation (Stack + Bottom Tabs)
- State: Zustand
- Storage: AsyncStorage
- OpenCode Integration: ai-sdk-provider-opencode-sdk + AI SDK

### Architecture
```
App (Root Navigator)
├── Servers Screen
├── Sessions Screen (per server)
└── Session Detail (Bottom Tabs)
    ├── Chat Tab
    ├── Git Viewer Tab
    ├── Terminal Tab
    └── File Annotation Tab
```

### Key Files
- `src/services/opencode.ts` - OpenCode SDK wrapper
- `src/store/index.ts` - Zustand state management
- `src/types/index.ts` - TypeScript definitions
- `src/screens/` - Navigation screens
- `src/components/` - Tab components

## Project Structure
```
src/
├── components/
│   ├── chat/ChatTab.tsx
│   ├── git-viewer/GitViewerTab.tsx
│   ├── terminal/TerminalTab.tsx
│   └── file-annotation/FileAnnotationTab.tsx
├── screens/
│   ├── servers/ServersScreen.tsx
│   ├── sessions/SessionsScreen.tsx
│   └── session-detail/SessionDetailScreen.tsx
├── services/
│   └── opencode.ts
├── store/
│   └── index.ts
├── types/
│   └── index.ts
└── navigation/
    └── types.ts
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm start
   ```

3. Run on device:
   - iOS: Press `i` or scan QR with Camera
   - Android: Press `a` or scan QR with Expo Go

## Usage Flow

1. Add OpenCode server (host, port, SSL, API key)
2. Create or select a session
3. Use tabs to interact:
   - **Chat**: Send messages, attach files/images
   - **Git**: View modified files and diffs
   - **Terminal**: Execute remote commands
   - **Annotate**: Annotate files and batch send

## Features Implemented

✅ Server management (CRUD)
✅ Session management (create, list, delete)
✅ Real-time AI chat with streaming
✅ File and image attachments in chat
✅ Git status viewer with diffs
✅ Remote terminal emulator
✅ File annotation system
✅ Persistent storage (AsyncStorage)
✅ Mobile-optimized UI
✅ TypeScript throughout
✅ Full navigation flow

## TypeScript Compliance

All code passes `npx tsc --noEmit` with zero errors.

## Notes

- Uses Expo for cross-platform compatibility
- Zustand for lightweight state management
- AsyncStorage for persistent data
- OpenCode SDK integration via ai-sdk-provider-opencode-sdk
- Mobile-first design with responsive components
- Dark theme for code viewing (Terminal, Git, Annotations)
