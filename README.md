# Smart Notebook — 2026 Edition

> **Offline-First AI-Assisted Learning Planner & Notebook** featuring cognitive clarity, in-browser Pyodide WebAssembly execution, 3D stacked card deck, Bento progress analytics, and seamless multi-device local network synchronization.

---

## ✨ Features

- **3D Card Deck**: Smooth stacked cards for daily task progression, review states, and dynamic status badges.
- **7-Day Dynamic Calendar Strip**: Real-time habit tracking anchored to today's date with daily streak calculations.
- **In-Browser Python Execution**: Run Python code snippets directly in your browser using Pyodide WebAssembly with zero remote dependency.
- **Multi-Device Local Sync**: Host locally and access across phone, tablet, and other PCs on your local Wi-Fi with instant SQLite backend synchronization.
- **Google Authentication & Multi-User Support**: Sign in with Google OAuth or switch between preset demo accounts with isolated progress persistence.
- **Offline-First Resilience**: Full IndexedDB storage with automatic bidirectional synchronization to the local Express/SQLite backend.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18 or newer)
- **npm**

### 2. Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd "Smart notebook"

# Install dependencies
npm install
```

### 3. Run Locally

**Start the SQLite Backend Server (Port 3001):**
```bash
node server/server.js
```

**Start the Vite Frontend Dev Server (Port 5180):**
```bash
npm run dev
```

Open your browser at `http://localhost:5180`.

---

## 🧪 Testing

Run the automated test suites:

```bash
# Virtual 3D Card Deck offsets & transitions
node tests/test-deck.js

# AI Prompt generation & JSON validation
node tests/test-logic.js

# Daily habit consistency & date anchoring logic
node tests/test-consistency-and-dates.js

# Web view navigation & route switching
node tests/test-webview-navigation.js
```

Build for production:
```bash
npm run build
```

---

## 🛠️ Tech Stack

- **Frontend**: Vite, Vanilla JavaScript (ES Modules), CSS Modern Custom Properties
- **Compiler**: Pyodide (WebAssembly Python 3 runtime)
- **Local Client Storage**: IndexedDB (native promises)
- **Backend**: Node.js, Express.js, SQLite (`better-sqlite3`)
- **Authentication**: Google Identity Services (GIS), JWT session tokens
