// js/state.js

import { markDirtyKey, markDirtyAssignment } from './firebase/firestore.js';

const debounce = (func, wait = 400) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
};

// --- Core Data Collections ---
export let departments = JSON.parse(localStorage.getItem('departments')) || [];
export let roles = JSON.parse(localStorage.getItem('roles')) || [];
export let users = JSON.parse(localStorage.getItem('users')) || [];
export let shiftTemplates = JSON.parse(localStorage.getItem('shiftTemplates')) || [];
export let scheduleAssignments = JSON.parse(localStorage.getItem('scheduleAssignments')) || {};
export let events = JSON.parse(localStorage.getItem('events')) || [];
export let restaurantSettings = JSON.parse(localStorage.getItem('restaurantSettings')) || {};

// --- Logged-in User State ---
export let currentUser = null; 

export function setCurrentUser(user) {
    currentUser = user;
}

// --- Save Functions ---
// --- FIX: All save functions now write to localStorage and then mark the key as "dirty" for the sync engine ---

export function saveDepartments() {
    localStorage.setItem('departments', JSON.stringify(departments));
    markDirtyKey('departments');
};

export function saveRoles() {
    localStorage.setItem('roles', JSON.stringify(roles));
    markDirtyKey('roles');
}

export function saveUsers() {
    localStorage.setItem('users', JSON.stringify(users));
    markDirtyKey('users');
}

export function saveShiftTemplates() {
    localStorage.setItem('shiftTemplates', JSON.stringify(shiftTemplates));
    markDirtyKey('shiftTemplates');
}

// Special handling for schedule assignments to track individual doc changes
export function saveScheduleAssignments(updatedDocIds = []) {
    localStorage.setItem('scheduleAssignments', JSON.stringify(scheduleAssignments));
    if (updatedDocIds.length > 0) {
        updatedDocIds.forEach(id => markDirtyAssignment(id));
    } else {
        // If no specific IDs are provided, we have to mark the whole collection dirty.
        // This is a fallback and should be avoided if possible.
        markDirtyKey('scheduleAssignments');
    }
}

export function saveEvents() {
    localStorage.setItem('events', JSON.stringify(events));
    markDirtyKey('events');
}

export function saveRestaurantSettings() {
    localStorage.setItem('restaurantSettings', JSON.stringify(restaurantSettings));
    markDirtyKey('restaurantSettings');
}


export function saveCurrentViewDate() {
    localStorage.setItem('schedulerCurrentViewDate', currentViewDate.toISOString());
}


// --- Application UI State ---
const savedDate = localStorage.getItem('schedulerCurrentViewDate');
export let currentViewDate = savedDate ? new Date(savedDate) : new Date();

export let weekStartsOnMonday = true;
export let selectedDepartmentIds = ['all'];
export let copiedShiftDetails = null;
export let draggedShiftDetails = null;
export let draggedEmployeeRowInfo = null;
export let draggedShiftTemplateInfo = null;
export let draggedRoleInfo = null;
export let draggedDepartmentInfo = null;
export let currentAssignMode = 'template';
export let editingAssignmentDetails = null;
export let copyConflictQueue = [];
export let currentConflictResolver = null;
export let tempEventSpecificDates = [];
export let clearWeekContext = { usersToClear: [], datesToClear: [] };

// --- Constants ---
export const DEFAULT_VACATION_DAYS = 0;
export const EVENT_COLORS = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'];
export const terminationReasons = [
    "Resigned",
    "Terminated",
    "Contract Ended",
    "Retired",
    "Other"
];