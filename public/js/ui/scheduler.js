// js/ui/scheduler.js

// --- Import the new state management function ---
import { users, roles, shiftTemplates, scheduleAssignments, events, currentViewDate, saveUsers, currentUser, saveScheduleAssignments, departments, employeeDisplayFormat, weekStartsOn, setCurrentViewDate } from '../state.js';
import * as dom from '../dom.js';
import { getTranslatedString } from '../i18n.js';
import { formatDate, getWeekRange, getDatesOfWeek, formatTimeForDisplay, calculateShiftDuration, getContrastColor, generateId } from '../utils.js';
import { HistoryManager, DeleteAssignmentCommand, ModifyAssignmentCommand } from '../features/history.js';
import { openModalForEdit, openAssignShiftModalForNewOrCustom } from './modals.js';
import { isEventOnDate } from './events.js';
import { sortKeyForEmployee, addEmployeeDragAndDropHandlers } from '../features/employee-dnd.js';
import * as ShiftDnd from '../features/shift-dnd.js';
import { calculateAndRenderCoverage } from '../features/coverage-calculator.js';
import {
    clearWeekConfirmModal,
    clearWeekConfirmText,
    clearShiftsOnlyBtn,
    clearAllAssignmentsBtn,
    clearCancelBtn
} from '../dom.js';


function handleVacationClick(event) {
    if (currentUser.role === 'User') return;
    const userId = event.currentTarget.dataset.userId;
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newBalanceStr = prompt(`Enter new vacation balance for ${user.displayName}:`, user.vacationBalance);
    if (newBalanceStr === null) return;
    const newBalance = parseInt(newBalanceStr, 10);
    if (isNaN(newBalance)) {
        alert("Invalid number. Please enter a valid number for the vacation balance.");
        return;
    }
    user.vacationBalance = newBalance;
    saveUsers();
    renderWeeklySchedule();
}

function deleteAssignedShift(userId, dateStr, assignmentId) {
    const assignmentKey = `${userId}-${dateStr}`;
    const dayData = scheduleAssignments[assignmentKey];
    if (dayData && dayData.shifts) {
        const index = dayData.shifts.findIndex(a => a.assignmentId === assignmentId);
        if (index > -1) {
            const command = new DeleteAssignmentCommand(userId, dateStr, assignmentId);
            HistoryManager.doAction(command);
            const dayDataImmediate = scheduleAssignments[assignmentKey];
            if (dayDataImmediate && dayDataImmediate.shifts) {
                const immediateIndex = dayDataImmediate.shifts.findIndex(a => a.assignmentId === assignmentId);
                if (immediateIndex > -1) {
                    dayDataImmediate.shifts.splice(immediateIndex, 1);
                    if (dayDataImmediate.shifts.length === 0) {
                        delete scheduleAssignments[assignmentKey];
                    }
                }
            }
        }
    }
    renderWeeklySchedule();
}

function clearEmployeeWeek(userId, weekDates) {
    if (confirm(`Are you sure you want to clear all shifts for this employee for the week?`)) {
        weekDates.forEach(date => {
            const dateStr = formatDate(date);
            const dayData = scheduleAssignments[`${userId}-${dateStr}`];
            if (dayData && dayData.shifts) {
                [...dayData.shifts].forEach(assignment => {
                    deleteAssignedShift(userId, dateStr, assignment.assignmentId);
                });
            }
        });
    }
}


export function handlePrevWeek() {
    const newDate = new Date(currentViewDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentViewDate(newDate);
    renderWeeklySchedule();
}

export function handleNextWeek() {
    const newDate = new Date(currentViewDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentViewDate(newDate);
    renderWeeklySchedule();
}

export function handleThisWeek() {
    setCurrentViewDate(new Date());
    renderWeeklySchedule();
}

export function handleWeekChange(dateOrEvent) {
    let picked;
    if (dateOrEvent instanceof Date) {
        picked = dateOrEvent;
    } else if (dateOrEvent?.target?.value) {
        const [yy, mm, dd] = dateOrEvent.target.value.split('-').map(Number);
        picked = new Date(yy, mm - 1, dd);
    } else {
        return; // Nothing to do
    }
    setCurrentViewDate(picked);
    renderWeeklySchedule();
}


export function handlePrint() {
    window.print();
}

export function handleCopyWeek() {
    const copyWeekModal = document.getElementById('copy-week-modal');
    if (copyWeekModal) {
        copyWeekModal.style.display = 'block';
    }
}

export function executeCopyWeek() {
    const sourceDateInput = document.getElementById('copy-week-source-date');
    if (!sourceDateInput.value) {
        alert("Please select a source week.");
        return;
    }

    const sourceDate = new Date(sourceDateInput.value + 'T00:00:00');
    const sourceWeek = getWeekRange(sourceDate, weekStartsOn());
    const sourceWeekDates = getDatesOfWeek(sourceWeek.start);

    const targetWeek = getWeekRange(currentViewDate, weekStartsOn());
    const targetWeekDates = getDatesOfWeek(targetWeek.start);

    const selectedDepartmentIds = window.selectedDepartmentIds || ['all'];
    let visibleUsers = users.filter(user =>
        (user.status === 'Active' || user.status === undefined) &&
        user.isVisible !== false &&
        (selectedDepartmentIds.includes('all') || selectedDepartmentIds.includes(user.departmentId))
    );

    if (confirm(`Copy the schedule from ${formatDate(sourceWeek.start)} to ${formatDate(targetWeek.start)} for all visible employees?`)) {
        visibleUsers.forEach(user => {
            for (let i = 0; i < 7; i++) {
                const sourceDateStr = formatDate(sourceWeekDates[i]);
                const targetDateStr = formatDate(targetWeekDates[i]);

                const sourceKey = `${user.id}-${sourceDateStr}`;
                const targetKey = `${user.id}-${targetDateStr}`;

                if (scheduleAssignments[sourceKey] && scheduleAssignments[sourceKey].shifts) {
                    if (scheduleAssignments[targetKey] && scheduleAssignments[targetKey].shifts) {
                        scheduleAssignments[targetKey].shifts = [];
                    }

                    scheduleAssignments[sourceKey].shifts.forEach(shiftToCopy => {
                        const newShift = { ...shiftToCopy, assignmentId: generateId('assign') };
                        const command = new ModifyAssignmentCommand(user.id, targetDateStr, newShift);
                        HistoryManager.doAction(command);
                    });
                }
            }
        });

        saveScheduleAssignments();
        renderWeeklySchedule();
        const copyWeekModal = document.getElementById('copy-week-modal');
        if (copyWeekModal) {
            copyWeekModal.style.display = 'none';
        }
    }
}


export function handleClearWeek() {
    if (!clearWeekConfirmModal) return;

    const week = getWeekRange(currentViewDate, weekStartsOn());
    const weekStartStr = formatDate(week.start);
    const weekEndStr = formatDate(week.end);
    if (clearWeekConfirmText) {
        clearWeekConfirmText.textContent = `Are you sure you want to clear assignments for the week of ${weekStartStr} to ${weekEndStr}? This action can be undone.`;
    }

    clearWeekConfirmModal.style.display = 'block';
}

export function initClearWeekModalListeners() {
    if (!clearWeekConfirmModal) return;

    const performClearAction = (filter) => {
        const weekDates = getDatesOfWeek(getWeekRange(currentViewDate, weekStartsOn()).start);
        const visibleUsers = users.filter(user => user.isVisible !== false);

        visibleUsers.forEach(user => {
            weekDates.forEach(date => {
                const dateStr = formatDate(date);
                const dayData = scheduleAssignments[`${user.id}-${dateStr}`];

                if (dayData && dayData.shifts) {
                    [...dayData.shifts].forEach(assignment => {
                        let shouldDelete = false;
                        switch (filter) {
                            case 'all':
                                shouldDelete = true;
                                break;
                            case 'shifts_only':
                                shouldDelete = assignment.type === 'shift';
                                break;
                            case 'keep_vacation':
                                shouldDelete = !(assignment.type === 'time_off' && assignment.reason === 'Vacation');
                                break;
                        }

                        if (shouldDelete) {
                            deleteAssignedShift(user.id, dateStr, assignment.assignmentId);
                        }
                    });
                }
            });
        });
        clearWeekConfirmModal.style.display = 'none';
    };

    if (clearShiftsOnlyBtn) {
        clearShiftsOnlyBtn.addEventListener('click', () => performClearAction('shifts_only'));
    }
    if (clearAllAssignmentsBtn) {
        clearAllAssignmentsBtn.addEventListener('click', () => performClearAction('all'));
    }
    if (clearCancelBtn) {
        clearCancelBtn.addEventListener('click', () => {
            clearWeekConfirmModal.style.display = 'none';
        });
    }
}

export function renderWeeklySchedule() {
    if (!dom.scheduleGridBody) { return; }

    const startDay = weekStartsOn(); // Get the current week start day setting

    if (dom.weekPickerAlt) dom.weekPickerAlt.value = formatDate(currentViewDate);

    dom.scheduleGridBody.innerHTML = '';
    const week = getWeekRange(currentViewDate, startDay);
    const weekDates = getDatesOfWeek(week.start);

    const dayHeaders = document.querySelectorAll('.schedule-header-row .header-day');
    
    // Define the order of days based on the start day setting.
    // This ensures the header displays "Mon, Tue, Wed..." or "Sun, Mon, Tue..." correctly.
    const dayKeyOrder = startDay === 'mon' 
        ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    dayHeaders.forEach((header, index) => {
        if (weekDates[index]) {
            const dateObj = weekDates[index];
            const dayKey = dayKeyOrder[index]; // Use the defined order
            const dayInitial = getTranslatedString('day' + dayKey.charAt(0).toUpperCase() + dayKey.slice(1));
            
            let headerHTML = `${dayInitial} - ${dateObj.getDate()}`;
            const todaysEvents = isEventOnDate(dateObj);
            header.classList.toggle('is-event-day', todaysEvents.length > 0);
            
            if (todaysEvents.length > 0) {
                header.style.backgroundColor = todaysEvents[0].color || '';
                headerHTML += ` <span class="event-header-name">| ${todaysEvents.map(e => e.name).join(', ')}</span>`;
            } else {
                header.style.backgroundColor = '';
            }
            header.innerHTML = headerHTML;
            header.dataset.date = formatDate(dateObj);
            header.dataset.day = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
        }
    });

    const selectedDepartmentIds = window.selectedDepartmentIds || ['all'];
    let visibleUsers = users.filter(user =>
        (user.status === 'Active' || user.status === undefined) &&
        user.isVisible !== false &&
        (selectedDepartmentIds.includes('all') || selectedDepartmentIds.includes(user.departmentId))
    );

    if (currentUser && currentUser.role === 'Manager') {
        const managerDepts = currentUser.managedDepartmentIds || [];
        visibleUsers = visibleUsers.filter(user => managerDepts.includes(user.departmentId));
    }

    const departmentOrderMap = new Map();
    departments.forEach((dept, index) => {
        departmentOrderMap.set(dept.id, index);
    });

    visibleUsers.sort((a, b) => {
        const orderA = departmentOrderMap.get(a.departmentId) ?? 999;
        const orderB = departmentOrderMap.get(b.departmentId) ?? 999;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        const ak = sortKeyForEmployee(a);
        const bk = sortKeyForEmployee(b);
        if (ak !== bk) return ak - bk;
        
        if (employeeDisplayFormat === 'LF') {
            return (a.lastName || '').localeCompare(b.lastName || '') || (a.firstName || '').localeCompare(b.firstName || '');
        }
        if (employeeDisplayFormat === 'FL') {
            return (a.firstName || '').localeCompare(b.firstName || '') || (a.lastName || '').localeCompare(b.lastName || '');
        }
        return (a.displayName || '').localeCompare(b.displayName || '');
    });


    calculateAndRenderCoverage(visibleUsers, weekDates, selectedDepartmentIds);

    const canEditSchedule = currentUser && currentUser.role !== 'User';
    
    let lastDepartmentId = null;

    visibleUsers.forEach(user => {
        if (user.departmentId !== lastDepartmentId) {
            const dept = departments.find(d => d.id === user.departmentId);
            const deptName = dept ? dept.name : getTranslatedString('optNoDept');
            
            const headerRow = document.createElement('div');
            headerRow.className = 'department-header-row';
            headerRow.textContent = deptName;
            dom.scheduleGridBody.appendChild(headerRow);

            lastDepartmentId = user.departmentId;
        }


        let weeklyHours = 0;
        const userRowLabel = document.createElement('div');
        userRowLabel.className = 'employee-row-label indented';
        if (canEditSchedule) {
            userRowLabel.classList.add('draggable-employee-row');
            userRowLabel.draggable = true;
            addEmployeeDragAndDropHandlers(userRowLabel);
        }

        userRowLabel.dataset.employeeId = user.id;
        
        let employeeNameToDisplay;
        switch (employeeDisplayFormat) {
            case 'LF':
                employeeNameToDisplay = `${user.lastName || ''}, ${user.firstName || ''}`;
                break;
            case 'FL':
                employeeNameToDisplay = `${user.firstName || ''} ${user.lastName || ''}`;
                break;
            default:
                employeeNameToDisplay = user.displayName || `${user.firstName} ${user.lastName}`;
        }


        const actionsHTML = canEditSchedule ? `
            <div class="employee-actions">
                <button class="copy-employee-week-btn" title="Copy Schedule FOR This Employee"><i class="fas fa-copy"></i></button>
                <button class="clear-employee-week-btn" title="Clear All Shifts FOR This Employee This Week"><i class="fas fa-trash-alt"></i></button>
            </div>` : '';

        userRowLabel.innerHTML = `
            <div class="employee-name-hours">
                <span class="employee-name">${employeeNameToDisplay.trim()}</span>
                <span class="employee-stats">
                    <span class="total-hours" title="Hours this week"><i class="fas fa-clock"></i> <span id="hours-${user.id}">0</span>h</span>
                    <span class="vacation-counter" title="Click to edit vacation days" data-user-id="${user.id}"><i class="fas fa-plane-departure"></i> ${user.vacationBalance}</span>
                </span>
            </div>
            ${actionsHTML}
        `;
        dom.scheduleGridBody.appendChild(userRowLabel);

        if (canEditSchedule) {
            userRowLabel.querySelector('.copy-employee-week-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (dom.copyEmployeeModalUserIdInput) dom.copyEmployeeModalUserIdInput.value = user.id;
                if (dom.copyEmployeeWeekModal) dom.copyEmployeeWeekModal.style.display = 'block';
            });

            userRowLabel.querySelector('.clear-employee-week-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                clearEmployeeWeek(user.id, weekDates);
            });
        }

        weekDates.forEach(date => {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            const dateStr = formatDate(date);
            cell.classList.toggle('is-event-day', isEventOnDate(date).length > 0);

            cell.dataset.date = dateStr;
            cell.dataset.userId = user.id;

            if (canEditSchedule) {
                cell.addEventListener('click', () => openAssignShiftModalForNewOrCustom(user.id, dateStr));
                cell.addEventListener('dragover', ShiftDnd.handleDragOver);
                cell.addEventListener('dragenter', ShiftDnd.handleDragEnter);
                cell.addEventListener('dragleave', ShiftDnd.handleDragLeave);
                cell.addEventListener('drop', ShiftDnd.handleDrop);
            }


            const shiftsContainer = document.createElement('div');
            shiftsContainer.className = 'shifts-container';
            const dayData = scheduleAssignments[`${user.id}-${dateStr}`] || { shifts: [] };

            dayData.shifts.forEach(assignment => {
                const itemDiv = document.createElement('div');
                itemDiv.dataset.assignmentId = assignment.assignmentId;

                const deleteBtnHTML = canEditSchedule ? `<button class="delete-assigned-shift-btn" data-assignment-id="${assignment.assignmentId}">&times;</button>`: '';

                if (canEditSchedule) {
                    itemDiv.draggable = true;
                    itemDiv.addEventListener('dragstart', (e) => ShiftDnd.handleDragStart(e, user.id, dateStr, assignment));
                    itemDiv.addEventListener('dragend', ShiftDnd.handleDragEnd);
                    itemDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openModalForEdit(assignment, user.id, dateStr);
                    });
                }

                if (assignment.type === 'time_off') {
                    itemDiv.className = 'shift-item time-off-item';
                    itemDiv.innerHTML = `<span class="time-off-reason">${assignment.reason.toUpperCase()}</span>` + deleteBtnHTML;
                } else {
                    const role = roles.find(r => r.id === assignment.roleId);
                    let startTime, endTime;
                    if (assignment.isCustom) {
                        startTime = assignment.customStart;
                        endTime = assignment.customEnd;
                    } else {
                        const shiftTpl = shiftTemplates.find(st => st.id === assignment.shiftTemplateId);
                        if (shiftTpl) {
                            startTime = shiftTpl.start;
                            endTime = shiftTpl.end;
                        }
                    }
                    itemDiv.className = 'shift-item';
                    if (role && role.color) {
                        itemDiv.style.backgroundColor = role.color;
                        itemDiv.style.color = getContrastColor(role.color);
                    }
                    itemDiv.innerHTML = `<span class="shift-time">${startTime || 'N/A'} - ${endTime || 'N/A'}</span> <span class="shift-role">| ${role ? role.name : 'No Role'}</span>` + deleteBtnHTML;
                    if (startTime && endTime) weeklyHours += calculateShiftDuration(startTime, endTime);
                }

                if (canEditSchedule) {
                    const deleteBtn = itemDiv.querySelector('.delete-assigned-shift-btn');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation(); 
                            deleteAssignedShift(user.id, dateStr, assignment.assignmentId);
                        });
                    }
                }
                shiftsContainer.appendChild(itemDiv);
            });
            cell.appendChild(shiftsContainer);
            dom.scheduleGridBody.appendChild(cell);
        });

        const hoursEl = document.getElementById(`hours-${user.id}`);
        if(hoursEl) hoursEl.textContent = weeklyHours.toFixed(1);

        userRowLabel.querySelector('.vacation-counter').addEventListener('click', handleVacationClick);
    });
}