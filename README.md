# React Native OpenCode Client

A comprehensive mobile client for OpenCode, featuring server management, session handling, chat with AI, git viewer, terminal emulator, and file annotations.

## Features

### Server Management
- Add/edit/delete OpenCode server instances
- Connect via IP/hostname and custom port
- SSL/TLS support
- Optional API key authentication
- Persistent server configurations

### Session Management
- Create and manage multiple sessions per server
- View session history
- Delete sessions

### Chat Tab
- Real-time chat with OpenCode AI
- Stream responses as they're generated
- Attach files (any file type)
- Attach images from gallery
- View chat history with attachments
- Mobile-optimized UI

### Git Viewer Tab
- View modified files in the session
- See additions/deletions per file
- Color-coded status indicators (Modified, Added, Deleted, Renamed)
- View full diffs with syntax highlighting
- Mobile-friendly diff viewer

### Terminal Tab
- Execute commands on the remote session
- Command history with ↑/↓ navigation
- Clear terminal
- Monospace display with color-coded output

### File Annotation Tab
- Add files to annotate
- Annotate specific line ranges with notes
- Visual indicators for annotated lines
- Send batch of annotated files with a message
- View file content with annotations inline

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your device:
   - iOS: Press `i` or scan QR code with Camera app
   - Android: Press `a` or scan QR code with Expo Go app
   - Web: Press `w` (limited functionality)

## Configuration

### Adding a Server

1. Launch the app
2. Tap "Add Server"
3. Fill in the details:
   - **Server Name**: A friendly name for the server
   - **Host**: IP address or hostname (e.g., `localhost`, `192.168.1.100`)
   - **Port**: OpenCode server port (default: `3000`)
   - **Use SSL**: Enable for HTTPS connections
   - **API Key** (optional): Authentication token if required

### Creating a Session

1. Select a server from the list
2. Tap "New Session"
3. Enter a session title
4. The session will be created on the remote server

## Usage

### Chat
- Type messages in the input field
- Tap 📎 to attach files
- Tap 🖼️ to attach images
- Messages stream in real-time as the AI responds

### Git Viewer
- Tap "Refresh" to load current git status
- Tap any file to view its full diff
- Color coding: Green (added), Orange (modified), Red (deleted), Blue (renamed)

### Terminal
- Type commands and press "Run"
- Use ↑/↓ buttons to navigate command history
- Clear terminal with "Clear" button

### File Annotation
1. Tap "Add File" to select a file
2. Tap the file to open the annotation editor
3. Specify line range (start/end)
4. Add annotation note
5. Tap "Add Annotation"
6. Repeat for multiple annotations or files
7. Enter a message describing your changes
8. Tap "Send All" to send to OpenCode with annotations

## Architecture

### Tech Stack
- React Native (Expo)
- TypeScript
- React Navigation (Stack + Bottom Tabs)
- Zustand (State Management)
- AsyncStorage (Persistence)
- Expo File System, Document Picker, Image Picker
- ai-sdk-provider-opencode-sdk

### Project Structure
```
src/
├── components/
│   ├── chat/          # Chat tab component
│   ├── git-viewer/    # Git viewer tab component
│   ├── terminal/      # Terminal tab component
│   └── file-annotation/  # File annotation tab component
├── screens/
│   ├── servers/       # Server list screen
│   ├── sessions/      # Sessions list screen
│   └── session-detail/   # Session detail with tabs
├── services/
│   └── opencode.ts    # OpenCode SDK service layer
├── store/
│   └── index.ts       # Zustand store
├── types/
│   └── index.ts       # TypeScript types
└── navigation/
    └── types.ts       # Navigation types
```

## OpenCode SDK Integration

The app uses the `ai-sdk-provider-opencode-sdk` package to communicate with OpenCode servers. The `OpenCodeService` class (src/services/opencode.ts) provides a high-level API for:

- Session management (create, list, delete)
- Message streaming with the AI SDK
- Git operations (status, diffs)
- Terminal command execution
- File operations

## Development

### Building for Production

```bash
# iOS
npm run ios

# Android
npm run android

# Build standalone apps
npx eas build --platform ios
npx eas build --platform android
```

### Customization

- Modify color scheme in component StyleSheets
- Adjust API endpoints in `src/services/opencode.ts`
- Add new tabs by creating components and adding to `SessionDetailScreen.tsx`

## Troubleshooting

### Connection Issues
- Verify the server is running and accessible
- Check firewall settings
- For local servers, use your machine's IP (not `localhost`) when testing on physical devices
- Enable SSL if the server requires HTTPS

### File Picker Issues
- Grant necessary permissions (photos, files)
- On iOS, check Info.plist permissions
- On Android, check AndroidManifest.xml permissions

## License

MIT

## Contributing

Contributions are welcome! Please open issues or submit pull requests.
