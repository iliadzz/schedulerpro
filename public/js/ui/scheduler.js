// js/ui/scheduler.js

import { users, roles, shiftTemplates, scheduleAssignments, events, currentViewDate, saveUsers, saveCurrentViewDate, currentUser, saveScheduleAssignments } from '../state.js';
import * as dom from '../dom.js';
import { getTranslatedString } from '../i18n.js';
import { formatDate, getWeekRange, getDatesOfWeek, formatTimeForDisplay, calculateShiftDuration, getContrastColor, generateId } from '../utils.js';
import { HistoryManager, DeleteAssignmentCommand, ModifyAssignmentCommand } from '../features/history.js';
import { openModalForEdit, openAssignShiftModalForNewOrCustom } from './modals.js';
import { isEventOnDate } from './events.js';
import { sortKeyForEmployee, addEmployeeDragAndDropHandlers } from '../features/employee-dnd.js';
import * as ShiftDnd from '../features/shift-dnd.js';
import { calculateAndRenderCoverage } from '../features/coverage-calculator.js';

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
    const command = new DeleteAssignmentCommand(userId, dateStr, assignmentId);
    HistoryManager.doAction(command);
}

function clearEmployeeWeek(userId, weekDates) {
    if (confirm(`Are you sure you want to clear all shifts for this employee for the week?`)) {
        weekDates.forEach(date => {
            const dateStr = formatDate(date);
            const dayData = scheduleAssignments[`${userId}-${dateStr}`];
            if (dayData && dayData.shifts) {
                // Create a copy of the shifts array to iterate over, as deleteAssignedShift will modify the original
                [...dayData.shifts].forEach(assignment => {
                    deleteAssignedShift(userId, dateStr, assignment.assignmentId);
                });
            }
        });
    }
}


export function handlePrevWeek() {
    currentViewDate.setDate(currentViewDate.getDate() - 7);
    saveCurrentViewDate();
    renderWeeklySchedule();
}

export function handleNextWeek() {
    currentViewDate.setDate(currentViewDate.getDate() + 7);
    saveCurrentViewDate();
    renderWeeklySchedule();
}

export function handleThisWeek() {
    const today = new Date();
    currentViewDate.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    saveCurrentViewDate();
    renderWeeklySchedule();
}

export function handleWeekChange(e) {
    if (e.target.value) {
        const [year, month, day] = e.target.value.split('-').map(Number);
        currentViewDate.setFullYear(year, month - 1, day);
        saveCurrentViewDate();
        renderWeeklySchedule();
    }
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

// --- FIX: Implement the actual copy logic ---
export function executeCopyWeek() {
    const sourceDateInput = document.getElementById('copy-week-source-date');
    if (!sourceDateInput.value) {
        alert("Please select a source week.");
        return;
    }

    const sourceDate = new Date(sourceDateInput.value + 'T00:00:00');
    const sourceWeek = getWeekRange(sourceDate);
    const sourceWeekDates = getDatesOfWeek(sourceWeek.start);

    const targetWeek = getWeekRange(currentViewDate);
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
                    scheduleAssignments[targetKey] = { shifts: [] };
                    scheduleAssignments[sourceKey].shifts.forEach(shiftToCopy => {
                        const newShift = { ...shiftToCopy, assignmentId: generateId('assign') };
                        const command = new ModifyAssignmentCommand(user.id, targetDateStr, newShift);
                        HistoryManager.doAction(command); // Use HistoryManager to make it undoable
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
    alert("Clear week logic needs to be fully wired up here.");
}

export function renderWeeklySchedule() {
    if (!dom.scheduleGridBody) { return; }

    if (dom.weekPickerAlt) dom.weekPickerAlt.value = formatDate(currentViewDate);

    dom.scheduleGridBody.innerHTML = '';
    const week = getWeekRange(currentViewDate);
    const weekDates = getDatesOfWeek(week.start);

    const dayHeaders = document.querySelectorAll('.schedule-header-row .header-day');
    dayHeaders.forEach((header, index) => {
        if (weekDates[index]) {
            const dateObj = weekDates[index];
            const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dateObj.getDay()];
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
        }
    });

    const selectedDepartmentIds = window.selectedDepartmentIds || ['all'];
    let visibleUsers = users.filter(user =>
        (user.status === 'Active' || user.status === undefined) &&
        user.isVisible !== false &&
        (selectedDepartmentIds.includes('all') || selectedDepartmentIds.includes(user.departmentId))
    );

    // Filter for Manager role
    if (currentUser && currentUser.role === 'Manager') {
        const managerDepts = currentUser.managedDepartmentIds || [];
        visibleUsers = visibleUsers.filter(user => managerDepts.includes(user.departmentId));
    }


    visibleUsers.sort((a, b) => {
      const ak = sortKeyForEmployee(a);
      const bk = sortKeyForEmployee(b);
      if (ak !== bk) return ak - bk;
      return (a.displayName || '').localeCompare(b.displayName || '') || a.id.localeCompare(b.id);
    });

    calculateAndRenderCoverage(visibleUsers, weekDates, selectedDepartmentIds);

    const canEditSchedule = currentUser && currentUser.role !== 'User';

    visibleUsers.forEach(user => {
        let weeklyHours = 0;
        const userRowLabel = document.createElement('div');
        userRowLabel.className = 'employee-row-label';
        if (canEditSchedule) {
            userRowLabel.classList.add('draggable-employee-row');
            userRowLabel.draggable = true;
            addEmployeeDragAndDropHandlers(userRowLabel);
        }

        userRowLabel.dataset.employeeId = user.id;

        const actionsHTML = canEditSchedule ? `
            <div class="employee-actions">
                <button class="copy-employee-week-btn" title="Copy Schedule FOR This Employee"><i class="fas fa-copy"></i></button>
                <button class="clear-employee-week-btn" title="Clear All Shifts FOR This Employee This Week"><i class="fas fa-trash-alt"></i></button>
            </div>` : '';

        userRowLabel.innerHTML = `
            <div class="employee-name-hours">
                <span class="employee-name">${user.displayName}</span>
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
                    itemDiv.querySelector('.delete-assigned-shift-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteAssignedShift(user.id, dateStr, assignment.assignmentId);
                    });
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