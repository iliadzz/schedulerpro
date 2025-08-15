// js/ui/employees.js

import {
    users,
    departments,
    scheduleAssignments,
    terminationReasons,
    DEFAULT_VACATION_DAYS,
    saveUsers,
    saveScheduleAssignments
} from '../state.js';

import {
    employeeListUl,
    editingEmployeeIdInput,
    employeeFormModal,
    employeeModalTitle,
    employeeFirstNameInput,
    employeeLastNameInput,
    employeeDisplayNameInput,
    employeeDobInput,
    employeePhoneCodeInput,
    employeePhoneNumberInput,
    employeeEmailInput,
    employeeAddress1Input,
    employeeAddress2Input,
    employeeCityInput,
    employeeDepartmentAddressInput,
    employeeCountryInput,
    employeeDepartmentSelect,
    employeeStartDateInput,
    employeeTerminationDateInput,
    employeeTerminationReasonInput,
    employeeVacationBalanceInput,
    addEmployeeBtn,
    cancelEditEmployeeBtn,
    employeeStatusSelect,
    terminationDetails
} from '../dom.js';

import { getTranslatedString } from '../i18n.js';
import { createItemActionButtons, generateId } from '../utils.js';

// --- Module-level state for filters ---
let selectedDeptIds = ['all'];
let showInactive = false;

function renderEmployeeFilters() {
    const container = document.getElementById('employee-filter-pills');
    if (!container) return;

    container.innerHTML = '';

    // "All" Pill
    const allPill = document.createElement('div');
    allPill.className = 'pill dept-pill';
    allPill.textContent = 'All';
    allPill.dataset.id = 'all';
    if (selectedDeptIds.includes('all')) {
        allPill.classList.add('active');
    }
    allPill.addEventListener('click', () => {
        selectedDeptIds = ['all'];
        renderEmployees();
    });
    container.appendChild(allPill);

    // Department Pills
    departments.forEach(dept => {
        const pill = document.createElement('div');
        pill.className = 'pill dept-pill';
        pill.textContent = dept.abbreviation;
        pill.dataset.id = dept.id;
        if (selectedDeptIds.includes(dept.id)) {
            pill.classList.add('active');
        }
        pill.addEventListener('click', () => {
            if (selectedDeptIds.includes('all')) {
                selectedDeptIds = [];
            }
            const index = selectedDeptIds.indexOf(dept.id);
            if (index > -1) {
                selectedDeptIds.splice(index, 1);
            } else {
                selectedDeptIds.push(dept.id);
            }
            if (selectedDeptIds.length === 0) {
                selectedDeptIds = ['all'];
            }
            renderEmployees();
        });
        container.appendChild(pill);
    });
    
    // "Inactive" Pill
    const inactivePill = document.createElement('div');
    inactivePill.className = 'pill inactive-pill'; // Unique class for styling if needed
    inactivePill.textContent = 'Inactive';
    if (showInactive) {
        inactivePill.classList.add('active');
    }
    inactivePill.addEventListener('click', () => {
        showInactive = !showInactive;
        renderEmployees();
    });
    container.appendChild(inactivePill);
}


async function toggleEmployeeVisibility(userId) {
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex > -1) {
        users[userIndex].isVisible = !(users[userIndex].isVisible === true);
        saveUsers();
        renderEmployees();
        const { renderWeeklySchedule } = await import('./scheduler.js');
        renderWeeklySchedule();
    }
}

function createVisibilityToggle(user) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'visibility-toggle-btn';
    toggleBtn.title = user.isVisible !== false ? 'Hide from schedule' : 'Show on schedule';
    const icon = document.createElement('i');
    icon.className = 'fas';
    if (user.isVisible === false) {
        icon.classList.add('fa-eye-slash');
        toggleBtn.classList.add('inactive');
    } else {
        icon.classList.add('fa-eye');
    }
    toggleBtn.appendChild(icon);
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmployeeVisibility(user.id);
    });
    return toggleBtn;
}

export function populateEmployeeFormForEdit(user) {
    editingEmployeeIdInput.value = user.id;
    employeeFirstNameInput.value = user.firstName || '';
    employeeLastNameInput.value = user.lastName || '';
    employeeDisplayNameInput.value = user.displayName || '';
    employeeDobInput.value = user.dob || '';
    employeePhoneCodeInput.value = user.phone?.code || '+502';
    employeePhoneNumberInput.value = user.phone?.number || '';
    employeeEmailInput.value = user.email || '';
    employeeAddress1Input.value = user.address?.line1 || '';
    employeeAddress2Input.value = user.address?.line2 || '';
    employeeCityInput.value = user.address?.city || '';
    employeeDepartmentAddressInput.value = user.address?.department || '';
    employeeCountryInput.value = user.address?.country || '';
    employeeDepartmentSelect.value = user.departmentId || "";
    employeeStartDateInput.value = user.startDate || '';
    employeeVacationBalanceInput.value = user.vacationBalance ?? DEFAULT_VACATION_DAYS;
    if (user.status === 'Terminated') {
        employeeStatusSelect.value = 'Terminated';
        terminationDetails.style.display = 'block';
        employeeTerminationDateInput.value = user.terminationDate || '';
        employeeTerminationReasonInput.value = user.terminationReason || '';
    } else {
        employeeStatusSelect.value = 'Active';
        terminationDetails.style.display = 'none';
        employeeTerminationDateInput.value = '';
        employeeTerminationReasonInput.value = '';
    }
    addEmployeeBtn.textContent = 'Save Changes';
    cancelEditEmployeeBtn.style.display = 'inline-block';
}

export function resetEmployeeForm() {
    editingEmployeeIdInput.value = '';
    employeeFirstNameInput.value = '';
    employeeLastNameInput.value = '';
    employeeDisplayNameInput.value = '';
    employeeDobInput.value = '';
    employeePhoneCodeInput.value = '+502';
    employeePhoneNumberInput.value = '';
    employeeEmailInput.value = '';
    employeeAddress1Input.value = '';
    employeeAddress2Input.value = '';
    employeeCityInput.value = '';
    employeeDepartmentAddressInput.value = '';
    employeeCountryInput.value = '';
    employeeDepartmentSelect.value = "";
    employeeStartDateInput.value = '';
    employeeVacationBalanceInput.value = DEFAULT_VACATION_DAYS;
    employeeStatusSelect.value = 'Active';
    terminationDetails.style.display = 'none';
    employeeTerminationDateInput.value = '';
    employeeTerminationReasonInput.value = '';
    addEmployeeBtn.textContent = getTranslatedString('btnAddEmployee');
    cancelEditEmployeeBtn.style.display = 'none';
}

export async function handleSaveEmployee() {
    const editingId = editingEmployeeIdInput.value;
    if (!employeeFirstNameInput.value.trim() || !employeeLastNameInput.value.trim()) {
        alert('First Name and Last Name are required.');
        return;
    }
    const employeeData = {
        firstName: employeeFirstNameInput.value.trim(),
        lastName: employeeLastNameInput.value.trim(),
        displayName: employeeDisplayNameInput.value.trim() || `${employeeFirstNameInput.value.trim()} ${employeeLastNameInput.value.trim()}`,
        dob: employeeDobInput.value,
        phone: { code: employeePhoneCodeInput.value, number: employeePhoneNumberInput.value.trim() },
        email: employeeEmailInput.value.trim(),
        address: { line1: employeeAddress1Input.value.trim(), line2: employeeAddress2Input.value.trim(), city: employeeCityInput.value.trim(), department: employeeDepartmentAddressInput.value.trim(), country: employeeCountryInput.value.trim() },
        startDate: employeeStartDateInput.value,
        departmentId: employeeDepartmentSelect.value || null,
        vacationBalance: parseInt(employeeVacationBalanceInput.value, 10) || 0,
        status: employeeStatusSelect.value,
    };
    if (employeeData.status === 'Terminated') {
        employeeData.terminationDate = employeeTerminationDateInput.value || null;
        employeeData.terminationReason = employeeTerminationReasonInput.value || null;
    } else {
        employeeData.terminationDate = null;
        employeeData.terminationReason = null;
    }
    if (editingId) {
        const userIndex = users.findIndex(u => u.id === editingId);
        if (userIndex > -1) users[userIndex] = { ...users[userIndex], ...employeeData };
    } else {
        users.push({ id: generateId('user'), ...employeeData, isVisible: true });
    }
    saveUsers();
    renderEmployees();
    const { renderWeeklySchedule } = await import('./scheduler.js');
    renderWeeklySchedule();
    resetEmployeeForm();
    if (employeeFormModal) employeeFormModal.style.display = 'none';
}

export async function deleteEmployee(userId) {
    if (!confirm(`Are you sure you want to delete this employee? This will also remove all their scheduled shifts.`)) return;
    const updatedUsers = users.filter(u => u.id !== userId);
    users.length = 0;
    Array.prototype.push.apply(users, updatedUsers);
    for (const key in scheduleAssignments) {
        if (key.startsWith(userId + '-')) delete scheduleAssignments[key];
    }
    saveScheduleAssignments();
    saveUsers();
    renderEmployees();
    const { renderWeeklySchedule } = await import('./scheduler.js');
    renderWeeklySchedule();
    if (editingEmployeeIdInput.value === userId) {
        if (employeeFormModal) employeeFormModal.style.display = 'none';
        resetEmployeeForm();
    }
}

export function populateTerminationReasons() {
    if (!employeeTerminationReasonInput) return;
    employeeTerminationReasonInput.innerHTML = '<option value="">-- Select a Reason --</option>';
    terminationReasons.forEach(reason => {
        const option = document.createElement('option');
        option.value = reason;
        option.textContent = reason;
        employeeTerminationReasonInput.appendChild(option);
    });
}

export function renderEmployees() {
    if (!employeeListUl) return;
    
    renderEmployeeFilters();

    employeeListUl.innerHTML = '';
    
    const employeesToDisplay = users.filter(user => {
        const statusMatch = showInactive ? true : (user.status === 'Active' || user.status === undefined);
        const deptMatch = selectedDeptIds.includes('all') || selectedDeptIds.includes(user.departmentId);
        return statusMatch && deptMatch;
    });

    employeesToDisplay.forEach(user => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        const dept = departments.find(d => d.id === user.departmentId);
        const deptName = dept ? dept.name : getTranslatedString('optNoDept');
        const statusIndicator = (user.status === 'Terminated') ? ' (Inactive)' : '';
        const employeeName = user.displayName || `${user.firstName} ${user.lastName}`;
        nameSpan.textContent = `${employeeName.trim()} (${deptName})${statusIndicator}`;
        if (user.status === 'Terminated') li.style.opacity = '0.6';
        li.appendChild(nameSpan);
        const editHandler = () => {
            if (employeeModalTitle) employeeModalTitle.textContent = getTranslatedString('hdrEditEmployee');
            populateEmployeeFormForEdit(user);
            if (employeeFormModal) employeeFormModal.style.display = 'block';
        };
        const deleteHandler = () => deleteEmployee(user.id);
        const actionButtonsDiv = createItemActionButtons(editHandler, deleteHandler);
        actionButtonsDiv.prepend(createVisibilityToggle(user));
        li.appendChild(actionButtonsDiv);
        employeeListUl.appendChild(li);
    });
}

export function initEmployeeModalListeners() {
    if (employeeStatusSelect) {
        employeeStatusSelect.addEventListener('change', () => {
            terminationDetails.style.display = employeeStatusSelect.value === 'Terminated' ? 'block' : 'none';
        });
    }
}

// refactor v.02
