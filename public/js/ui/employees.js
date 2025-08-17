// js/ui/employees.js

import {
    users,
    departments,
    scheduleAssignments,
    terminationReasons,
    DEFAULT_VACATION_DAYS,
    saveUsers,
    saveScheduleAssignments,
    currentUser,
    // --- CHANGE: Import the new state variable and save function ---
    employeeDisplayFormat,
    saveEmployeeDisplayFormat
} from '../state.js';

import * as dom from '../dom.js';
import { getTranslatedString } from '../i18n.js';
import { createItemActionButtons, generateId } from '../utils.js';
// --- CHANGE: Import scheduler render function to trigger updates ---
import { renderWeeklySchedule } from './scheduler.js';


// --- Module-level state for filters ---
let selectedDeptIds = ['all'];
let showInactive = false;
// --- CHANGE: The local displayFormat variable is no longer needed ---
// let displayFormat = 'LF'; 

function renderEmployeeFilters() {
    const container = document.getElementById('employee-filter-pills');
    if (!container) return;

    container.innerHTML = '';

    const allPill = document.createElement('div');
    allPill.className = 'pill dept-pill';
    allPill.textContent = 'All';
    allPill.dataset.id = 'all';
    if (selectedDeptIds.includes('all')) {
        allPill.classList.add('active');
    }
    allPill.addEventListener('click', () => {
        selectedDeptIds = ['all'];
        showInactive = false;
        renderEmployees();
    });
    container.appendChild(allPill);

    departments.forEach(dept => {
        const pill = document.createElement('div');
        pill.className = 'pill dept-pill';
        pill.textContent = dept.abbreviation;
        pill.dataset.id = dept.id;
        if (selectedDeptIds.includes(dept.id)) {
            pill.classList.add('active');
        }
        pill.addEventListener('click', () => {
            showInactive = false;
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
    
    const inactivePill = document.createElement('div');
    inactivePill.className = 'pill inactive-pill';
    inactivePill.textContent = 'INACTIVE';
    if (showInactive) {
        inactivePill.classList.add('active');
    }
    inactivePill.addEventListener('click', () => {
        showInactive = !showInactive;
        if (showInactive) {
            selectedDeptIds = [];
        } else {
            selectedDeptIds = ['all'];
        }
        renderEmployees();
    });
    container.appendChild(inactivePill);
}

function renderDisplayFormatPills() {
    const container = document.getElementById('employee-display-pills');
    if (!container) return;

    container.innerHTML = '';
    const formats = [
        { id: 'LF', text: 'Last, First' },
        { id: 'FL', text: 'First Last' },
        { id: 'DN', text: 'Display Name' }
    ];

    formats.forEach(format => {
        const pill = document.createElement('div');
        pill.className = 'pill display-format-pill';
        pill.textContent = format.id;
        pill.title = format.text;
        // --- CHANGE: Read from the central state variable ---
        if (employeeDisplayFormat === format.id) {
            pill.classList.add('active');
        }
        pill.addEventListener('click', () => {
            // --- CHANGE: Update the central state, save it, and re-render both views ---
            // This is a bit of a workaround to update the state variable directly.
            // In a more complex app, we'd use a setter function.
            let newFormat = format.id;
            localStorage.setItem('employeeDisplayFormat', newFormat);
            // Manually update the imported variable for the current session
            // This is a simplified approach for this app's architecture.
            // A more robust solution might involve a state management library.
            // For now, we reload the module's view of the state.
            location.reload(); // Simplest way to ensure all modules get the new state
        });
        container.appendChild(pill);
    });
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
    dom.editingEmployeeIdInput.value = user.id;
    dom.employeeFirstNameInput.value = user.firstName || '';
    dom.employeeLastNameInput.value = user.lastName || '';
    dom.employeeDisplayNameInput.value = user.displayName || '';
    dom.employeeDobInput.value = user.dob || '';
    dom.employeePhoneCodeInput.value = user.phone?.code || '+502';
    dom.employeePhoneNumberInput.value = user.phone?.number || '';
    dom.employeeEmailInput.value = user.email || '';
    dom.employeeAddress1Input.value = user.address?.line1 || '';
    dom.employeeAddress2Input.value = user.address?.line2 || '';
    dom.employeeCityInput.value = user.address?.city || '';
    dom.employeeDepartmentAddressInput.value = user.address?.department || '';
    dom.employeeCountryInput.value = user.address?.country || '';
    dom.employeeDepartmentSelect.value = user.departmentId || "";
    dom.employeeStartDateInput.value = user.startDate || '';
    dom.employeeVacationBalanceInput.value = user.vacationBalance ?? DEFAULT_VACATION_DAYS;
    
    dom.employeeRoleSelect.value = user.role || 'User';
    dom.employeeRoleSelect.dispatchEvent(new Event('change'));
    
    const checkboxes = dom.employeeManagedDepartmentsMultiselect.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = (user.managedDepartmentIds || []).includes(cb.value);
    });


    if (user.status === 'Terminated') {
        dom.employeeStatusSelect.value = 'Terminated';
        dom.terminationDetails.style.display = 'block';
        dom.employeeTerminationDateInput.value = user.terminationDate || '';
        dom.employeeTerminationReasonInput.value = user.terminationReason || '';
    } else {
        dom.employeeStatusSelect.value = 'Active';
        dom.terminationDetails.style.display = 'none';
        dom.employeeTerminationDateInput.value = '';
        dom.employeeTerminationReasonInput.value = '';
    }
    dom.addEmployeeBtn.textContent = 'Save Changes';
    dom.cancelEditEmployeeBtn.style.display = 'inline-block';
}

export function resetEmployeeForm() {
    dom.editingEmployeeIdInput.value = '';
    dom.employeeFirstNameInput.value = '';
    dom.employeeLastNameInput.value = '';
    dom.employeeDisplayNameInput.value = '';
    dom.employeeDobInput.value = '';
    dom.employeePhoneCodeInput.value = '+502';
    dom.employeePhoneNumberInput.value = '';
    dom.employeeEmailInput.value = '';
    dom.employeeAddress1Input.value = '';
    dom.employeeAddress2Input.value = '';
    dom.employeeCityInput.value = '';
    dom.employeeDepartmentAddressInput.value = '';
    dom.employeeCountryInput.value = '';
    dom.employeeDepartmentSelect.value = "";
    dom.employeeStartDateInput.value = '';
    dom.employeeVacationBalanceInput.value = DEFAULT_VACATION_DAYS;
    dom.employeeStatusSelect.value = 'Active';
    dom.terminationDetails.style.display = 'none';
    dom.employeeTerminationDateInput.value = '';
    dom.employeeTerminationReasonInput.value = '';
    
    dom.employeeRoleSelect.value = 'User';
    dom.employeeRoleSelect.dispatchEvent(new Event('change'));
    const checkboxes = dom.employeeManagedDepartmentsMultiselect.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);

    dom.addEmployeeBtn.textContent = getTranslatedString('btnAddEmployee');
    dom.cancelEditEmployeeBtn.style.display = 'none';
}

export async function handleSaveEmployee() {
    const editingId = dom.editingEmployeeIdInput.value;
    if (!dom.employeeFirstNameInput.value.trim() || !dom.employeeLastNameInput.value.trim()) {
        alert('First Name and Last Name are required.');
        return;
    }

    const managedDeptIds = [];
    if (dom.employeeRoleSelect.value === 'Manager') {
        const checkboxes = dom.employeeManagedDepartmentsMultiselect.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(cb => managedDeptIds.push(cb.value));
    }

    const employeeData = {
        firstName: dom.employeeFirstNameInput.value.trim(),
        lastName: dom.employeeLastNameInput.value.trim(),
        displayName: dom.employeeDisplayNameInput.value.trim() || `${dom.employeeFirstNameInput.value.trim()} ${dom.employeeLastNameInput.value.trim()}`,
        dob: dom.employeeDobInput.value,
        phone: { code: dom.employeePhoneCodeInput.value, number: dom.employeePhoneNumberInput.value.trim() },
        email: dom.employeeEmailInput.value.trim(),
        address: { line1: dom.employeeAddress1Input.value.trim(), line2: dom.employeeAddress2Input.value.trim(), city: dom.employeeCityInput.value.trim(), department: dom.employeeDepartmentAddressInput.value.trim(), country: dom.employeeCountryInput.value.trim() },
        startDate: dom.employeeStartDateInput.value,
        departmentId: dom.employeeDepartmentSelect.value || null,
        vacationBalance: parseInt(dom.employeeVacationBalanceInput.value, 10) || 0,
        status: dom.employeeStatusSelect.value,
        role: dom.employeeRoleSelect.value,
        managedDepartmentIds: managedDeptIds
    };

    if (employeeData.status === 'Terminated') {
        employeeData.terminationDate = dom.employeeTerminationDateInput.value || null;
        employeeData.terminationReason = dom.employeeTerminationReasonInput.value || null;
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
    if (dom.employeeFormModal) dom.employeeFormModal.style.display = 'none';
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
    if (dom.editingEmployeeIdInput.value === userId) {
        if (dom.employeeFormModal) dom.employeeFormModal.style.display = 'none';
        resetEmployeeForm();
    }
}

export function populateTerminationReasons() {
    if (!dom.employeeTerminationReasonInput) return;
    dom.employeeTerminationReasonInput.innerHTML = '<option value="">-- Select a Reason --</option>';
    terminationReasons.forEach(reason => {
        const option = document.createElement('option');
        option.value = reason;
        option.textContent = reason;
        dom.employeeTerminationReasonInput.appendChild(option);
    });
}

function populateManagedDepartments() {
    if (!dom.employeeManagedDepartmentsMultiselect) return;
    dom.employeeManagedDepartmentsMultiselect.innerHTML = '';
    departments.forEach(dept => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${dept.id}"> ${dept.name}`;
        dom.employeeManagedDepartmentsMultiselect.appendChild(label);
    });
}

export function renderEmployees() {
    if (!dom.employeeListUl) return;
    
    renderEmployeeFilters();
    renderDisplayFormatPills();

    dom.employeeListUl.innerHTML = '';
    
    let employeesToDisplay = users;

    if (currentUser && currentUser.role === 'Manager') {
        const managerDepts = currentUser.managedDepartmentIds || [];
        employeesToDisplay = users.filter(user => managerDepts.includes(user.departmentId));
    } else if (showInactive) {
        employeesToDisplay = users.filter(user => user.status === 'Terminated');
    } else {
        employeesToDisplay = users.filter(user => {
            const statusMatch = user.status === 'Active' || user.status === undefined;
            const deptMatch = selectedDeptIds.includes('all') || selectedDeptIds.includes(user.departmentId);
            return statusMatch && deptMatch;
        });
    }


    employeesToDisplay.sort((a, b) => {
        // --- CHANGE: Use the central state variable for sorting ---
        if (employeeDisplayFormat === 'LF') {
            return (a.lastName || '').localeCompare(b.lastName || '') || (a.firstName || '').localeCompare(b.firstName || '');
        }
        if (employeeDisplayFormat === 'FL') {
            return (a.firstName || '').localeCompare(b.firstName || '') || (a.lastName || '').localeCompare(b.lastName || '');
        }
        return (a.displayName || '').localeCompare(b.displayName || '');
    });

    employeesToDisplay.forEach(user => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        const dept = departments.find(d => d.id === user.departmentId);
        const deptAbbr = dept ? `[${dept.abbreviation}]` : '';

        let employeeName;
        // --- CHANGE: Use the central state variable for display ---
        switch (employeeDisplayFormat) {
            case 'LF':
                employeeName = `${user.lastName || ''}, ${user.firstName || ''}`;
                break;
            case 'FL':
                employeeName = `${user.firstName || ''} ${user.lastName || ''}`;
                break;
            default:
                employeeName = user.displayName || `${user.firstName} ${user.lastName}`;
        }
        
        const statusIndicator = (user.status === 'Terminated') ? ' (Inactive)' : '';
        nameSpan.textContent = `${employeeName.trim()} ${deptAbbr}${statusIndicator}`;

        if (user.status === 'Terminated') li.style.opacity = '0.6';
        
        li.appendChild(nameSpan);

        const editHandler = () => {
            if (dom.employeeModalTitle) dom.employeeModalTitle.textContent = getTranslatedString('hdrEditEmployee');
            populateEmployeeFormForEdit(user);
            if (dom.employeeFormModal) dom.employeeFormModal.style.display = 'block';
        };
        const deleteHandler = () => deleteEmployee(user.id);

        const actionButtonsDiv = createItemActionButtons(editHandler, deleteHandler);
        actionButtonsDiv.prepend(createVisibilityToggle(user));
        li.appendChild(actionButtonsDiv);
        dom.employeeListUl.appendChild(li);
    });
}

export function initEmployeeModalListeners() {
    if (dom.employeeStatusSelect) {
        dom.employeeStatusSelect.addEventListener('change', () => {
            dom.terminationDetails.style.display = dom.employeeStatusSelect.value === 'Terminated' ? 'block' : 'none';
        });
    }
    if (dom.employeeRoleSelect) {
        dom.employeeRoleSelect.addEventListener('change', () => {
            if (dom.managedDepartmentsContainer) {
                dom.managedDepartmentsContainer.style.display = dom.employeeRoleSelect.value === 'Manager' ? 'block' : 'none';
            }
        });
    }
    populateManagedDepartments();
}