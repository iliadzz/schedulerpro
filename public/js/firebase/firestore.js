// js/firebase/firestore.js

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


// --- NEW SYNC ENGINE ---

const DIRTY_KEYS = new Set();
const DIRTY_ASSIGNMENTS = new Set();
let flushTimer = null;
let isInitialHydrationComplete = false;

/**
 * Marks a top-level data collection (like 'users' or 'roles') as needing a sync.
 * @param {string} key The key of the collection to sync.
 */
export function markDirtyKey(key) {
  DIRTY_KEYS.add(key);
  scheduleFlush();
}

/**
 * Marks a specific schedule assignment document as needing a sync.
 * @param {string} docId The document ID (e.g., "userId-YYYY-MM-DD").
 */
export function markDirtyAssignment(docId) {
  DIRTY_KEYS.add('scheduleAssignments');
  DIRTY_ASSIGNMENTS.add(docId);
  scheduleFlush();
}

/**
 * Schedules a single, coalesced flush to Firestore after a short delay.
 * This prevents multiple rapid changes from causing a "write storm".
 */
function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  // Using a 3-second delay to safely batch multiple user actions
  flushTimer = setTimeout(flushDirtyToFirestore, 3000);
}

/**
 * Chunks an array into smaller arrays of a specified size.
 * Firestore batches are limited to 500 operations.
 * @param {Array} arr The array to chunk.
 * @param {number} size The size of each chunk.
 * @returns {Array<Array>} An array of smaller arrays.
 */
function chunk(arr, size) {
    const chunked = [];
    for (let i = 0; i < arr.length; i += size) {
        chunked.push(arr.slice(i, i + size));
    }
    return chunked;
}

/**
 * The core function that takes all "dirty" data and syncs it to Firestore.
 */
async function flushDirtyToFirestore() {
    if (DIRTY_KEYS.size === 0) return;

    console.log(`[SYNC] Starting flush for dirty keys:`, [...DIRTY_KEYS]);
    const keysToFlush = Array.from(DIRTY_KEYS);
    DIRTY_KEYS.clear();

    for (const key of keysToFlush) {
        try {
            if (key === 'scheduleAssignments') {
                const idsToSync = Array.from(DIRTY_ASSIGNMENTS);
                DIRTY_ASSIGNMENTS.clear();
                
                // Chunk the assignment writes into batches of 450 to be safe
                for (const idChunk of chunk(idsToSync, 450)) {
                    const batch = window.db.batch();
                    idChunk.forEach(docId => {
                        const docData = scheduleAssignments[docId];
                        const docRef = window.db.collection('scheduleAssignments').doc(docId);
                        if (docData && docData.shifts && docData.shifts.length > 0) {
                            batch.set(docRef, docData);
                        } else {
                            // If the local data for this ID is empty or gone, delete it.
                            batch.delete(docRef);
                        }
                    });
                    await batch.commit();
                    console.log(`[SYNC] Flushed ${idChunk.length} schedule assignment changes.`);
                }
            } else if (key === 'restaurantSettings') {
                const docRef = window.db.collection('settings').doc('main');
                await docRef.set(restaurantSettings, { merge: true });
                console.log(`[SYNC] Flushed settings.`);
            } else {
                // Handle collection syncs (users, roles, etc.)
                const localData = { users, departments, roles, events, shiftTemplates }[key];
                if (localData) {
                    await syncCollectionWithDiff(key, localData);
                }
            }
        } catch (error) {
            console.error(`[SYNC] Error flushing key "${key}":`, error);
        }
    }
}

/**
 * A safer sync function for collections that only adds/updates documents.
 * It explicitly avoids deleting documents from Firestore just because they are missing locally.
 * @param {string} collectionName The name of the collection to sync.
 * @param {Array<object>} localData The complete array of local data.
 */
async function syncCollectionWithDiff(collectionName, localData) {
    if (!window.db) return;

    const collectionRef = window.db.collection(collectionName);
    
    // For simplicity in this patch, we will just write all docs.
    // A more advanced implementation would compare hashes before writing.
    const chunks = chunk(localData, 450);

    for (const docChunk of chunks) {
        const batch = window.db.batch();
        docChunk.forEach(item => {
            const docRef = collectionRef.doc(String(item.id));
            batch.set(docRef, item);
        });
        await batch.commit();
    }
    console.log(`[SYNC] Flushed ${localData.length} documents for collection "${collectionName}".`);
}


// --- REAL-TIME LISTENERS (Largely unchanged, but now safer) ---

const originalSetItem = window.localStorage.setItem.bind(window.localStorage);

function safeSetLocal(key, valueObj) {
  const nextValue = JSON.stringify(valueObj ?? {});
  const previousValue = localStorage.getItem(key);
  if (previousValue === nextValue) return;
  originalSetItem(key, nextValue);
}

let activeListeners = [];

export function cleanupDataListeners() {
    console.log(`Cleaning up ${activeListeners.length} Firestore listeners.`);
    activeListeners.forEach(unsubscribe => unsubscribe());
    activeListeners = [];
    isInitialHydrationComplete = false; // Reset hydration flag
}

export function initializeDataListeners() {
    if (!window.db || activeListeners.length > 0) return;

    const renderAll = () => {
        renderDepartments();
        renderRoles();
        renderShiftTemplates();
        renderEmployees();
        initSettingsTab();
        renderWeeklySchedule();
    };

    const collectionsToSync = ['departments', 'roles', 'users', 'shiftTemplates', 'events'];
    
    collectionsToSync.forEach(collection => {
        activeListeners.push(
            window.db.collection(collection).onSnapshot(snapshot => {
                if (snapshot.metadata.hasPendingWrites) return;
                console.log(`Firestore: ${collection} updated.`);
                const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                
                // Directly update the in-memory state
                const stateArray = { departments, roles, users, shiftTemplates, events }[collection];
                stateArray.length = 0;
                Array.prototype.push.apply(stateArray, data);

                safeSetLocal(collection, data);
                renderAll();
            })
        );
    });

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
            
            // Mark initial hydration as complete after the last listener gets data
            isInitialHydrationComplete = true; 
        })
    );
}

// THIS is the replacement for the old initializeSync function. It no longer overrides localStorage.setItem.
export function initializeSync() {
    console.log("Sync engine initialized. Manual flushing is now active.");
}