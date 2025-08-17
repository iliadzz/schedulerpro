// js/ui/departments.js

/**
 * @file Manages all UI interactions for the 'Departments' tab.
 * This includes creating, editing, deleting, and reordering departments.
 * It also handles the department-based filtering functionality on the main scheduler view.
 * Note: All drag-and-drop logic for list reordering is handled by the generic `makeListSortable` function.
 */

// --- 1. IMPORT MODULES ---
import { departments, users, roles, shiftTemplates, restaurantSettings, saveDepartments, saveUsers, saveRoles, saveShiftTemplates } from '../state.js';
import * as dom from '../dom.js';
import { getTranslatedString } from '../i18n.js';
import { createItemActionButtons, generateId } from '../utils.js';
import { renderEmployees } from './employees.js';
import { renderRoles } from './roles.js';
import { renderWeeklySchedule } from './scheduler.js';
import { makeListSortable } from '../features/list-dnd.js';

// --- 2. MAIN FUNCTIONS ---

export function handleSaveDepartment() {
    const name = dom.departmentNameInput.value.trim();
    const abbreviation = dom.departmentAbbreviationInput.value.trim().toUpperCase();
    const editingId = dom.editingDepartmentIdInput.value;

    if (!name || !abbreviation) {
        alert(getTranslatedString('alertDeptNameEmpty'));
        return;
    }

    if (editingId) {
        const deptIndex = departments.findIndex(d => d.id === editingId);
        if (deptIndex > -1) {
            departments[deptIndex].name = name;
            departments[deptIndex].abbreviation = abbreviation;
        }
    } else {
        if (departments.find(d => d.name.toLowerCase() === name.toLowerCase())) {
            alert('Department name already exists.');
            return;
        }
        departments.push({ id: generateId('dept'), name, abbreviation });
    }

    saveDepartments();
    renderDepartments();
    renderEmployees();
    resetDepartmentForm();
}

function populateDepartmentFilter() {
    const container = document.getElementById('scheduler-department-filter-pills');
    if (!container) return;

    container.innerHTML = '';
    const currentFilter = window.selectedDepartmentIds || ['all'];

    const allPill = document.createElement('div');
    allPill.className = 'pill dept-pill';
    if (currentFilter.includes('all')) allPill.classList.add('active');
    allPill.textContent = 'All';
    allPill.dataset.id = 'all';
    allPill.addEventListener('click', () => handleDepartmentFilterChange('all'));
    container.appendChild(allPill);

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

function handleDepartmentFilterChange(selectedId) {
    let currentFilter = window.selectedDepartmentIds || ['all'];

    if (selectedId === 'all') {
        currentFilter = ['all'];
    } else {
        if (currentFilter.includes('all')) {
            currentFilter = [];
        }

        const index = currentFilter.indexOf(selectedId);
        if (index > -1) {
            currentFilter.splice(index, 1);
        } else {
            currentFilter.push(selectedId);
        }

        if (currentFilter.length === 0) {
            currentFilter = ['all'];
        }
    }

    window.selectedDepartmentIds = currentFilter;
    localStorage.setItem('schedulerDepartmentFilter', JSON.stringify(currentFilter));
    populateDepartmentFilter();
    renderWeeklySchedule();
}

export function populateDepartmentFormForEdit(department) {
    dom.editingDepartmentIdInput.value = department.id;
    dom.departmentNameInput.value = department.name;
    dom.departmentAbbreviationInput.value = department.abbreviation || '';
    dom.addDepartmentBtn.textContent = 'Save Changes';
    dom.cancelEditDepartmentBtn.style.display = 'inline-block';
}

export function resetDepartmentForm() {
    dom.editingDepartmentIdInput.value = '';
    dom.departmentNameInput.value = '';
    dom.departmentAbbreviationInput.value = '';
    dom.addDepartmentBtn.textContent = getTranslatedString('btnAddDept');
    dom.cancelEditDepartmentBtn.style.display = 'none';
}

export async function deleteDepartment(deptId) {
    if (!confirm(getTranslatedString('confirmDeleteDept'))) return;

    const updatedDepts = departments.filter(d => d.id !== deptId);
    departments.length = 0;
    Array.prototype.push.apply(departments, updatedDepts);

    users.forEach(user => { if (user.departmentId === deptId) user.departmentId = null; });
    roles.forEach(role => { if (role.departmentId === deptId) role.departmentId = null; });
    shiftTemplates.forEach(st => { if (st.departmentId === deptId) st.departmentId = null; });

    if (restaurantSettings.minCoverage && restaurantSettings.minCoverage[deptId]) {
        delete restaurantSettings.minCoverage[deptId];
    }

    saveUsers();
    saveRoles();
    saveShiftTemplates();
    saveDepartments();

    renderDepartments();
    renderEmployees();
    renderRoles();
    
    const { renderShiftTemplates } = await import('./shifts.js');
    renderShiftTemplates();

    if (dom.editingDepartmentIdInput.value === deptId) {
        resetDepartmentForm();
    }
}

export function renderDepartments() {
    if (!dom.departmentListUl) return;
    dom.departmentListUl.innerHTML = '';
    
    // --- THIS IS THE FIX ---
    // Sort the departments array based on the 'sortOrder' property before rendering.
    // The || 999 ensures that any departments without an order (like newly created ones
    // before a save) appear at the end.
    departments.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));


    const selectDeptHTML = `<option value="" disabled data-lang-key="optSelectDept">${getTranslatedString('optSelectDept')}</option>`;
    if (dom.roleDepartmentSelect) dom.roleDepartmentSelect.innerHTML = selectDeptHTML;
    if (dom.employeeDepartmentSelect) dom.employeeDepartmentSelect.innerHTML = `<option value="">-- ${getTranslatedString('optNoDept')} --</option>`;

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

        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = dept.name;
        if (dom.employeeDepartmentSelect) dom.employeeDepartmentSelect.appendChild(option.cloneNode(true));
        if (dom.roleDepartmentSelect) dom.roleDepartmentSelect.appendChild(option.cloneNode(true));
    });

    makeListSortable(dom.departmentListUl, departments, saveDepartments, renderDepartments);

    populateDepartmentFilter();
}

export function initializeSchedulerFilter() {
    const savedFilterJSON = localStorage.getItem('schedulerDepartmentFilter');
    let savedFilter;
    try {
        savedFilter = savedFilterJSON ? JSON.parse(savedFilterJSON) : ['all'];
    } catch (e) {
        savedFilter = ['all'];
    }

    window.selectedDepartmentIds = savedFilter;
    populateDepartmentFilter();
    renderWeeklySchedule();
}