
/* ================================================
   LIFE & DAILY PLANNER DASHBOARD — app.js
   Vanilla JS ES6+. Firebase Compat SDK. No frameworks.
   ================================================
   TABLE OF CONTENTS
    1.  Firebase Configuration & Init
    2.  Constants & Centralized State
    3.  LocalStorage Helpers
    4.  Utility Functions
    5.  Toast Notifications
    6.  Loading Overlay
    7.  Clock & Greeting
    8.  Theme
    9.  Auth — Register / Login / Logout / Password Reset
   10.  Board Management (Firestore + local)
   11.  Firestore Real-time Listener
   12.  Name Editor
   13.  Focus Timer (Pomodoro)
   14.  My Day
   15.  Quick Links (drag-to-reorder)
   16.  Task Helpers — CRUD, validation, sorting
   17.  Task Modal (add / edit)
   18.  Kanban Board Rendering
   19.  Drag & Drop (desktop + touch)
   20.  Filters (My Day / Assigned)
   21.  Sort
   22.  Search (real-time, case-insensitive, highlight)
   23.  Dashboard Statistics
   24.  Activity Log
   25.  Share & Collaboration (Firestore)
   26.  Email Share
   27.  Settings Modal
   28.  Mobile Tabs & Sidebar Toggle
   29.  Keyboard Shortcuts
   30.  Notifications (Browser API + reminders)
   31.  PWA Install Prompt
   32.  initializeApp — boot sequence
   ================================================ */

'use strict';

/* ================================================
   1. FIREBASE CONFIGURATION & INIT (Compat SDK)
   ================================================ */
const firebaseConfig = {
  apiKey:            'AIzaSyDb1dz-5cQYmFMkAgslJJNpYoyOSd-APhI',
  authDomain:        'life-dashboard-425c3.firebaseapp.com',
  projectId:         'life-dashboard-425c3',
  storageBucket:     'life-dashboard-425c3.firebasestorage.app',
  messagingSenderId: '133120952985',
  appId:             '1:133120952985:web:78bf06e8f455183777c608',
  measurementId:     'G-Z05KFGF4NN'
};

const FIREBASE_ENABLED = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let firebaseApp = null;
let auth        = null;
let db          = null;

function initializeFirebase() {
  if (!FIREBASE_ENABLED) return;
  try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    auth        = firebase.auth();
    db          = firebase.firestore();
    // Initialize Analytics if measurementId is present
    if (firebaseConfig.measurementId) {
      firebase.analytics();
    }
    // Enable offline persistence so the app works without a connection
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (err) {
    console.warn('Firebase init failed:', err.message);
  }
}

/* ================================================
   2. CONSTANTS & CENTRALIZED STATE
   ================================================ */
const COLUMNS     = ['todo', 'inprogress', 'review', 'done'];
const COL_LABELS  = { todo: 'To Do', inprogress: 'In Progress', review: 'Review', done: 'Done' };
const PRIORITY_LABEL = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
const PERMISSIONS = { OWNER: 'owner', EDITOR: 'editor', VIEWER: 'viewer' };

const state = {
  currentUser:       null,
  isGuest:           false,
  boards:            [],
  activeBoardId:     null,
  tasks:             [],
  mydayItems:        [],
  links:             [],
  activityLog:       [],
  userName:          'Friend',
  theme:             'light',
  timerDuration:     25,
  timerSessions:     0,
  timerSessionDate:  '',
  settings:          { focusMins: 25, shortBreak: 5, longBreak: 15 }
};

const ui = {
  activeFilter:    null,
  activeTab:       'todo',
  draggingTaskId:  null,
  sortMode:        'none',
  searchQuery:     '',
  timerInterval:   null,
  timerRunning:    false,
  timerRemaining:  0,
  firestoreUnsub:  null,
  isLoading:       false,
  deferredInstall: null,
  reminderChecked: false
};

/* ================================================
   3. LOCALSTORAGE HELPERS
   ================================================ */
const LS = Object.freeze({
  TASKS:        'lpd_tasks',
  LINKS:        'lpd_links',
  MYDAY:        'lpd_myday',
  ACTIVITY:     'lpd_activity',
  USERNAME:     'lpd_username',
  THEME:        'lpd_theme',
  TIMER:        'lpd_timer',
  SETTINGS:     'lpd_settings',
  BOARDS:       'lpd_boards',
  ACTIVE_BOARD: 'lpd_activeBoard'
});

function saveLocalStorage() {
  try {
    localStorage.setItem(LS.TASKS,        JSON.stringify(state.tasks));
    localStorage.setItem(LS.LINKS,        JSON.stringify(state.links));
    localStorage.setItem(LS.MYDAY,        JSON.stringify(state.mydayItems));
    localStorage.setItem(LS.ACTIVITY,     JSON.stringify(state.activityLog));
    localStorage.setItem(LS.USERNAME,     state.userName);
    localStorage.setItem(LS.THEME,        state.theme);
    localStorage.setItem(LS.BOARDS,       JSON.stringify(state.boards));
    localStorage.setItem(LS.ACTIVE_BOARD, state.activeBoardId || '');
    localStorage.setItem(LS.TIMER,        JSON.stringify({
      duration:    state.timerDuration,
      sessions:    state.timerSessions,
      sessionDate: state.timerSessionDate
    }));
    localStorage.setItem(LS.SETTINGS, JSON.stringify(state.settings));
  } catch (e) {
    console.warn('localStorage save error:', e);
  }
}

function loadLocalStorage() {
  try {
    const tasks = localStorage.getItem(LS.TASKS);
    if (tasks) state.tasks = JSON.parse(tasks);

    const links = localStorage.getItem(LS.LINKS);
    if (links) state.links = JSON.parse(links);

    const myday = localStorage.getItem(LS.MYDAY);
    if (myday) state.mydayItems = JSON.parse(myday);

    const activity = localStorage.getItem(LS.ACTIVITY);
    if (activity) state.activityLog = JSON.parse(activity);

    const username = localStorage.getItem(LS.USERNAME);
    if (username) state.userName = username;

    const theme = localStorage.getItem(LS.THEME);
    if (theme) state.theme = theme;

    const boards = localStorage.getItem(LS.BOARDS);
    if (boards) state.boards = JSON.parse(boards);

    const activeBoard = localStorage.getItem(LS.ACTIVE_BOARD);
    if (activeBoard) state.activeBoardId = activeBoard;

    const timer = localStorage.getItem(LS.TIMER);
    if (timer) {
      const t = JSON.parse(timer);
      state.timerDuration    = t.duration    || 25;
      state.timerSessions    = t.sessions    || 0;
      state.timerSessionDate = t.sessionDate || '';
    }

    const settings = localStorage.getItem(LS.SETTINGS);
    if (settings) state.settings = Object.assign(state.settings, JSON.parse(settings));
  } catch (e) {
    console.warn('localStorage load error:', e);
  }
}

/* ================================================
   4. UTILITY FUNCTIONS
   ================================================ */
const generateId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getOffsetDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

function highlightMatch(text, query) {
  if (!query) return escapeHTML(text);
  const escaped = escapeHTML(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escaped.replace(regex, '<mark class="highlight">$1</mark>');
}

const priorityWeight = (p) => ({ high: 0, medium: 1, low: 2 }[p] ?? 1);

function compareDates(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)  return 'just now';
  if (hours < 1) return `${mins}m ago`;
  if (days < 1)  return `${hours}h ago`;
  return `${days}d ago`;
}

const openModal  = (id) => document.getElementById(id)?.classList.remove('hidden');
const closeModal = (id) => document.getElementById(id)?.classList.add('hidden');

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
}

/* ================================================
   5. TOAST NOTIFICATIONS
   ================================================ */
function showToast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  container.appendChild(toast);
  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

/* ================================================
   6. LOADING OVERLAY
   ================================================ */
function setLoading(show, message = 'Loading…') {
  const overlay = document.getElementById('loading-overlay');
  const msg     = document.getElementById('loading-message');
  if (!overlay) return;
  ui.isLoading = show;
  if (show) {
    if (msg) msg.textContent = message;
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

function setBtnLoading(btn, loading) {
  if (!btn) return;
  const textEl    = btn.querySelector('.btn-text');
  const spinnerEl = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  if (textEl)    textEl.classList.toggle('hidden', loading);
  if (spinnerEl) spinnerEl.classList.toggle('hidden', !loading);
}

/* ================================================
   7. CLOCK & GREETING
   ================================================ */
function getGreetingPrefix(hour) {
  if (hour >= 5  && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

function startClock() {
  function tick() {
    const now  = new Date();
    const hour = now.getHours();

    const greetingEl = document.getElementById('greeting');
    if (greetingEl) {
      greetingEl.textContent = `${getGreetingPrefix(hour)}, ${state.userName}!`;
    }

    const timeEl = document.getElementById('clock-time');
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString();
    }

    const dateEl = document.getElementById('clock-date');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }

    const mydayDateEl = document.getElementById('myday-date');
    if (mydayDateEl) {
      mydayDateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric'
      });
    }
  }
  tick();
  setInterval(tick, 1000);
}

/* ================================================
   8. THEME
   ================================================ */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const icon = btn.querySelector('[data-feather]');
    if (icon) {
      icon.setAttribute('data-feather', state.theme === 'dark' ? 'sun' : 'moon');
      if (typeof feather !== 'undefined') feather.replace({ 'stroke-width': 2 });
    }
  }
  // Sync settings checkbox
  const darkCheck = document.getElementById('setting-dark');
  if (darkCheck) darkCheck.checked = state.theme === 'dark';
}

function initializeTheme() {
  applyTheme();
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      saveLocalStorage();
    });
  }
}

/* ================================================
   9. AUTH
   ================================================ */
function showApp() {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
}

function showAuthScreen() {
  document.getElementById('auth-screen')?.classList.remove('hidden');
  document.getElementById('app')?.classList.add('hidden');
}

function updateUserUI() {
  const user       = state.currentUser;
  const name       = state.isGuest ? 'Guest' : (user?.displayName || state.userName || 'User');
  const email      = state.isGuest ? '' : (user?.email || '');
  const initials   = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  const initialsEl = document.getElementById('user-initials');
  const nameEl     = document.getElementById('user-dropdown-name');
  const emailEl    = document.getElementById('user-dropdown-email');

  if (initialsEl) initialsEl.textContent = initials;
  if (nameEl)     nameEl.textContent     = name;
  if (emailEl)    emailEl.textContent    = email;

  // Update greeting name
  if (!state.isGuest && user?.displayName) state.userName = user.displayName;
}

async function registerUser(name, email, password) {
  if (!auth) throw new Error('Firebase not available');
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName: name });
  state.userName = name;
}

async function loginUser(email, password) {
  if (!auth) throw new Error('Firebase not available');
  await auth.signInWithEmailAndPassword(email, password);
}

async function logoutUser() {
  if (ui.firestoreUnsub) { ui.firestoreUnsub(); ui.firestoreUnsub = null; }
  if (auth) await auth.signOut();
  state.currentUser   = null;
  state.isGuest       = false;
  state.tasks         = [];
  state.boards        = [];
  state.activeBoardId = null;
  showAuthScreen();
}

async function resetPassword(email) {
  if (!auth) throw new Error('Firebase not available');
  await auth.sendPasswordResetEmail(email);
}

function friendlyAuthError(code) {
  const map = {
    'auth/email-already-in-use':    'That email is already registered.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/user-not-found':          'No account found with that email.',
    'auth/wrong-password':          'Incorrect password.',
    'auth/too-many-requests':       'Too many attempts. Please try again later.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/popup-closed-by-user':    'Sign-in popup was closed.',
    'auth/invalid-credential':      'Invalid credentials. Please try again.'
  };
  return map[code] || 'Authentication failed. Please try again.';
}

function initializeAuth() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const target = tab.dataset.tab;
      document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));
      document.getElementById(`${target}-form`)?.classList.remove('hidden');
    });
  });

  // Password visibility toggles
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Login form
  const loginForm = document.getElementById('login-form');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailVal = document.getElementById('login-email')?.value.trim();
    const passVal  = document.getElementById('login-password')?.value;
    const errEl    = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit-btn');
    if (errEl) errEl.classList.add('hidden');
    setBtnLoading(submitBtn, true);
    try {
      await loginUser(emailVal, passVal);
    } catch (err) {
      if (errEl) {
        errEl.textContent = friendlyAuthError(err.code);
        errEl.classList.remove('hidden');
      }
    } finally {
      setBtnLoading(submitBtn, false);
    }
  });

  // Register form
  const regForm = document.getElementById('register-form');
  regForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal  = document.getElementById('reg-name')?.value.trim();
    const emailVal = document.getElementById('reg-email')?.value.trim();
    const passVal  = document.getElementById('reg-password')?.value;
    const errEl    = document.getElementById('register-error');
    const submitBtn = document.getElementById('register-submit-btn');
    if (!nameVal) {
      if (errEl) { errEl.textContent = 'Name is required.'; errEl.classList.remove('hidden'); }
      return;
    }
    if (errEl) errEl.classList.add('hidden');
    setBtnLoading(submitBtn, true);
    try {
      await registerUser(nameVal, emailVal, passVal);
    } catch (err) {
      if (errEl) {
        errEl.textContent = friendlyAuthError(err.code);
        errEl.classList.remove('hidden');
      }
    } finally {
      setBtnLoading(submitBtn, false);
    }
  });

  // Guest mode
  document.getElementById('guest-btn')?.addEventListener('click', () => {
    state.isGuest   = true;
    state.currentUser = null;
    loadLocalStorage();
    showApp();
    updateUserUI();
    ensureDefaultBoard().then(() => {
      renderBoardSelector();
      renderBoard();
      renderStats();
      renderActivityLog();
      renderMyday();
      renderLinks();
    });
  });

  // Forgot password button
  document.getElementById('forgot-pw-btn')?.addEventListener('click', () => openModal('forgot-modal-overlay'));
  document.getElementById('forgot-modal-close')?.addEventListener('click', () => closeModal('forgot-modal-overlay'));
  document.getElementById('forgot-cancel-btn')?.addEventListener('click', () => closeModal('forgot-modal-overlay'));

  const forgotForm = document.getElementById('forgot-form');
  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailVal  = document.getElementById('forgot-email')?.value.trim();
    const errEl     = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    const submitBtn = document.getElementById('forgot-submit-btn');
    if (errEl)     errEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');
    setBtnLoading(submitBtn, true);
    try {
      await resetPassword(emailVal);
      if (successEl) {
        successEl.textContent = 'Reset email sent! Check your inbox.';
        successEl.classList.remove('hidden');
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = friendlyAuthError(err.code);
        errEl.classList.remove('hidden');
      }
    } finally {
      setBtnLoading(submitBtn, false);
    }
  });

  // Logout button
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await logoutUser();
    showToast('Signed out successfully.', 'info');
  });

  // User avatar dropdown toggle
  const avatarBtn  = document.getElementById('user-avatar-btn');
  const dropdown   = document.getElementById('user-dropdown');
  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !dropdown.classList.contains('hidden');
    dropdown?.classList.toggle('hidden', open);
    avatarBtn.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
    avatarBtn?.setAttribute('aria-expanded', 'false');
  });

  // Firebase auth state listener
  if (FIREBASE_ENABLED && auth) {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        state.currentUser = user;
        state.isGuest     = false;
        state.userName    = user.displayName || state.userName;
        loadLocalStorage();
        showApp();
        updateUserUI();
        setLoading(true, 'Loading your boards…');
        try {
          await loadUserBoards();
          await ensureDefaultBoard();
          renderBoardSelector();
          subscribeToBoard(state.activeBoardId);
        } catch (err) {
          console.warn('Board load error:', err);
          renderBoard();
        } finally {
          setLoading(false);
        }
        renderStats();
        renderActivityLog();
        renderMyday();
        renderLinks();
      } else if (!state.isGuest) {
        showAuthScreen();
      }
    });
  } else {
    // No Firebase — show auth screen for guest option
    showAuthScreen();
  }
}

/* ================================================
   10. BOARD MANAGEMENT
   ================================================ */
async function ensureDefaultBoard() {
  if (state.boards.length === 0) {
    const board = {
      id:        generateId(),
      name:      'My Board',
      ownerId:   state.currentUser?.uid || 'guest',
      members:   {},
      createdAt: new Date().toISOString()
    };
    if (board.ownerId !== 'guest') board.members[board.ownerId] = PERMISSIONS.OWNER;
    state.boards.push(board);
    state.activeBoardId = board.id;

    if (FIREBASE_ENABLED && db && state.currentUser) {
      try {
        await db.collection('boards').doc(board.id).set(board);
        await db.collection('users').doc(state.currentUser.uid)
          .set({ boards: firebase.firestore.FieldValue.arrayUnion(board.id) }, { merge: true });
      } catch (e) { console.warn('Board create error:', e); }
    }
    saveLocalStorage();
  }
  if (!state.activeBoardId && state.boards.length > 0) {
    state.activeBoardId = state.boards[0].id;
  }
}

async function createBoard(name) {
  const board = {
    id:        generateId(),
    name:      name.trim(),
    ownerId:   state.currentUser?.uid || 'guest',
    members:   {},
    createdAt: new Date().toISOString()
  };
  if (state.currentUser) board.members[state.currentUser.uid] = PERMISSIONS.OWNER;
  state.boards.push(board);
  state.activeBoardId = board.id;
  state.tasks = state.tasks.filter(t => t.boardId !== board.id); // fresh slate

  if (FIREBASE_ENABLED && db && state.currentUser) {
    try {
      await db.collection('boards').doc(board.id).set(board);
      await db.collection('users').doc(state.currentUser.uid)
        .set({ boards: firebase.firestore.FieldValue.arrayUnion(board.id) }, { merge: true });
    } catch (e) { console.warn('createBoard Firestore error:', e); }
  }
  saveLocalStorage();
  return board;
}

function switchBoard(boardId) {
  if (ui.firestoreUnsub) { ui.firestoreUnsub(); ui.firestoreUnsub = null; }
  state.activeBoardId = boardId;
  saveLocalStorage();
  if (FIREBASE_ENABLED && db && state.currentUser) {
    subscribeToBoard(boardId);
  } else {
    renderBoard();
    renderStats();
  }
}

async function loadUserBoards() {
  if (!FIREBASE_ENABLED || !db || !state.currentUser) return;
  try {
    const snap = await db.collection('boards')
      .where(`members.${state.currentUser.uid}`, 'in', [PERMISSIONS.OWNER, PERMISSIONS.EDITOR, PERMISSIONS.VIEWER])
      .get();
    if (!snap.empty) {
      state.boards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    // Fallback: load boards owned by user
    try {
      const snap2 = await db.collection('boards')
        .where('ownerId', '==', state.currentUser.uid).get();
      if (!snap2.empty) {
        state.boards = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e2) { console.warn('loadUserBoards error:', e2); }
  }
}

function renderBoardSelector() {
  const sel = document.getElementById('board-selector');
  if (!sel) return;
  sel.innerHTML = '';
  state.boards.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.name;
    if (b.id === state.activeBoardId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function initializeBoards() {
  const sel = document.getElementById('board-selector');
  sel?.addEventListener('change', () => switchBoard(sel.value));

  document.getElementById('new-board-btn')?.addEventListener('click', () => openModal('board-modal-overlay'));
  document.getElementById('board-modal-close')?.addEventListener('click', () => closeModal('board-modal-overlay'));
  document.getElementById('board-cancel-btn')?.addEventListener('click', () => closeModal('board-modal-overlay'));

  const boardForm = document.getElementById('board-form');
  boardForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('board-name-input');
    const name = nameInput?.value.trim();
    if (!name) return;
    const submitBtn = document.getElementById('board-submit-btn');
    setBtnLoading(submitBtn, true);
    try {
      await createBoard(name);
      nameInput.value = '';
      closeModal('board-modal-overlay');
      renderBoardSelector();
      renderBoard();
      renderStats();
      showToast(`Board "${name}" created.`, 'success');
      addActivityLog('Created board', name);
    } catch (err) {
      showToast('Failed to create board.', 'error');
    } finally {
      setBtnLoading(submitBtn, false);
    }
  });
}

/* ================================================
   11. FIRESTORE REAL-TIME LISTENER
   ================================================ */
function subscribeToBoard(boardId) {
  if (!FIREBASE_ENABLED || !db || !boardId) return;
  if (ui.firestoreUnsub) { ui.firestoreUnsub(); ui.firestoreUnsub = null; }

  ui.firestoreUnsub = db.collection('tasks')
    .where('boardId', '==', boardId)
    .onSnapshot(
      (snap) => {
        state.tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        saveLocalStorage();
        renderBoard();
        renderStats();
      },
      (err) => {
        console.warn('Firestore snapshot error:', err);
        // Fall back to local tasks
        renderBoard();
        renderStats();
      }
    );
}

/* ================================================
   12. NAME EDITOR
   ================================================ */
function initNameEditor() {
  document.getElementById('edit-name-btn')?.addEventListener('click', () => {
    const input = document.getElementById('name-input');
    if (input) input.value = state.userName;
    openModal('name-modal-overlay');
    document.getElementById('name-input')?.focus();
  });

  document.getElementById('name-modal-close')?.addEventListener('click', () => closeModal('name-modal-overlay'));
  document.getElementById('name-cancel-btn')?.addEventListener('click', () => closeModal('name-modal-overlay'));

  document.getElementById('name-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = document.getElementById('name-input')?.value.trim();
    if (!val) return;
    state.userName = val;
    saveLocalStorage();
    if (state.currentUser && auth) {
      try { await state.currentUser.updateProfile({ displayName: val }); } catch {}
    }
    updateUserUI();
    closeModal('name-modal-overlay');
    showToast('Name updated!', 'success');
  });
}

/* ================================================
   13. FOCUS TIMER (POMODORO)
   ================================================ */
const formatTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (el) el.textContent = formatTime(ui.timerRemaining);
}

function updateSessionDisplay() {
  const today = getTodayString();
  if (state.timerSessionDate !== today) {
    state.timerSessions    = 0;
    state.timerSessionDate = today;
  }
  const el = document.getElementById('timer-sessions');
  if (el) el.textContent = `Sessions today: ${state.timerSessions}`;
}

function timerTick() {
  if (ui.timerRemaining <= 0) {
    clearInterval(ui.timerInterval);
    ui.timerInterval = null;
    ui.timerRunning  = false;
    state.timerSessions++;
    state.timerSessionDate = getTodayString();
    saveLocalStorage();
    updateSessionDisplay();
    // Play alarm
    document.getElementById('timer-alarm')?.play().catch(() => {});
    showToast('🍅 Focus session complete!', 'success', 4000);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Focus Session Complete', {
        body: 'Great work! Take a short break.',
        icon: 'assets/icon.svg'
      });
    }
    return;
  }
  ui.timerRemaining--;
  updateTimerDisplay();
}

function initializePomodoro() {
  ui.timerRemaining = state.timerDuration * 60;
  updateTimerDisplay();
  updateSessionDisplay();

  // Preset buttons
  document.querySelectorAll('.timer-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timer-mode-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      const mins = parseInt(btn.dataset.mins, 10);
      state.timerDuration    = mins;
      ui.timerRemaining      = mins * 60;
      const durInput = document.getElementById('timer-duration');
      if (durInput) durInput.value = mins;
      if (ui.timerInterval) { clearInterval(ui.timerInterval); ui.timerInterval = null; ui.timerRunning = false; }
      updateTimerDisplay();
      saveLocalStorage();
    });
  });

  // Custom duration input
  const durInput = document.getElementById('timer-duration');
  if (durInput) {
    durInput.value = state.timerDuration;
    durInput.addEventListener('change', () => {
      const v = Math.max(1, Math.min(120, parseInt(durInput.value, 10) || 25));
      durInput.value         = v;
      state.timerDuration    = v;
      ui.timerRemaining      = v * 60;
      if (ui.timerInterval) { clearInterval(ui.timerInterval); ui.timerInterval = null; ui.timerRunning = false; }
      updateTimerDisplay();
      saveLocalStorage();
    });
  }

  document.getElementById('timer-start')?.addEventListener('click', () => {
    if (ui.timerRunning) return;
    if (ui.timerRemaining <= 0) ui.timerRemaining = state.timerDuration * 60;
    ui.timerRunning  = true;
    ui.timerInterval = setInterval(timerTick, 1000);
    updateTimerDisplay();
  });

  document.getElementById('timer-stop')?.addEventListener('click', () => {
    if (!ui.timerRunning) return;
    clearInterval(ui.timerInterval);
    ui.timerInterval = null;
    ui.timerRunning  = false;
  });

  document.getElementById('timer-reset')?.addEventListener('click', () => {
    clearInterval(ui.timerInterval);
    ui.timerInterval   = null;
    ui.timerRunning    = false;
    ui.timerRemaining  = state.timerDuration * 60;
    updateTimerDisplay();
  });
}

/* ================================================
   14. MY DAY
   ================================================ */
function renderMyday() {
  const list = document.getElementById('myday-list');
  if (!list) return;
  const today = getTodayString();
  // Auto-populate from Kanban tasks due today
  const kanbanToday = state.tasks
    .filter(t => t.dueDate === today && t.column !== 'done' && t.boardId === state.activeBoardId);

  list.innerHTML = '';

  // Manual My Day items
  state.mydayItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'myday-item';
    li.innerHTML = `
      <label class="myday-check-label">
        <input type="checkbox" class="myday-check" data-id="${item.id}" ${item.done ? 'checked' : ''}
               aria-label="${escapeHTML(item.title)}" />
        <span class="myday-title ${item.done ? 'done-text' : ''}">${escapeHTML(item.title)}</span>
      </label>
      ${item.note ? `<span class="myday-note">${escapeHTML(item.note)}</span>` : ''}
      ${item.reminder ? `<span class="myday-reminder">⏰ ${item.reminder}</span>` : ''}
      <button class="icon-btn myday-delete" data-id="${item.id}" aria-label="Remove item"><i data-feather="trash-2"></i></button>
    `;
    list.appendChild(li);
  });

  // Kanban tasks due today (shown as read-only)
  kanbanToday.forEach(task => {
    const alreadyShown = state.mydayItems.some(m => m.title === task.title);
    if (alreadyShown) return;
    const li = document.createElement('li');
    li.className = 'myday-item myday-from-kanban';
    li.innerHTML = `
      <span class="myday-title">${escapeHTML(task.title)}</span>
      <span class="myday-badge">Kanban</span>
    `;
    list.appendChild(li);
  });

  if (list.children.length === 0) {
    list.innerHTML = '<li class="myday-empty">Nothing planned yet.</li>';
  }

  if (typeof feather !== 'undefined') feather.replace({ 'stroke-width': 2 });

  // Checkbox events
  list.querySelectorAll('.myday-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const item = state.mydayItems.find(m => m.id === cb.dataset.id);
      if (item) {
        item.done = cb.checked;
        saveLocalStorage();
        renderMyday();
      }
    });
  });

  // Delete events
  list.querySelectorAll('.myday-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mydayItems = state.mydayItems.filter(m => m.id !== btn.dataset.id);
      saveLocalStorage();
      renderMyday();
    });
  });
}

function initMyday() {
  document.getElementById('add-myday-btn')?.addEventListener('click', () => openModal('myday-modal-overlay'));
  document.getElementById('myday-modal-close')?.addEventListener('click', () => closeModal('myday-modal-overlay'));
  document.getElementById('myday-cancel-btn')?.addEventListener('click', () => closeModal('myday-modal-overlay'));

  document.getElementById('myday-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title    = document.getElementById('myday-title')?.value.trim();
    const note     = document.getElementById('myday-note')?.value.trim();
    const reminder = document.getElementById('myday-reminder')?.value;
    const repeat   = document.getElementById('myday-repeat')?.value;
    if (!title) return;
    state.mydayItems.push({
      id:        generateId(),
      title,
      note:      note || '',
      reminder:  reminder || '',
      repeat:    repeat || 'none',
      done:      false,
      createdAt: new Date().toISOString()
    });
    saveLocalStorage();
    renderMyday();
    closeModal('myday-modal-overlay');
    document.getElementById('myday-form')?.reset();
    showToast('Added to My Day!', 'success');
  });
}

/* ================================================
   15. QUICK LINKS
   ================================================ */
let _linkDragId = null;

function renderLinks() {
  const list = document.getElementById('links-list');
  if (!list) return;
  list.innerHTML = '';

  if (state.links.length === 0) {
    list.innerHTML = '<li class="links-empty">No quick links yet.</li>';
  } else {
    state.links.forEach(link => {
      const li = document.createElement('li');
      li.className = 'link-item';
      li.draggable = true;
      li.dataset.id = link.id;
      li.innerHTML = `
        <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer" class="link-anchor">
          <i data-feather="external-link"></i>
          <span>${escapeHTML(link.label)}</span>
        </a>
        <button class="icon-btn link-delete" data-id="${link.id}" aria-label="Delete link"><i data-feather="x"></i></button>
      `;
      list.appendChild(li);
    });
  }

  if (typeof feather !== 'undefined') feather.replace({ 'stroke-width': 2 });

  // Drag-to-reorder
  list.querySelectorAll('.link-item').forEach(item => {
    item.addEventListener('dragstart', () => { _linkDragId = item.dataset.id; item.classList.add('dragging'); });
    item.addEventListener('dragend',   () => { _linkDragId = null; item.classList.remove('dragging'); });
    item.addEventListener('dragover',  (e) => { e.preventDefault(); });
    item.addEventListener('drop',      () => {
      if (!_linkDragId || _linkDragId === item.dataset.id) return;
      const fromIdx = state.links.findIndex(l => l.id === _linkDragId);
      const toIdx   = state.links.findIndex(l => l.id === item.dataset.id);
      if (fromIdx < 0 || toIdx < 0) return;
      const [moved] = state.links.splice(fromIdx, 1);
      state.links.splice(toIdx, 0, moved);
      saveLocalStorage();
      renderLinks();
    });
  });

  // Delete events
  list.querySelectorAll('.link-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      state.links = state.links.filter(l => l.id !== btn.dataset.id);
      saveLocalStorage();
      renderLinks();
    });
  });
}

function initializeQuickLinks() {
  const addBtn    = document.getElementById('add-link-btn');
  const cancelBtn = document.getElementById('cancel-link-btn');
  const form      = document.getElementById('add-link-form');

  addBtn?.addEventListener('click', () => {
    form?.classList.toggle('hidden');
    addBtn.setAttribute('aria-expanded', String(!form?.classList.contains('hidden')));
  });

  cancelBtn?.addEventListener('click', () => {
    form?.classList.add('hidden');
    addBtn?.setAttribute('aria-expanded', 'false');
    form?.reset();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const label = document.getElementById('link-label')?.value.trim();
    const url   = document.getElementById('link-url')?.value.trim();
    if (!label || !url) return;
    state.links.push({ id: generateId(), label, url, createdAt: new Date().toISOString() });
    saveLocalStorage();
    renderLinks();
    form.reset();
    form.classList.add('hidden');
    addBtn?.setAttribute('aria-expanded', 'false');
    showToast('Link added.', 'success');
  });
}

/* ================================================
   16. TASK HELPERS
   ================================================ */
function isDuplicateTitle(title, excludeId) {
  return state.tasks.some(
    t => t.boardId === state.activeBoardId &&
         t.title.trim().toLowerCase() === title.trim().toLowerCase() &&
         t.id !== excludeId
  );
}

function getSortedTasks(tasks) {
  const arr = [...tasks];
  switch (ui.sortMode) {
    case 'priority':
      return arr.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
    case 'duedate':
      return arr.sort((a, b) => compareDates(a.dueDate, b.dueDate));
    case 'created':
      return arr.sort((a, b) => compareDates(a.createdAt, b.createdAt));
    case 'status':
      return arr.sort((a, b) =>
        COLUMNS.indexOf(a.column) - COLUMNS.indexOf(b.column)
      );
    default:
      return arr;
  }
}

async function persistTask(task) {
  // Update in local state
  const idx = state.tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) {
    state.tasks[idx] = task;
  } else {
    state.tasks.push(task);
  }
  saveLocalStorage();

  if (FIREBASE_ENABLED && db && state.currentUser && !state.isGuest) {
    try {
      await db.collection('tasks').doc(task.id).set(task);
    } catch (e) { console.warn('persistTask error:', e); }
  }
}

async function deleteTaskById(taskId) {
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  saveLocalStorage();
  if (FIREBASE_ENABLED && db && state.currentUser && !state.isGuest) {
    try {
      await db.collection('tasks').doc(taskId).delete();
    } catch (e) { console.warn('deleteTask error:', e); }
  }
}

async function moveTask(taskId, targetCol) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.column === targetCol) return;
  const oldCol  = task.column;
  task.column   = targetCol;
  task.updatedAt = new Date().toISOString();
  await persistTask(task);
  addActivityLog('Moved task', `"${task.title}" → ${COL_LABELS[targetCol]}`);
  renderBoard();
  renderStats();
}

/* ================================================
   17. TASK MODAL
   ================================================ */
function openTaskModal(task = null) {
  const modal     = document.getElementById('task-modal-overlay');
  const titleEl   = document.getElementById('task-modal-title');
  const submitBtn = document.getElementById('task-submit-btn');
  const submitTxt = submitBtn?.querySelector('.btn-text');
  if (!modal) return;

  // Reset form
  document.getElementById('task-form')?.reset();
  document.getElementById('task-id').value         = task?.id       || '';
  document.getElementById('task-title').value      = task?.title    || '';
  document.getElementById('task-desc').value       = task?.desc     || '';
  document.getElementById('task-due-date').value   = task?.dueDate  || '';
  document.getElementById('task-deadline').value   = task?.deadline || '';
  document.getElementById('task-assigned-name').value  = task?.assignedName  || '';
  document.getElementById('task-assigned-email').value = task?.assignedEmail || '';
  document.getElementById('task-repeat').value     = task?.repeat   || 'none';

  const colSel = document.getElementById('task-column');
  if (colSel) colSel.value = task?.column || 'todo';

  // Priority radio
  const priority = task?.priority || 'medium';
  const radios = document.querySelectorAll('input[name="priority"]');
  radios.forEach(r => { r.checked = r.value === priority; });

  const assignedMe = document.getElementById('task-assigned-me');
  if (assignedMe) assignedMe.checked = task?.assignedToMe || false;

  if (titleEl) titleEl.textContent = task ? 'Edit Task' : 'New Task';
  if (submitTxt) submitTxt.textContent = task ? 'Update Task' : 'Add Task';

  // Hide title error
  document.getElementById('title-error')?.classList.add('hidden');

  openModal('task-modal-overlay');
  document.getElementById('task-title')?.focus();
}

function initializeTasks() {
  // Open modal via "New Task" button
  document.getElementById('add-task-btn')?.addEventListener('click', () => openTaskModal(null));

  // Close modal
  document.getElementById('task-modal-close')?.addEventListener('click', () => closeModal('task-modal-overlay'));
  document.getElementById('task-cancel-btn')?.addEventListener('click', () => closeModal('task-modal-overlay'));

  // Close on backdrop click
  document.getElementById('task-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('task-modal-overlay');
  });

  // Quick date buttons
  document.querySelectorAll('.quick-date').forEach(btn => {
    btn.addEventListener('click', () => {
      const dueDateInput = document.getElementById('task-due-date');
      if (dueDateInput) dueDateInput.value = getOffsetDateString(parseInt(btn.dataset.offset, 10));
    });
  });

  // Task form submit
  document.getElementById('task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('task-title');
    const title = titleInput?.value.trim();
    const titleError = document.getElementById('title-error');

    if (!title) {
      titleError?.classList.remove('hidden');
      titleInput?.focus();
      return;
    }
    titleError?.classList.add('hidden');

    const existingId = document.getElementById('task-id')?.value;
    const isEdit     = Boolean(existingId);

    if (!isEdit && isDuplicateTitle(title, null)) {
      showToast('A task with that title already exists.', 'warning');
      return;
    }

    const priority    = document.querySelector('input[name="priority"]:checked')?.value || 'medium';
    const column      = document.getElementById('task-column')?.value || 'todo';
    const dueDate     = document.getElementById('task-due-date')?.value   || '';
    const deadline    = document.getElementById('task-deadline')?.value   || '';
    const desc        = document.getElementById('task-desc')?.value.trim() || '';
    const assignedName  = document.getElementById('task-assigned-name')?.value.trim()  || '';
    const assignedEmail = document.getElementById('task-assigned-email')?.value.trim() || '';
    const repeat      = document.getElementById('task-repeat')?.value || 'none';
    const assignedToMe = document.getElementById('task-assigned-me')?.checked || false;
    const submitBtn   = document.getElementById('task-submit-btn');

    setBtnLoading(submitBtn, true);

    const task = {
      id:            isEdit ? existingId : generateId(),
      title,
      desc,
      priority,
      column,
      dueDate,
      deadline,
      assignedName,
      assignedEmail,
      assignedToMe,
      repeat,
      boardId:       state.activeBoardId,
      ownerId:       state.currentUser?.uid || 'guest',
      createdAt:     isEdit ? (state.tasks.find(t => t.id === existingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt:     new Date().toISOString()
    };

    try {
      await persistTask(task);
      addActivityLog(isEdit ? 'Updated task' : 'Created task', title);
      closeModal('task-modal-overlay');
      renderBoard();
      renderStats();
      renderMyday();
      showToast(isEdit ? 'Task updated.' : 'Task added.', 'success');
    } catch (err) {
      showToast('Failed to save task.', 'error');
    } finally {
      setBtnLoading(submitBtn, false);
    }
  });
}

/* ================================================
   18. KANBAN BOARD RENDERING
   ================================================ */
function buildTaskCard(task, searchQuery = '') {
  const today       = getTodayString();
  const isOverdue   = task.dueDate && task.dueDate < today && task.column !== 'done';
  const isDueToday  = task.dueDate === today;
  const q           = searchQuery.toLowerCase();
  const matchesSearch = !q ||
    task.title.toLowerCase().includes(q) ||
    (task.desc && task.desc.toLowerCase().includes(q)) ||
    (task.assignedName && task.assignedName.toLowerCase().includes(q));

  if (!matchesSearch) return null;

  const card = document.createElement('div');
  card.className = `task-card priority-${task.priority}${isOverdue ? ' overdue' : ''}${isDueToday ? ' due-today' : ''}`;
  card.dataset.id = task.id;
  card.setAttribute('draggable', 'true');
  card.setAttribute('role', 'listitem');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Task: ${task.title}`);

  const titleHtml = searchQuery
    ? highlightMatch(task.title, searchQuery)
    : escapeHTML(task.title);
  const descHtml = task.desc
    ? (searchQuery ? highlightMatch(task.desc, searchQuery) : escapeHTML(task.desc))
    : '';

  let dueBadge = '';
  if (task.dueDate) {
    const cls = isOverdue ? 'due-badge overdue-badge' : isDueToday ? 'due-badge today-badge' : 'due-badge';
    dueBadge = `<span class="${cls}"><i data-feather="calendar"></i> ${task.dueDate}</span>`;
  }

  let assignedBadge = '';
  if (task.assignedName) {
    assignedBadge = `<span class="assigned-badge"><i data-feather="user"></i> ${escapeHTML(task.assignedName)}</span>`;
  }

  card.innerHTML = `
    <div class="task-card-header">
      <span class="task-priority-dot" aria-hidden="true"></span>
      <span class="task-title">${titleHtml}</span>
      <div class="task-card-actions">
        <button class="icon-btn task-edit-btn" data-id="${task.id}" aria-label="Edit task" title="Edit">
          <i data-feather="edit-2"></i>
        </button>
        <button class="icon-btn task-delete-btn" data-id="${task.id}" aria-label="Delete task" title="Delete">
          <i data-feather="trash-2"></i>
        </button>
      </div>
    </div>
    ${descHtml ? `<p class="task-desc">${descHtml}</p>` : ''}
    <div class="task-meta">
      <span class="task-priority-label">${PRIORITY_LABEL[task.priority] || ''}</span>
      ${dueBadge}
      ${assignedBadge}
    </div>
    <div class="task-move-row" role="group" aria-label="Move task">
      ${COLUMNS.filter(c => c !== task.column).map(c =>
        `<button class="btn btn-ghost btn-xs task-move-btn" data-id="${task.id}" data-col="${c}" aria-label="Move to ${COL_LABELS[c]}">→ ${COL_LABELS[c]}</button>`
      ).join('')}
    </div>
  `;

  return card;
}

function renderBoard() {
  const tasks = state.tasks.filter(t => t.boardId === state.activeBoardId);

  // Apply active filter
  let filtered = tasks;
  if (ui.activeFilter === 'myday') {
    const today = getTodayString();
    filtered = tasks.filter(t => t.dueDate === today);
  } else if (ui.activeFilter === 'assigned') {
    filtered = tasks.filter(t => t.assignedToMe ||
      (state.currentUser && t.assignedEmail === state.currentUser.email));
  }

  // Apply search
  const q = ui.searchQuery.toLowerCase();

  COLUMNS.forEach(col => {
    const listEl  = document.getElementById(`tasks-${col}`);
    const countEl = document.getElementById(`count-${col}`);
    if (!listEl) return;
    listEl.innerHTML = '';

    let colTasks = filtered.filter(t => t.column === col);
    colTasks = getSortedTasks(colTasks);

    colTasks.forEach(task => {
      const card = buildTaskCard(task, ui.searchQuery);
      if (!card) return;
      listEl.appendChild(card);
    });

    const count = listEl.children.length;
    if (countEl) {
      countEl.textContent = count;
      countEl.setAttribute('aria-label', `${count} task${count !== 1 ? 's' : ''}`);
    }
  });

  if (typeof feather !== 'undefined') feather.replace({ 'stroke-width': 2 });

  // Wire card buttons
  document.querySelectorAll('.task-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const task = state.tasks.find(t => t.id === btn.dataset.id);
      if (task) openTaskModal(task);
    });
  });

  document.querySelectorAll('.task-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const task = state.tasks.find(t => t.id === btn.dataset.id);
      if (!task) return;
      if (!confirm(`Delete "${task.title}"?`)) return;
      await deleteTaskById(task.id);
      addActivityLog('Deleted task', task.title);
      renderBoard();
      renderStats();
      renderMyday();
      showToast('Task deleted.', 'info');
    });
  });

  document.querySelectorAll('.task-move-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await moveTask(btn.dataset.id, btn.dataset.col);
    });
  });
}

/* ================================================
   SEARCH — real-time, case-insensitive, highlight
   ================================================ */
function initializeSearch() {
  const input    = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    ui.searchQuery = input.value.trim();
    clearBtn?.classList.toggle('hidden', !ui.searchQuery);
    renderBoard();
  });

  clearBtn?.addEventListener('click', () => {
    input.value    = '';
    ui.searchQuery = '';
    clearBtn.classList.add('hidden');
    renderBoard();
    input.focus();
  });

  // Press "/" to focus search (when not typing in an input)
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

/* ================================================
   DASHBOARD STATISTICS
   ================================================ */
function renderStats() {
  const boardTasks = state.tasks.filter(t => t.boardId === state.activeBoardId);
  const today      = getTodayString();
  const total      = boardTasks.length;
  const done       = boardTasks.filter(t => t.column === 'done').length;
  const inprog     = boardTasks.filter(t => t.column === 'inprogress').length;
  const overdue    = boardTasks.filter(t => t.dueDate && t.dueDate < today && t.column !== 'done').length;
  const rate       = total > 0 ? Math.round((done / total) * 100) : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total',    total);
  set('stat-done',     done);
  set('stat-progress', inprog);
  set('stat-overdue',  overdue);
  set('stat-rate-pct', `${rate}%`);

  const fill = document.getElementById('stat-rate-fill');
  if (fill) {
    fill.style.width = `${rate}%`;
    fill.closest('[role="progressbar"]')?.setAttribute('aria-valuenow', rate);
  }
}

/* ================================================
   ACTIVITY LOG
   ================================================ */
function addActivityLog(action, subject = '') {
  const name  = state.currentUser?.displayName || state.userName;
  const entry = {
    id:        generateId(),
    user:      name,
    action,
    subject,
    timestamp: new Date().toISOString(),
  };
  state.activityLog.unshift(entry);
  if (state.activityLog.length > 50) state.activityLog.length = 50;
  saveLocalStorage();
  renderActivityLog();

  if (FIREBASE_ENABLED && db && state.activeBoardId && state.currentUser) {
    db.collection('activityLogs').doc(entry.id).set({
      boardId:   state.activeBoardId,
      userId:    state.currentUser.uid,
      action,
      subject,
      timestamp: entry.timestamp,
    }).catch(() => {});
  }
}

function renderActivityLog() {
  const list = document.getElementById('activity-list');
  if (!list) return;
  list.innerHTML = '';

  const entries = state.activityLog.slice(0, 10);
  if (entries.length === 0) {
    list.innerHTML = '<li class="activity-empty">No recent activity.</li>';
    return;
  }

  entries.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    li.innerHTML = `
      <div class="activity-icon" aria-hidden="true"><i data-feather="zap"></i></div>
      <div class="activity-text">
        <strong>${escapeHTML(entry.user)}</strong> ${escapeHTML(entry.action)}
        ${entry.subject ? ` <em>"${escapeHTML(entry.subject)}"</em>` : ''}
      </div>
      <span class="activity-time" title="${new Date(entry.timestamp).toLocaleString()}">${relativeTime(entry.timestamp)}</span>
    `;
    list.appendChild(li);
  });
  feather.replace({ 'stroke-width': 2 });
}

/* ================================================
   SHARE & COLLABORATION
   ================================================ */
function initializeCollaboration() {
  const overlay  = document.getElementById('share-modal-overlay');
  const closeBtn = document.getElementById('share-modal-close');

  document.getElementById('share-btn')?.addEventListener('click', openShareModal);
  closeBtn?.addEventListener('click', () => closeModal('share-modal-overlay'));
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal('share-modal-overlay'); });

  document.getElementById('copy-board-id-btn')?.addEventListener('click', () => {
    const val = document.getElementById('share-board-id-input')?.value || '';
    navigator.clipboard?.writeText(val)
      .then(() => showToast('Board ID copied!', 'success'))
      .catch(() => showToast('Copy failed — please copy manually.', 'error'));
  });

  document.getElementById('invite-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email      = document.getElementById('invite-email')?.value.trim();
    const permission = document.getElementById('invite-permission')?.value;
    const btn        = document.getElementById('invite-submit-btn');
    if (!email) return;
    setBtnLoading(btn, true);
    try {
      await inviteCollaborator(email, permission);
      document.getElementById('invite-form').reset();
    } finally {
      setBtnLoading(btn, false);
    }
  });

  document.getElementById('join-board-btn')?.addEventListener('click', async () => {
    const id = document.getElementById('join-board-id')?.value.trim();
    if (!id) return;
    await joinBoard(id);
    document.getElementById('join-board-id').value = '';
  });
}

function openShareModal() {
  const boardId = state.activeBoardId;
  if (!boardId) { showToast('No active board.', 'error'); return; }
  const input = document.getElementById('share-board-id-input');
  if (input) input.value = boardId;
  renderCollaborators();
  openModal('share-modal-overlay');
}

async function renderCollaborators() {
  const list = document.getElementById('collaborators-list');
  if (!list) return;
  list.innerHTML = '<li style="font-size:.8rem;color:var(--text-muted);padding:4px 0;">Loading…</li>';

  let members = [];
  const board = state.boards.find(b => b.id === state.activeBoardId);

  if (FIREBASE_ENABLED && db && state.activeBoardId) {
    try {
      const snap = await db.collection('boardMembers')
        .where('boardId', '==', state.activeBoardId).get();
      members = snap.docs.map(d => d.data());
    } catch (_) {}
  }

  // Fallback to local collaborators array
  if (!members.length && board?.collaborators?.length) {
    members = board.collaborators;
  }

  list.innerHTML = '';
  if (members.length === 0) {
    list.innerHTML = '<li style="font-size:.8rem;color:var(--text-muted);padding:4px 0;">No collaborators yet. Invite someone below.</li>';
    return;
  }

  members.forEach(m => {
    const li  = document.createElement('li');
    li.className = 'collaborator-item';
    const init = (m.email || '?')[0].toUpperCase();
    li.innerHTML = `
      <div class="collab-avatar" aria-hidden="true">${init}</div>
      <div class="collab-info">
        <div class="collab-email">${escapeHTML(m.email || '—')}</div>
        <div class="collab-perm">${escapeHTML(m.permission || 'viewer')}</div>
      </div>
      <button class="collab-remove" data-email="${escapeHTML(m.email || '')}"
              aria-label="Remove ${escapeHTML(m.email || '')}">
        <i data-feather="user-minus" aria-hidden="true"></i>
      </button>
    `;
    list.appendChild(li);
  });

  feather.replace({ 'stroke-width': 2 });

  list.querySelectorAll('.collab-remove').forEach(btn => {
    btn.addEventListener('click', () => removeCollaborator(btn.dataset.email));
  });
}

async function inviteCollaborator(email, permission) {
  const boardId = state.activeBoardId;
  if (!boardId) return;

  if (FIREBASE_ENABLED && db) {
    try {
      const invId = generateId();
      await db.collection('invitations').doc(invId).set({
        boardId, email, permission,
        invitedBy: state.currentUser?.uid || 'guest',
        createdAt: new Date().toISOString(),
        status:    'pending',
      });
    } catch (err) {
      showToast('Failed to send invite.', 'error');
      return;
    }
  }

  const idx = state.boards.findIndex(b => b.id === boardId);
  if (idx !== -1) {
    if (!state.boards[idx].collaborators) state.boards[idx].collaborators = [];
    if (!state.boards[idx].collaborators.find(c => c.email === email)) {
      state.boards[idx].collaborators.push({ email, permission });
    }
    saveLocalStorage();
  }

  addActivityLog('Invited collaborator', email);
  await renderCollaborators();
  showToast(`Invitation sent to ${email}.`, 'success');
}

async function removeCollaborator(email) {
  const boardId = state.activeBoardId;
  const idx     = state.boards.findIndex(b => b.id === boardId);
  if (idx !== -1 && email) {
    state.boards[idx].collaborators = (state.boards[idx].collaborators || []).filter(c => c.email !== email);
    saveLocalStorage();
  }
  addActivityLog('Removed collaborator', email);
  await renderCollaborators();
  showToast(`${email} removed.`, 'info');
}

async function joinBoard(boardId) {
  if (!boardId) return;
  if (!FIREBASE_ENABLED || !db) { showToast('Firebase required to join shared boards.', 'error'); return; }
  try {
    const doc = await db.collection('boards').doc(boardId).get();
    if (!doc.exists) { showToast('Board not found.', 'error'); return; }
    const board = { id: boardId, ...doc.data() };
    if (!state.boards.find(b => b.id === boardId)) state.boards.push(board);
    state.activeBoardId = boardId;
    saveLocalStorage();
    renderBoardSelector();
    subscribeToBoard(boardId);
    closeModal('share-modal-overlay');
    showToast(`Joined "${board.name}".`, 'success');
  } catch (_) {
    showToast('Failed to join board.', 'error');
  }
}

/* ================================================
   EMAIL SHARE
   ================================================ */
function initEmailShare() {
  document.getElementById('email-share-btn')?.addEventListener('click', () => {
    const tasks = state.tasks.filter(t => t.boardId === state.activeBoardId);
    if (!tasks.length) { showToast('No tasks to share yet.', 'info'); return; }

    const board = state.boards.find(b => b.id === state.activeBoardId);
    let body = `Task Board: ${board?.name || 'My Board'}\n${'='.repeat(50)}\n\n`;

    COLUMNS.forEach(col => {
      const ct = tasks.filter(t => t.column === col);
      if (!ct.length) return;
      body += `${COL_LABELS[col].toUpperCase()}\n${'-'.repeat(30)}\n`;
      ct.forEach((t, i) => {
        const pLabel = (PRIORITY_LABEL[t.priority] || t.priority).replace(/[🔴🟡🟢]/g, '').trim();
        body += `${i + 1}. [${pLabel}] ${t.title}\n`;
        if (t.description) body += `   📝 ${t.description}\n`;
        if (t.dueDate)     body += `   📅 Due: ${t.dueDate}\n`;
        if (t.deadline)    body += `   ⏰ Time: ${t.deadline}\n`;
        if (t.assignedName) body += `   👤 ${t.assignedName}\n`;
      });
      body += '\n';
    });
    body += `\nShared from Life Planner · ${new Date().toLocaleDateString()}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(`Task Board: ${board?.name || 'My Board'}`)}&body=${encodeURIComponent(body)}`;
  });
}

/* ================================================
   SETTINGS MODAL
   ================================================ */
function initializeSettings() {
  const overlay  = document.getElementById('settings-modal-overlay');
  const closeBtn = document.getElementById('settings-modal-close');
  const saveBtn  = document.getElementById('settings-save-btn');

  document.getElementById('settings-btn')?.addEventListener('click', () => {
    document.getElementById('setting-focus').value  = state.settings.focusMins;
    document.getElementById('setting-short').value  = state.settings.shortBreak;
    document.getElementById('setting-long').value   = state.settings.longBreak;
    document.getElementById('setting-dark').checked = state.theme === 'dark';
    openModal('settings-modal-overlay');
  });

  closeBtn?.addEventListener('click', () => closeModal('settings-modal-overlay'));
  overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal('settings-modal-overlay'); });

  saveBtn?.addEventListener('click', () => {
    state.settings.focusMins  = parseInt(document.getElementById('setting-focus').value, 10) || 25;
    state.settings.shortBreak = parseInt(document.getElementById('setting-short').value, 10) || 5;
    state.settings.longBreak  = parseInt(document.getElementById('setting-long').value, 10)  || 15;

    // Sync timer if not running
    state.timerDuration = state.settings.focusMins;
    const durEl = document.getElementById('timer-duration');
    if (durEl) durEl.value = state.timerDuration;
    if (!ui.timerRunning) {
      ui.timerRemaining = state.timerDuration * 60;
      updateTimerDisplay();
    }

    state.theme = document.getElementById('setting-dark').checked ? 'dark' : 'light';
    applyTheme();
    saveLocalStorage();
    closeModal('settings-modal-overlay');
    showToast('Settings saved.', 'success');
  });
}

/* ================================================
   MOBILE TABS & SIDEBAR TOGGLE
   ================================================ */
function showMobileColumn(colName) {
  ui.activeTab = colName;
  COLUMNS.forEach(col => {
    const el = document.getElementById(`col-${col}`);
    if (el) el.classList.toggle('mobile-active', col === colName);
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.col === colName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
}

function initializeMobileTabs() {
  showMobileColumn(ui.activeTab);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showMobileColumn(btn.dataset.col));
  });
}

function initializeSidebarToggle() {
  const sidebar  = document.getElementById('sidebar');
  const mainBody = document.getElementById('main-body');
  if (!sidebar || !mainBody) return;

  const toggleBtn = document.createElement('button');
  toggleBtn.id        = 'sidebar-toggle';
  toggleBtn.className = 'btn btn-ghost btn-sm sidebar-toggle-btn';
  toggleBtn.innerHTML = '<i data-feather="sliders" aria-hidden="true"></i> Widgets';
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.setAttribute('aria-controls', 'sidebar');
  mainBody.insertBefore(toggleBtn, sidebar);

  toggleBtn.addEventListener('click', () => {
    const expanded = sidebar.classList.toggle('expanded');
    toggleBtn.setAttribute('aria-expanded', String(expanded));
    feather.replace({ 'stroke-width': 2 });
  });

  function checkBreakpoint() {
    const isMobile = window.innerWidth <= 768;
    toggleBtn.style.display = isMobile ? 'inline-flex' : 'none';
    if (!isMobile) sidebar.classList.remove('expanded');
  }
  checkBreakpoint();
  window.addEventListener('resize', checkBreakpoint);
  feather.replace({ 'stroke-width': 2 });
}

/* ================================================
   KEYBOARD SHORTCUTS
   ================================================ */
function initializeKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName;
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

    if (e.key === 'Escape') { closeAllModals(); return; }

    if (!isTyping) {
      // N = new task
      if (e.key === 'n') { e.preventDefault(); openTaskModal(); }
      // T = toggle theme
      if (e.key === 't') {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        applyTheme(); saveLocalStorage();
      }
    }
  });
}

/* ================================================
   DRAG & DROP — wire task-list drop zones
   ================================================ */
function initializeDragAndDrop() {
  document.querySelectorAll('.task-list').forEach(list => {
    list.addEventListener('dragover',  (e) => { e.preventDefault(); list.classList.add('drag-over'); });
    list.addEventListener('dragleave', ()  => list.classList.remove('drag-over'));
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      list.classList.remove('drag-over');
      if (ui.draggingTaskId) {
        moveTask(ui.draggingTaskId, list.dataset.col);
        ui.draggingTaskId = null;
      }
    });
  });
}

/* ================================================
   FILTERS
   ================================================ */
function initializeFilters() {
  const myDayBtn    = document.getElementById('filter-myday');
  const assignedBtn = document.getElementById('filter-assigned');

  function toggleFilter(name) {
    ui.activeFilter = ui.activeFilter === name ? null : name;
    myDayBtn?.classList.toggle('active',    ui.activeFilter === 'myday');
    assignedBtn?.classList.toggle('active', ui.activeFilter === 'assigned');
    myDayBtn?.setAttribute('aria-pressed',    String(ui.activeFilter === 'myday'));
    assignedBtn?.setAttribute('aria-pressed', String(ui.activeFilter === 'assigned'));
    renderBoard();
  }

  myDayBtn?.addEventListener('click',    () => toggleFilter('myday'));
  assignedBtn?.addEventListener('click', () => toggleFilter('assigned'));
}

/* ================================================
   SORT
   ================================================ */
function initializeSort() {
  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    ui.sortMode = e.target.value;
    renderBoard();
  });
}

/* ================================================
   PWA INSTALL PROMPT
   ================================================ */
function initializePWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    ui.deferredInstall = e;

    const banner = document.createElement('div');
    banner.className = 'pwa-banner';
    banner.innerHTML = `
      <div class="pwa-banner-text">
        <strong>Install Life Planner</strong>
        <span>Add to your home screen for quick access.</span>
      </div>
      <button class="btn btn-primary btn-sm" id="pwa-install-btn">Install</button>
      <button class="icon-btn" id="pwa-dismiss-btn" aria-label="Dismiss">
        <i data-feather="x" aria-hidden="true"></i>
      </button>
    `;
    document.body.appendChild(banner);
    feather.replace({ 'stroke-width': 2 });

    document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
      if (ui.deferredInstall) { await ui.deferredInstall.prompt(); ui.deferredInstall = null; }
      banner.remove();
    });
    document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => banner.remove());
  });
}

/* ================================================
   REMINDER LOOP — My Day time-based notifications
   ================================================ */
function startReminderLoop() {
  if (ui.reminderChecked) return;
  ui.reminderChecked = true;

  setInterval(() => {
    if (Notification.permission !== 'granted') return;
    const nowHHMM = new Date().toTimeString().slice(0, 5);
    state.mydayItems.forEach(item => {
      if (item.reminder === nowHHMM && !item.done) {
        new Notification(`⏰ Reminder: ${item.title}`, { body: item.note || '' });
      }
    });
  }, 60_000);
}

/* ================================================
   initializeApp — MAIN BOOT SEQUENCE
   ================================================ */
function initializeApp() {
  // 1. Firebase (must be first — sets up auth/db globals)
  initializeFirebase();

  // 2. Restore persisted local data
  loadLocalStorage();

  // 3. Apply saved theme immediately — prevents flash of wrong theme
  document.documentElement.setAttribute('data-theme', state.theme);

  // 4. Start clock (runs on both auth screen and main app)
  startClock();

  // 5. Auth wiring (shows auth screen or app based on Firebase session)
  initializeAuth();

  // 6. All other app modules
  initializeTheme();
  initNameEditor();
  initializePomodoro();
  initMyday();
  initializeQuickLinks();
  initializeTasks();
  initializeDragAndDrop();
  initializeFilters();
  initializeSort();
  initializeSearch();
  initializeCollaboration();
  initEmailShare();
  initializeSettings();
  initializeBoards();
  initializeMobileTabs();
  initializeSidebarToggle();
  initializeKeyboardShortcuts();
  initializePWA();

  // 7. Initial data renders (for guest / already-loaded state)
  renderActivityLog();

  // 8. Background reminder checker
  startReminderLoop();

  // 9. Replace all feather icon placeholders with SVGs
  feather.replace({ 'stroke-width': 2 });

  console.info('Life Planner booted ✓ | Firebase:', FIREBASE_ENABLED ? 'enabled' : 'local-only');
}

// Boot when the DOM is fully parsed
document.addEventListener('DOMContentLoaded', initializeApp);
