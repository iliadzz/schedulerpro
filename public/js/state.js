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
let departments = JSON.parse(localStorage.getItem('departments')) || [];
let roles = JSON.parse(localStorage.getItem('roles')) || [];
let users = JSON.parse(localStorage.getItem('users')) || [];
let shiftTemplates = JSON.parse(localStorage.getItem('shiftTemplates')) || [];
let scheduleAssignments = JSON.parse(localStorage.getItem('scheduleAssignments')) || {};
let events = JSON.parse(localStorage.getItem('events')) || [];
let restaurantSettings = JSON.parse(localStorage.getItem('restaurantSettings')) || {};

// --- Logged-in User State ---
let currentUser = null; 

function setCurrentUser(user) {
    currentUser = user;
}

// --- Save Functions ---
const saveDepartments = debounce(() => {
    departments.forEach((dept, index) => {
        dept.sortOrder = index;
    });
    localStorage.setItem('departments', JSON.stringify(departments));
    markDirtyKey('departments');
});

const saveRoles = debounce(() => {
    localStorage.setItem('roles', JSON.stringify(roles));
    markDirtyKey('roles');
}, 500);

const saveUsers = debounce(() => {
    localStorage.setItem('users', JSON.stringify(users));
    markDirtyKey('users');
}, 500);

const saveShiftTemplates = debounce(() => {
    localStorage.setItem('shiftTemplates', JSON.stringify(shiftTemplates));
    markDirtyKey('shiftTemplates');
}, 500);

const saveScheduleAssignments = debounce((updatedDocIds = []) => {
    localStorage.setItem('scheduleAssignments', JSON.stringify(scheduleAssignments));
    if (Array.isArray(updatedDocIds) && updatedDocIds.length) {
        updatedDocIds.forEach(id => markDirtyAssignment(id));
    } else {
        // Fallback for safety, though passing IDs is preferred
        markDirtyKey('scheduleAssignments');
    }
}, 500);

const saveEvents = debounce(() => {
    localStorage.setItem('events', JSON.stringify(events));
    markDirtyKey('events');
}, 500);

const saveRestaurantSettings = debounce(() => {
    localStorage.setItem('restaurantSettings', JSON.stringify(restaurantSettings));
    markDirtyKey('restaurantSettings');
}, 500);


function saveCurrentViewDate() {
    localStorage.setItem('schedulerCurrentViewDate', currentViewDate.toISOString());
}

// --- Safe setter to replace the entire Y/M/D and persist it ---
function setCurrentViewDate(d) {
    const normalized = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    currentViewDate = normalized;
    try {
        saveCurrentViewDate();
    } catch (e) {
        // no-op
    }
}


// --- Function to save the chosen employee display format ---
function saveEmployeeDisplayFormat() {
    localStorage.setItem('employeeDisplayFormat', employeeDisplayFormat);
}


// --- Application UI State ---
const savedDate = localStorage.getItem('schedulerCurrentViewDate');
let currentViewDate = savedDate ? new Date(savedDate) : new Date();

// --- The display format is now loaded from localStorage and exported ---
let employeeDisplayFormat = localStorage.getItem('employeeDisplayFormat') || 'LF'; // Default to 'Last, First'

// --- NEW: Week start day is now derived from restaurantSettings ---
// It provides a centralized, dynamic way to control the calendar view.
// Defaults to 'mon' (Monday) if not set in the settings.
const weekStartsOn = () => restaurantSettings.weekStartDay || 'mon';

let selectedDepartmentIds = ['all'];
let copiedShiftDetails = null;
let draggedShiftDetails = null;
let draggedEmployeeRowInfo = null;
let draggedShiftTemplateInfo = null;
let draggedRoleInfo = null;
let draggedDepartmentInfo = null;
let currentAssignMode = 'template';
let editingAssignmentDetails = null;
let copyConflictQueue = [];
let currentConflictResolver = null;
let tempEventSpecificDates = [];
let clearWeekContext = { usersToClear: [], datesToClear: [] };

// --- Constants ---
const DEFAULT_VACATION_DAYS = 0;
const EVENT_COLORS = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'];
const terminationReasons = [
    "Resigned",
    "Terminated",
    "Contract Ended",
    "Retired",
    "Other"
];

export {
    departments,
    roles,
    users,
    shiftTemplates,
    scheduleAssignments,
    events,
    restaurantSettings,
    currentUser,
    setCurrentUser,
    saveDepartments,
    saveRoles,
    saveUsers,
    saveShiftTemplates,
    saveScheduleAssignments,
    saveEvents,
    saveRestaurantSettings,
    saveCurrentViewDate,
    setCurrentViewDate,
    saveEmployeeDisplayFormat,
    currentViewDate,
    employeeDisplayFormat,
    weekStartsOn,
    selectedDepartmentIds,
    copiedShiftDetails,
    draggedShiftDetails,
    draggedEmployeeRowInfo,
    draggedShiftTemplateInfo,
    draggedRoleInfo,
    draggedDepartmentInfo,
    currentAssignMode,
    editingAssignmentDetails,
    copyConflictQueue,
    currentConflictResolver,
    tempEventSpecificDates,
    clearWeekContext,
    DEFAULT_VACATION_DAYS,
    EVENT_COLORS,
    terminationReasons
};};