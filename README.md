# React Native OpenCode Client

A mobile client for **OpenCode** built with **React Native + Expo (Dev
Builds)**.

Manage servers and sessions, chat with streaming AI responses, browse
git diffs, run remote terminal commands, and annotate files --- all from
your phone.

> ⚠️ **Beta Status** This project is under active development. APIs and
> UI behavior may change while features stabilize.

------------------------------------------------------------------------

## ✨ Features

-   📡 Real-time streaming chat (SSE-based)
-   🖥 Remote terminal powered by **xterm.js**
-   🔐 SSH support
-   🧠 Session-based AI conversations
-   🔍 Git status + diff viewer with syntax highlighting
-   📎 File & image attachments
-   📝 Line-range file annotations
-   🎨 App-wide Base16 theme system
-   🔐 Multi-server management (SSL + API key support)

------------------------------------------------------------------------

## 🎨 App-Wide Theming (Base16)

The application uses a custom Base16-driven theming system that applies
consistently across:

-   Navigation
-   Screens
-   Chat UI
-   Git viewer
-   Terminal
-   UI components

### Built-in Themes

-   Catppuccin Mocha
-   Dracula
-   Gruvbox Dark Hard
-   Nord
-   Nordic
-   One Dark
-   Solarized Dark
-   Tokyo Night Dark

Themes are defined via JSON and new themes can be added easily.

------------------------------------------------------------------------

## 🛠 Tech Stack

-   **Expo (Custom Dev Builds)**
-   **React Native**
-   **TypeScript**
-   React Navigation
-   Zustand (state management)
-   AsyncStorage (persistence)
-   `react-native-sse` (streaming)
-   Markdown rendering
-   `uniwind` (Tailwind-style styling)
-   **xterm.js** (embedded terminal engine with full ANSI support)
-   Native SSH integration

------------------------------------------------------------------------

## 🚀 Getting Started

### ❗ Expo Go Not Supported

This project uses native dependencies (including SSH bindings), so
**Expo Go will NOT work**.

You must use a **custom development build**.

------------------------------------------------------------------------

### Prerequisites

-   Node.js (LTS recommended)
-   Xcode (iOS) or Android Studio
-   A reachable **OpenCode server**

------------------------------------------------------------------------

### Install

``` bash
npm install
```

------------------------------------------------------------------------

### Run (Development Build Required)

#### iOS

``` bash
npx expo run:ios
```

#### Android

``` bash
npx expo run:android
```

This builds and installs a development client including required native
modules.

------------------------------------------------------------------------

## ⚠️ iOS Simulator Limitation

SSH does **not** function in the iOS simulator due to binary
architecture constraints.

To test SSH: - Use a physical iOS device - Or use Android (emulator or
device)

All other features work in simulator.

------------------------------------------------------------------------

## 🔌 Connecting to Your OpenCode Server

1.  Open the app
2.  Tap **Add Server**
3.  Provide:
    -   Host (IP or hostname)
    -   Port (commonly `3000`)
    -   Enable SSL if using HTTPS
    -   API Key (if required)
4.  Save
5.  Select server → Create a session

------------------------------------------------------------------------

## 📂 Project Structure

    src/
    ├── components/        # Chat, Git, Terminal, Annotation UI
    ├── screens/           # Servers, Sessions, Session detail
    ├── services/          # OpenCode API integration
    ├── store/             # Zustand state management
    ├── themes/            # Base16 theme definitions
    └── types/             # TypeScript definitions

------------------------------------------------------------------------

## 🧪 Development Scripts

``` bash
npm run dev
npm run ios
npm run android
npm run web   # limited support
```

------------------------------------------------------------------------

## 🐞 Troubleshooting

### Cannot Connect to Server

-   Verify server is running
-   Confirm host/port
-   Use LAN IP instead of localhost
-   Confirm SSL setting matches server config
-   Temporarily disable firewall for testing

### SSH Not Working

-   iOS simulator is unsupported
-   Use a physical device
-   Verify SSH credentials and key format

------------------------------------------------------------------------

## 📌 Roadmap (Active Issues)

### UI / UX Improvements

-   Edit session name (#33)
-   Fix delete button behavior (#32)
-   Add model selection dropdown (#31)
-   Add abort button for running requests (#30)

### Streaming & Rendering

-   Fix REST render for questions (SSE works, REST does not) (#27)
-   Support all tool renders (some outputs invisible / not handled
    correctly) (#1)
-   Improve terminal rendering (#3)

### Architecture & Core Refactors

-   Revisit annotation feature (conceptual redesign) (#5)
-   Replace custom OpenCode service with proper SDK integration (#21)

### Reliability & Observability

-   Integrate Sentry for error tracking (#26)

### Documentation

-   Improve SSH setup instructions for macOS/Linux (#2)

------------------------------------------------------------------------

## 🤝 Contributing

Pull requests and issues are welcome.

For large architectural changes, please open an issue first to align on
direction.

------------------------------------------------------------------------

## 📄 License

MIT

------------------------------------------------------------------------

Built with ❤️ using React Native, Expo Dev Builds, and xterm.js.
