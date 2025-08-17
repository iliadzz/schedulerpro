// js/state.js

import { markDirtyKey, markDirtyAssignment } from './firebase/firestore.js';

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

// --- Debounced localStorage Persistence ---

// This is a helper function that creates a debounced version of a function.
const debounce = (func, wait = 400) => {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
};

// We create debounced functions specifically for writing to localStorage.
// This prevents the application from writing to the disk too frequently, which can be slow.
const persistDepartments = debounce(() => localStorage.setItem('departments', JSON.stringify(departments)), 500);
const persistRoles = debounce(() => localStorage.setItem('roles', JSON.stringify(roles)), 500);
const persistUsers = debounce(() => localStorage.setItem('users', JSON.stringify(users)), 500);
const persistShiftTemplates = debounce(() => localStorage.setItem('shiftTemplates', JSON.stringify(shiftTemplates)), 500);
const persistScheduleAssignments = debounce(() => localStorage.setItem('scheduleAssignments', JSON.stringify(scheduleAssignments)), 300);
const persistEvents = debounce(() => localStorage.setItem('events', JSON.stringify(events)), 500);
const persistRestaurantSettings = debounce(() => localStorage.setItem('restaurantSettings', JSON.stringify(restaurantSettings)), 500);


// --- Public Save Functions ---

// These functions are called from other parts of the app.
// They now do two things:
// 1. Immediately mark the data as "dirty" for Firestore synchronization.
// 2. Call the debounced function to save the data to localStorage.

export function saveDepartments() {
    departments.forEach((dept, index) => {
        dept.sortOrder = index;
    });
    markDirtyKey('departments');
    persistDepartments();
};

export function saveRoles() {
    markDirtyKey('roles');
    persistRoles();
}

export function saveUsers() {
    markDirtyKey('users');
    persistUsers();
}

export function saveShiftTemplates() {
    markDirtyKey('shiftTemplates');
    persistShiftTemplates();
}

/**
 * Saves schedule assignments. This is the key function that was fixed.
 * It now immediately marks individual document IDs as dirty for Firestore,
 * ensuring that no updates are lost during rapid operations like clearing a week.
 * @param {string[]} [updatedDocIds=[]] - An array of specific document IDs that have changed.
 */
export function saveScheduleAssignments(updatedDocIds = []) {
  // Mark Firestore dirty IMMEDIATELY so we don’t lose IDs across rapid calls.
  if (Array.isArray(updatedDocIds) && updatedDocIds.length) {
    updatedDocIds.forEach(id => markDirtyAssignment(id));
  } else {
    // Fallback if a caller forgets to pass IDs.
    markDirtyKey('scheduleAssignments');
  }
  
  // Persist the entire schedule to localStorage (this action is debounced).
  persistScheduleAssignments();
}

export function saveEvents() {
    markDirtyKey('events');
    persistEvents();
}

export function saveRestaurantSettings() {
    markDirtyKey('restaurantSettings');
    persistRestaurantSettings();
}

export function saveCurrentViewDate() {
    localStorage.setItem('schedulerCurrentViewDate', currentViewDate.toISOString());
}

// --- Function to save the chosen employee display format ---
export function saveEmployeeDisplayFormat() {
    localStorage.setItem('employeeDisplayFormat', employeeDisplayFormat);
}


// --- Application UI State ---
const savedDate = localStorage.getItem('schedulerCurrentViewDate');
export let currentViewDate = savedDate ? new Date(savedDate) : new Date();

// --- The display format is now loaded from localStorage and exported ---
export let employeeDisplayFormat = localStorage.getItem('employeeDisplayFormat') || 'LF'; // Default to 'Last, First'

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