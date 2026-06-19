# 🗂️ Life & Daily Planner Dashboard

A modern, responsive productivity dashboard built with **HTML5, CSS3, and Vanilla JavaScript**. Inspired by Microsoft To Do, Trello, Notion, and Pomodoro Timer apps.

![Dashboard Preview](assets/icon.svg)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 Authentication | Register, login, logout, password reset via Firebase Auth |
| 📋 Kanban Board | 4-column task board (To Do → In Progress → Review → Done) |
| 🔴🟡🟢 Priorities | High / Medium / Low with color-coded badges |
| ⏱️ Pomodoro Timer | Focus timer with presets, alarm, and session counter |
| ☀️ My Day | Daily planner with reminders and repeat options |
| 🔗 Quick Links | Favorite websites with drag-to-reorder |
| 🔍 Live Search | Real-time search with text highlighting |
| 📊 Statistics | Task completion rate, overdue count, progress bar |
| 📜 Activity Log | History of all actions on the board |
| 👥 Collaboration | Invite teammates (Owner / Editor / Viewer roles) |
| 🌙 Dark Mode | Light/dark theme toggle, saved to localStorage |
| 📱 PWA | Installable app, works offline |
| ♿ Accessible | ARIA labels, keyboard navigation, focus indicators |

---

## 🚀 Quick Start

### 1. Clone or download this repository

```bash
git clone https://github.com/YOUR-USERNAME/life-dashboard.git
cd life-dashboard
```

### 2. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use an existing one)
3. Add a **Web App** to your project
4. Copy your Firebase config

### 3. Configure your credentials

```bash
# Copy the example config file
cp js/firebase-config.example.js js/firebase-config.js
```

Then open `js/firebase-config.js` and fill in your values:

```js
window.__FIREBASE_CONFIG__ = {
  apiKey:            "your-api-key",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId:             "your-app-id",
  measurementId:     "G-XXXXXXXXXX"  // optional
};
```

> ⚠️ **Never commit `firebase-config.js` to Git.** It is already listed in `.gitignore`.

### 4. Deploy Firestore Security Rules

```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules
```

### 5. Open the app

Open `index.html` directly in your browser, or deploy to Firebase Hosting:

```bash
firebase deploy
```

Your live URL will be: `https://your-project-id.web.app`

---

## 📁 Project Structure

```
life-dashboard/
├── index.html                    # Main HTML — all UI structure
├── css/
│   └── style.css                 # All styles (light + dark theme)
├── js/
│   ├── app.js                    # All application logic (~2000 lines)
│   ├── firebase-config.js        # 🚫 YOUR credentials (gitignored)
│   └── firebase-config.example.js  # ✅ Blank template (safe to commit)
├── assets/
│   └── icon.svg                  # PWA app icon
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker (offline support)
├── firebase.json                 # Firebase Hosting config
├── firestore.rules               # Firestore security rules
├── firestore.indexes.json        # Firestore indexes
└── .gitignore                    # Blocks credentials from Git
```

---

## 🔒 Security

- API key is **never in source code** — loaded from `firebase-config.js` (gitignored)
- Firestore rules enforce **role-based access control** (Owner / Editor / Viewer)
- API key restricted to specific domains and APIs in Google Cloud Console
- All Firestore writes validate field types, lengths, and ownership

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `N` | New task |
| `T` | Toggle dark/light mode |
| `/` | Focus search bar |
| `Esc` | Close any open modal |

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend:** Firebase Authentication + Cloud Firestore
- **Hosting:** Firebase Hosting
- **Icons:** Feather Icons
- **PWA:** Web App Manifest + Service Worker

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

Built with ❤️ for Revou Coding Camp
