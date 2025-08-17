// js/firebase/firestore.js

// 1. Import dependencies
import {
    departments,
    roles,
    users,
    shiftTemplates,
    events,
    scheduleAssignments,
    restaurantSettings
} from '../state.js';
import { renderDepartments } from '../ui/departments.js';
import { renderRoles } from '../ui/roles.js';
import { renderEmployees } from '../ui/employees.js';
import { renderShiftTemplates } from '../ui/shifts.js';
import { renderWeeklySchedule } from '../ui/scheduler.js';
import { initSettingsTab } from '../ui/settings.js';

// --- Module-level variables ---
const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
// --- CHANGE: Array to hold all the unsubscribe functions from our listeners ---
let activeListeners = [];

// --- Private Helper Function ---
async function syncCollectionToFirestore(collectionName, localData) {
    if (!window.db) return;

    const collectionRef = window.db.collection(collectionName);
    const batch = window.db.batch();

    const snapshot = await collectionRef.get();
    const firestoreIds = new Set(snapshot.docs.map(doc => doc.id));
    const localIds = new Set(localData.map(item => String(item.id)));

    firestoreIds.forEach(id => {
        if (!localIds.has(id)) {
            batch.delete(collectionRef.doc(id));
        }
    });

    localData.forEach(item => {
        const docId = String(item.id);
        const docRef = collectionRef.doc(docId);
        batch.set(docRef, item);
    });

    await batch.commit();
}


// --- Exported Main Functions ---

export function initializeSync() {
    const syncableKeys = ['users', 'departments', 'roles', 'events', 'shiftTemplates', 'scheduleAssignments', 'restaurantSettings'];

    window.localStorage.setItem = function(key, value) {
        originalSetItem(key, value); 

        if (!syncableKeys.includes(key) || !window.db) {
            return;
        }

        try {
            const data = JSON.parse(value);

            if (key === 'restaurantSettings') {
                window.db.collection('settings').doc('main').set(data || {}, { merge: true });
            } else if (key === 'scheduleAssignments' && data && typeof data === 'object') {
                const batch = window.db.batch();
                Object.keys(data).forEach(docId => {
                    batch.set(window.db.collection('scheduleAssignments').doc(docId), data[docId] || {});
                });
                batch.commit();
            } else if (Array.isArray(data)) {
                syncCollectionToFirestore(key, data);
            }
        } catch (e) {
            console.error(`Error syncing to Firestore for key "${key}":`, e);
        }
    };
}

/**
 * --- NEW FUNCTION ---
 * Detaches all active Firestore listeners. This is called on logout or tab close.
 */
export function cleanupDataListeners() {
    console.log(`Cleaning up ${activeListeners.length} Firestore listeners.`);
    activeListeners.forEach(unsubscribe => unsubscribe());
    activeListeners = []; // Clear the array
}

/**
 * Sets up real-time listeners on all Firestore collections.
 * --- CHANGE: Now prevents re-attaching listeners and adds them to a managed array. ---
 */
export function initializeDataListeners() {
    if (!window.db || activeListeners.length > 0) {
        // Prevent re-attaching if listeners are already active
        return;
    }

    const renderAll = () => {
        renderDepartments();
        renderRoles();
        renderShiftTemplates();
        renderEmployees();
        initSettingsTab();
        renderWeeklySchedule();
    };

    // --- CHANGE: Each listener is now pushed to the activeListeners array for cleanup. ---
    // --- Also, each listener now has the 'hasPendingWrites' guard. ---
    activeListeners.push(
        window.db.collection('departments').onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) return; // Prevent feedback loop
            console.log("Firestore: Departments updated.");
            const updatedData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            departments.length = 0;
            Array.prototype.push.apply(departments, updatedData);
            originalSetItem('departments', JSON.stringify(departments));
            renderAll();
        })
    );

    activeListeners.push(
        window.db.collection('roles').onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) return;
            console.log("Firestore: Roles updated.");
            const updatedData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            roles.length = 0;
            Array.prototype.push.apply(roles, updatedData);
            originalSetItem('roles', JSON.stringify(roles));
            renderAll();
        })
    );

    activeListeners.push(
        window.db.collection('users').onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) return;
            console.log("Firestore: Users updated.");
            const updatedData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            users.length = 0;
            Array.prototype.push.apply(users, updatedData);
            originalSetItem('users', JSON.stringify(users));
            renderAll();
        })
    );

    activeListeners.push(
        window.db.collection('shiftTemplates').onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) return;
            console.log("Firestore: Shift Templates updated.");
            const updatedData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            shiftTemplates.length = 0;
            Array.prototype.push.apply(shiftTemplates, updatedData);
            originalSetItem('shiftTemplates', JSON.stringify(shiftTemplates));
            renderAll();
        })
    );

    activeListeners.push(
        window.db.collection('events').onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) return;
            console.log("Firestore: Events updated.");
            const updatedData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            events.length = 0;
            Array.prototype.push.apply(events, updatedData);
            originalSetItem('events', JSON.stringify(events));
            renderWeeklySchedule();
        })
    );

    activeListeners.push(
        window.db.collection('scheduleAssignments').onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) return;
            console.log("Firestore: Schedule updated.");
            Object.keys(scheduleAssignments).forEach(key => delete scheduleAssignments[key]);
            snapshot.forEach(doc => { scheduleAssignments[doc.id] = doc.data() });
            originalSetItem('scheduleAssignments', JSON.stringify(scheduleAssignments));
            renderWeeklySchedule();
        })
    );

    activeListeners.push(
        window.db.collection('settings').doc('main').onSnapshot(doc => {
            if (doc.metadata.hasPendingWrites) return;
            console.log("Firestore: Settings updated.");
            const newSettings = doc.exists ? doc.data() : {};
            Object.keys(restaurantSettings).forEach(key => delete restaurantSettings[key]);
            Object.assign(restaurantSettings, newSettings);
            originalSetItem('restaurantSettings', JSON.stringify(restaurantSettings));
            initSettingsTab();
            renderWeeklySchedule();
        })
    );
}