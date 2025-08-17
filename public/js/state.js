// js/state.js

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

// --- THIS IS THE FIX ---
// Before saving, we now loop through the departments array and explicitly assign
// a 'sortOrder' property based on the item's current index in the array.
// This ensures that the user's custom drag-and-drop order is persisted.
const _saveDepartments = () => {
    departments.forEach((dept, index) => {
        dept.sortOrder = index;
    });
    localStorage.setItem('departments', JSON.stringify(departments));
};
export const saveDepartments = debounce(_saveDepartments, 500);


const _saveRoles = () => localStorage.setItem('roles', JSON.stringify(roles));
export const saveRoles = debounce(_saveRoles, 500);

const _saveUsers = () => localStorage.setItem('users', JSON.stringify(users));
export const saveUsers = debounce(_saveUsers, 500);

const _saveShiftTemplates = () => localStorage.setItem('shiftTemplates', JSON.stringify(shiftTemplates));
export const saveShiftTemplates = debounce(_saveShiftTemplates, 500);

const _saveScheduleAssignments = () => localStorage.setItem('scheduleAssignments', JSON.stringify(scheduleAssignments));
export const saveScheduleAssignments = debounce(_saveScheduleAssignments, 500);

const _saveEvents = () => localStorage.setItem('events', JSON.stringify(events));
export const saveEvents = debounce(_saveEvents, 500);

const _saveRestaurantSettings = () => localStorage.setItem('restaurantSettings', JSON.stringify(restaurantSettings));
export const saveRestaurantSettings = debounce(_saveRestaurantSettings, 500);


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