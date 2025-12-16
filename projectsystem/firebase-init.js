/**
 * Firebase Initialization
 *
 * This file initializes Firebase services and provides global helper functions
 * for authentication operations. It expects:
 * - Firebase SDK (compat version) to be loaded
 * - window.__FIREBASE_CONFIG__ to be set (from firebase-config.js)
 *
 * Global Helpers Available After Initialization:
 *   - siasystemSignIn(email, password)  - Sign in with email/password
 *   - siasystemCreateUser(email, password) - Create new user account
 *   - siasystemSignOut() - Sign out current user
 *   - siasystemOnAuth(callback) - Listen for auth state changes
 *
 * @requires firebase-config.js (must be loaded first)
 */

(function () {
  if (typeof window === 'undefined') return;

  if (!window.firebase) {
    console.warn('Firebase SDK not detected. Include Firebase CDN scripts before firebase-init.js');
    return;
  }

  if (!window.__FIREBASE_CONFIG__) {
    console.error('No firebase config found. Create/edit firebase-config.js');
    return;
  }

  try {
    const app = firebase.initializeApp(window.__FIREBASE_CONFIG__);
    window._firebaseApp = app;
    window._firebaseAuth = firebase.auth();
    window._firebaseDB = firebase.database();

    // Helper: sign in with email/password. Returns a Promise.
    window.siasystemSignIn = function (email, password) {
      return window._firebaseAuth.signInWithEmailAndPassword(email, password);
    };

    // Helper: create user with email/password. Returns a Promise.
    window.siasystemCreateUser = function (email, password) {
      return window._firebaseAuth.createUserWithEmailAndPassword(email, password);
    };

    // Helper: sign out
    window.siasystemSignOut = function () {
      return window._firebaseAuth.signOut();
    };

    // Simple `onAuthStateChanged` hook you can attach to for redirects
    window.siasystemOnAuth = function (cb) {
      return window._firebaseAuth.onAuthStateChanged(cb);
    };

    console.log('Firebase initialized (firebase-init.js)');
  } catch (e) {
    console.error('Error initializing Firebase:', e);
  }

})();
