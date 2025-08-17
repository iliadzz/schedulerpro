// js/ui/departments.js

/**
 * @file Manages all UI interactions for the 'Departments' tab.
 * This includes creating, editing, deleting, and reordering departments.
 * It also handles the department-based filtering functionality on the main scheduler view.
 * Note: All drag-and-drop logic for list reordering is handled by the generic `makeListSortable` function.
 */

// --- 1. IMPORT MODULES ---
// Import shared application state (data arrays and save functions).
import { departments, users, roles, shiftTemplates, restaurantSettings, saveDepartments, saveUsers, saveRoles, saveShiftTemplates } from '../state.js';
// Import DOM element references for cleaner code.
import * as dom from '../dom.js';
// Import translation utility for multi-language support.
import { getTranslatedString } from '../i18n.js';
// Import utility functions for common tasks like creating buttons and generating IDs.
import { createItemActionButtons, generateId } from '../utils.js';
// Import rendering functions from other UI modules to trigger updates when department data changes.
import { renderEmployees } from './employees.js';
import { renderRoles } from './roles.js';
import { renderWeeklySchedule } from './scheduler.js';
// Import the generic drag-and-drop sorting utility.
import { makeListSortable } from '../features/list-dnd.js';

// --- 2. MAIN FUNCTIONS ---

/**
 * Handles the 'Save' button click for adding a new or updating an existing department.
 * It reads values from the form, validates them, and updates the central `departments` array.
 */
export function handleSaveDepartment() {
    const name = dom.departmentNameInput.value.trim();
    const abbreviation = dom.departmentAbbreviationInput.value.trim().toUpperCase();
    const editingId = dom.editingDepartmentIdInput.value;

    // Basic validation to ensure required fields are not empty.
    if (!name || !abbreviation) {
        alert(getTranslatedString('alertDeptNameEmpty'));
        return;
    }

    if (editingId) {
        // If an ID is present, we are in 'edit' mode.
        const deptIndex = departments.findIndex(d => d.id === editingId);
        if (deptIndex > -1) {
            departments[deptIndex].name = name;
            departments[deptIndex].abbreviation = abbreviation;
        }
    } else {
        // Otherwise, we are adding a new department.
        // Prevent duplicate department names.
        if (departments.find(d => d.name.toLowerCase() === name.toLowerCase())) {
            alert('Department name already exists.');
            return;
        }
        departments.push({ id: generateId('dept'), name, abbreviation });
    }

    // Persist changes to localStorage and trigger UI updates.
    saveDepartments();
    renderDepartments();
    renderEmployees(); // Re-render employees to reflect potential department name changes.
    resetDepartmentForm();
}

/**
 * Renders the filter pills (e.g., "All", "FOH", "BOH") on the scheduler tab.
 * The active state is determined by the global `window.selectedDepartmentIds` array.
 */
function populateDepartmentFilter() {
    const container = document.getElementById('scheduler-department-filter-pills');
    if (!container) return;

    container.innerHTML = '';
    const currentFilter = window.selectedDepartmentIds || ['all'];

    // "All" Pill - always present.
    const allPill = document.createElement('div');
    allPill.className = 'pill dept-pill';
    if (currentFilter.includes('all')) allPill.classList.add('active');
    allPill.textContent = 'All';
    allPill.dataset.id = 'all';
    allPill.addEventListener('click', () => handleDepartmentFilterChange('all'));
    container.appendChild(allPill);

    // Department-specific pills.
    departments.forEach(dept => {
        const pill = document.createElement('div');
        pill.className = 'pill dept-pill';
        if (currentFilter.includes(dept.id)) pill.classList.add('active');
        pill.textContent = dept.abbreviation;
        pill.dataset.id = dept.id;
        pill.addEventListener('click', () => handleDepartmentFilterChange(dept.id));
        container.appendChild(pill);
    });
}

/**
 * Handles clicks on the department filter pills on the scheduler.
 * This function contains the logic for both single and multi-selection.
 * @param {string} selectedId - The ID of the department pill that was clicked (or 'all').
 */
function handleDepartmentFilterChange(selectedId) {
    // Manages the department filter for the scheduler.
    // Supports selecting multiple departments.
    // If 'all' is selected, it deselects any other active filters.
    // If all individual departments are deselected, it defaults back to 'all'.
    let currentFilter = window.selectedDepartmentIds || ['all'];

    if (selectedId === 'all') {
        currentFilter = ['all'];
    } else {
        // If 'all' was previously selected, clicking a specific department starts a new selection.
        if (currentFilter.includes('all')) {
            currentFilter = [];
        }

        const index = currentFilter.indexOf(selectedId);
        if (index > -1) {
            // If already selected, remove it (toggle off).
            currentFilter.splice(index, 1);
        } else {
            // If not selected, add it (toggle on).
            currentFilter.push(selectedId);
        }

        // If the user deselects all departments, default back to showing 'all'.
        if (currentFilter.length === 0) {
            currentFilter = ['all'];
        }
    }

    // Update the global state and save the preference to localStorage for persistence.
    window.selectedDepartmentIds = currentFilter;
    localStorage.setItem('schedulerDepartmentFilter', JSON.stringify(currentFilter));
    populateDepartmentFilter(); // Re-render pills to show the correct active states.
    renderWeeklySchedule(); // Update the schedule view with the new filter.
}

/**
 * Populates the department form with the data of an existing department for editing.
 * @param {object} department - The department object to edit.
 */
export function populateDepartmentFormForEdit(department) {
    dom.editingDepartmentIdInput.value = department.id;
    dom.departmentNameInput.value = department.name;
    dom.departmentAbbreviationInput.value = department.abbreviation || '';
    dom.addDepartmentBtn.textContent = 'Save Changes';
    dom.cancelEditDepartmentBtn.style.display = 'inline-block';
}

/**
 * Resets the department form to its default state for adding a new department.
 */
export function resetDepartmentForm() {
    dom.editingDepartmentIdInput.value = '';
    dom.departmentNameInput.value = '';
    dom.departmentAbbreviationInput.value = '';
    dom.addDepartmentBtn.textContent = getTranslatedString('btnAddDept');
    dom.cancelEditDepartmentBtn.style.display = 'none';
}

/**
 * Deletes a department after user confirmation.
 * It also handles the cleanup of this department's ID from any associated
 * users, roles, shifts, and settings to prevent data inconsistencies.
 * @param {string} deptId - The ID of the department to delete.
 */
export async function deleteDepartment(deptId) {
    if (!confirm(getTranslatedString('confirmDeleteDept'))) return;

    // Remove the department from the main array.
    const updatedDepts = departments.filter(d => d.id !== deptId);
    departments.length = 0; // Clear original array
    Array.prototype.push.apply(departments, updatedDepts); // Push items back

    // Cascade delete: Nullify the departmentId in related data collections.
    users.forEach(user => { if (user.departmentId === deptId) user.departmentId = null; });
    roles.forEach(role => { if (role.departmentId === deptId) role.departmentId = null; });
    shiftTemplates.forEach(st => { if (st.departmentId === deptId) st.departmentId = null; });

    // Remove any minimum coverage settings associated with this department.
    if (restaurantSettings.minCoverage && restaurantSettings.minCoverage[deptId]) {
        delete restaurantSettings.minCoverage[deptId];
    }

    // Save all changes.
    saveUsers();
    saveRoles();
    saveShiftTemplates();
    saveDepartments();

    // Re-render all affected UI components.
    renderDepartments();
    renderEmployees();
    renderRoles();

    // Asynchronously import and render shift templates to avoid circular dependencies.
    const { renderShiftTemplates } = await import('./shifts.js');
    renderShiftTemplates();

    // If the deleted department was being edited, reset the form.
    if (dom.editingDepartmentIdInput.value === deptId) {
        resetDepartmentForm();
    }
}

/**
 * Renders the list of departments on the 'Departments' tab.
 * Also populates the department dropdowns used in other forms (e.g., Roles, Employees).
 */
export function renderDepartments() {
    if (!dom.departmentListUl) return;
    dom.departmentListUl.innerHTML = '';

    // Prepare dropdown options for use in other parts of the UI.
    const selectDeptHTML = `<option value="" disabled data-lang-key="optSelectDept">${getTranslatedString('optSelectDept')}</option>`;
    if (dom.roleDepartmentSelect) dom.roleDepartmentSelect.innerHTML = selectDeptHTML;
    if (dom.employeeDepartmentSelect) dom.employeeDepartmentSelect.innerHTML = `<option value="">-- ${getTranslatedString('optNoDept')} --</option>`;

    // Render each department as a list item.
    const validDepartments = departments.filter(dept => dept && dept.id && dept.name);
    validDepartments.forEach(dept => {
        const li = document.createElement('li');
        li.className = 'draggable-item';
        li.draggable = true;
        li.dataset.itemId = dept.id;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${dept.name} [${dept.abbreviation || 'N/A'}]`;
        li.appendChild(nameSpan);

        li.appendChild(createItemActionButtons(() => populateDepartmentFormForEdit(dept), () => deleteDepartment(dept.id)));
        dom.departmentListUl.appendChild(li);

        // Add the department as an option to the various select elements.
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        if (dom.employeeDepartmentSelect) dom.employeeDepartmentSelect.appendChild(option.cloneNode(true));
        if (dom.roleDepartmentSelect) dom.roleDepartmentSelect.appendChild(option.cloneNode(true));
    });

    // Make the newly rendered list sortable via drag-and-drop.
    makeListSortable(dom.departmentListUl, departments, saveDepartments, renderDepartments);

    // Update the scheduler's department filter pills.
    populateDepartmentFilter();
}

/**
 * Initializes the scheduler's department filter when the application loads.
 * It attempts to load the last used filter state from localStorage.
 */
export function initializeSchedulerFilter() {
    // Load the last saved filter state from localStorage.
    const savedFilterJSON = localStorage.getItem('schedulerDepartmentFilter');
    let savedFilter;
    try {
        // Use JSON.parse since the filter state is now stored as an array.
        savedFilter = savedFilterJSON ? JSON.parse(savedFilterJSON) : ['all'];
    } catch (e) {
        // If parsing fails (e.g., old string format), default to 'all'.
        savedFilter = ['all'];
    }

    window.selectedDepartmentIds = savedFilter;
    populateDepartmentFilter();
    renderWeeklySchedule(); // Initial render with the loaded filter.
}