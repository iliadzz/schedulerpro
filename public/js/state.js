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
export const saveDepartments = debounce(() => {
    departments.forEach((dept, index) => {
        dept.sortOrder = index;
    });
    localStorage.setItem('departments', JSON.stringify(departments));
    markDirtyKey('departments');
});

export const saveRoles = debounce(() => {
    localStorage.setItem('roles', JSON.stringify(roles));
    markDirtyKey('roles');
}, 500);

export const saveUsers = debounce(() => {
    localStorage.setItem('users', JSON.stringify(users));
    markDirtyKey('users');
}, 500);

export const saveShiftTemplates = debounce(() => {
    localStorage.setItem('shiftTemplates', JSON.stringify(shiftTemplates));
    markDirtyKey('shiftTemplates');
}, 500);

export const saveScheduleAssignments = debounce((updatedDocIds = []) => {
    localStorage.setItem('scheduleAssignments', JSON.stringify(scheduleAssignments));
    if (Array.isArray(updatedDocIds) && updatedDocIds.length) {
        updatedDocIds.forEach(id => markDirtyAssignment(id));
    } else {
        // Fallback for safety, though passing IDs is preferred
        markDirtyKey('scheduleAssignments');
    }
}, 500);

export const saveEvents = debounce(() => {
    localStorage.setItem('events', JSON.stringify(events));
    markDirtyKey('events');
}, 500);

export const saveRestaurantSettings = debounce(() => {
    localStorage.setItem('restaurantSettings', JSON.stringify(restaurantSettings));
    markDirtyKey('restaurantSettings');
}, 500);


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