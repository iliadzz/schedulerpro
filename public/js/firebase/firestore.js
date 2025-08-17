// js/firebase/firestore.js

// 1. Import Dependencies
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
let activeListeners = [];

// --- CHANGE: New helper function to prevent redundant localStorage writes ---
/**
 * Safely sets an item in localStorage, but only if the new value is different from the existing value.
 * This prevents unnecessary UI re-renders triggered by identical data updates from Firestore.
 * @param {string} key The localStorage key.
 * @param {object} valueObj The JavaScript object to store.
 */
function safeSetLocal(key, valueObj) {
  const nextValue = JSON.stringify(valueObj ?? {});
  const previousValue = localStorage.getItem(key);
  if (previousValue === nextValue) {
      // If the data hasn't changed, do nothing.
      return;
  }
  // Otherwise, update localStorage.
  originalSetItem(key, nextValue);
}


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

export function cleanupDataListeners() {
    console.log(`Cleaning up ${activeListeners.length} Firestore listeners.`);
    activeListeners.forEach(unsubscribe => unsubscribe());
    activeListeners = [];
}

export function initializeDataListeners() {
    if (!window.db || activeListeners.length > 0) {
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

    activeListeners.push(
        window.db.collection('departments').onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) return;
            console.log("Firestore: Departments updated.");
            const updatedData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            departments.length = 0;
            Array.prototype.push.apply(departments, updatedData);
            // --- CHANGE: Use safeSetLocal to avoid unnecessary writes and UI thrash ---
            safeSetLocal('departments', departments);
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
            safeSetLocal('roles', roles);
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
            safeSetLocal('users', users);
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
            safeSetLocal('shiftTemplates', shiftTemplates);
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
            safeSetLocal('events', events);
            renderWeeklySchedule();
        })
    );

    activeListeners.push(
        window.db.collection('scheduleAssignments').onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) return;
            console.log("Firestore: Schedule updated.");
            Object.keys(scheduleAssignments).forEach(key => delete scheduleAssignments[key]);
            snapshot.forEach(doc => { scheduleAssignments[doc.id] = doc.data() });
            safeSetLocal('scheduleAssignments', scheduleAssignments);
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
            safeSetLocal('restaurantSettings', restaurantSettings);
            initSettingsTab();
            renderWeeklySchedule();
        })
    );
}