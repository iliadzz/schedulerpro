// This file isolates all your Firebase Authentication logic. It handles showing the login screen,
// processing sign-in and sign-up attempts, listening for authentication state changes, and logging the user out. It acts as the "gatekeeper" for your application.
// js/firebase/auth.js
import { users, setCurrentUser } from '../state.js';
import { applyRbacPermissions } from '../main.js';

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
                // User is signed in. Directly fetch their profile from Firestore.
                try {
                    const userQuery = await window.db.collection('users').where('email', '==', user.email).limit(1).get();
                    if (!userQuery.empty) {
                        const userProfile = { id: userQuery.docs[0].id, ...userQuery.docs[0].data() };
                        setCurrentUser(userProfile);
                    } else {
                        console.warn(`No profile found for ${user.email}, defaulting to restricted view.`);
                        setCurrentUser({ email: user.email, role: 'User' });
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    setCurrentUser({ email: user.email, role: 'User' });
                }

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
                showLogin();
            }
        });
    } else {
        // This allows for offline or auth-less development.
        console.warn("Firebase Auth not found. Running in offline mode.");
        setCurrentUser({ role: 'General Manager', displayName: 'Offline Admin' }); // Give full access for offline dev
        applyRbacPermissions();
        showApp();
        if (window.__startApp) {
            window.__startApp();
        }
    }


    // --- Login Form Event Listeners ---

    // Using a single listener on the login container for efficiency
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
                window.auth.signOut();
            }
        });
    }
}