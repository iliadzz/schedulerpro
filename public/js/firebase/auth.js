// js/firebase/auth.js
import { setCurrentUser } from '../state.js';
import { applyRbacPermissions, resetAppInitialization } from '../main.js';
import { cleanupDataListeners } from './firestore.js';

/**
 * Sets up all Firebase Authentication listeners and login form handlers.
 * This function acts as the entry point for the application's auth flow.
 */
export function setupAuthListeners() {
    const appContainer = document.querySelector('.app-container');
    const loginContainer = document.getElementById('login-container');
    const exitBtn = document.getElementById('exit-btn');

    const showLogin = () => {
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    };

    const showApp = () => {
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
    };

    // Listen for changes in the user's login state
    if (window.auth) {
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in. Force a token refresh to get the latest custom claims.
                const idTokenResult = await user.getIdTokenResult(true);

                // Combine Firestore profile with token claims for the complete user object.
                const userProfile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    claims: idTokenResult.claims // This now holds all our permissions!
                };
                setCurrentUser(userProfile);

                // Apply permissions BEFORE initializing the app
                applyRbacPermissions();

                showApp();

                // Call the main app initialization function (defined in main.js)
                if (window.__startApp) {
                    window.__startApp();
                }
            } else {
                // User is signed out.
                setCurrentUser(null);
                cleanupDataListeners();      // 1. Clean up old listeners
                resetAppInitialization();    // 2. Reset the app flag
                showLogin();                 // 3. Show the login screen
            }
        });
    } else {
        // This allows for offline or auth-less development.
        console.warn("Firebase Auth not found. Running in offline mode.");
        const offlineUser = {
            displayName: 'Offline Admin',
            claims: { role: 'General Manager', is_gm: true, manage_settings: true, manage_roles: true, manage_employees: true, edit_schedule: true, view_schedule: true }
        };
        setCurrentUser(offlineUser);
        applyRbacPermissions();
        showApp();
        if (window.__startApp) {
            window.__startApp();
        }
    }


    // --- Login Form Event Listeners ---
    loginContainer.addEventListener('click', (e) => {
        if (!window.auth) return;

        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const errorMsg = document.getElementById('login-error-message');
        const email = emailInput.value || '';
        const pwd = passwordInput.value || '';

        if (e.target && e.target.id === 'login-btn') {
            window.auth.signInWithEmailAndPassword(email, pwd)
                .catch(err => {
                    if (errorMsg) errorMsg.textContent = err.message;
                });
        }
    });


    // --- Logout Button ---
    if (exitBtn) {
        exitBtn.addEventListener('click', () => {
            if (window.auth) {
                // The onAuthStateChanged listener above will handle the cleanup
                window.auth.signOut();
            }
        });
    }
}