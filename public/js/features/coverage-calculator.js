// js/features/coverage-calculator.js
// handles the business logic for calculating the coverage summary.

import { departments, restaurantSettings, scheduleAssignments, shiftTemplates, roles } from '../state.js';
import { isEventOnDate } from '../ui/events.js';
import { calculateOverlap, timeToMinutes } from '../utils.js';

export function calculateAndRenderCoverage(visibleUsers, weekDates, selectedDepartmentIds) {
    const coverageContainer = document.getElementById('coverage-summary-container');
    if (!coverageContainer) return;
    coverageContainer.innerHTML = '';

    const visibleDepartments = departments.filter(dept =>
        selectedDepartmentIds.includes('all') || selectedDepartmentIds.includes(dept.id)
    );

    visibleDepartments.forEach(dept => {
        let isRowDeficient = false;
        const summaryCells = [];

        const deptLabelCell = document.createElement('div');
        deptLabelCell.className = 'header-coverage-summary-label';
        deptLabelCell.textContent = `${dept.name} Coverage`;
        summaryCells.push(deptLabelCell);

        weekDates.forEach(date => {
            const dateStr = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
            const daySettings = restaurantSettings[dayOfWeek] || {};
            const coverageSettings = restaurantSettings.minCoverage?.[dept.id]?.[dayOfWeek] || restaurantSettings.minCoverage?._default?.[dayOfWeek] || {};

            let coverage = { open: 0, lunch: 0, dinner: 0, close: 0 };
            
            visibleUsers.forEach(user => {
                const dayData = scheduleAssignments[`${user.id}-${dateStr}`];
                if (dayData && dayData.shifts) {
                    dayData.shifts.forEach(shift => {
                        if (shift.type === 'shift') {
                            const role = roles.find(r => r.id === shift.roleId);
                            let shiftDeptId = null;

                            if (shift.isCustom) {
                                if (role) {
                                    shiftDeptId = role.departmentId;
                                }
                            } else {
                                const tpl = shiftTemplates.find(st => st.id === shift.shiftTemplateId);
                                if (tpl) {
                                    // Correctly get department from the template
                                    shiftDeptId = tpl.departmentId;
                                }
                            }

                            if (role && shiftDeptId === dept.id) {
                                const tpl = shift.isCustom ? null : shiftTemplates.find(st => st.id === shift.shiftTemplateId);
                                const start = shift.isCustom ? shift.customStart : tpl?.start;
                                const end = shift.isCustom ? shift.customEnd : tpl?.end;

                                if (start && end && daySettings.open && daySettings.close) {
                                    const minMealDuration = parseInt(restaurantSettings.minMealCoverageDuration, 10) || 60;
                                    
                                    // Opening: Counts if shift starts AT or BEFORE opening.
                                    if (timeToMinutes(start) <= timeToMinutes(daySettings.open)) {
                                        coverage.open++;
                                    }
                                    // Lunch: Counts if shift overlaps with lunch period by at least the min duration.
                                    if (daySettings.lunchStart && daySettings.lunchEnd && calculateOverlap(start, end, daySettings.lunchStart, daySettings.lunchEnd) >= minMealDuration) {
                                        coverage.lunch++;
                                    }
                                    // Dinner: Counts if shift overlaps with dinner period by at least the min duration.
                                    if (daySettings.dinnerStart && daySettings.dinnerEnd && calculateOverlap(start, end, daySettings.dinnerStart, daySettings.dinnerEnd) >= minMealDuration) {
                                        coverage.dinner++;
                                    }
                                    // Closing: Counts if shift ends AT or AFTER closing.
                                    if (timeToMinutes(end) >= timeToMinutes(daySettings.close)) {
                                        coverage.close++;
                                    }
                                }
                            }
                        }
                    });
                }
            });

            const summaryCell = document.createElement('div');
            summaryCell.className = 'header-coverage-summary';
            summaryCell.classList.toggle('is-event-day', isEventOnDate(date).length > 0);

            const periods = [
                { key: 'open', label: 'OP', minKey: 'minOp' },
                { key: 'lunch', label: 'AL', minKey: 'minAl' },
                { key: 'dinner', label: 'CE', minKey: 'minCe' },
                { key: 'close', label: 'CL', minKey: 'minCl' }
            ];

            let cellHTML = '';
            periods.forEach(p => {
                const count = coverage[p.key];
                const min = coverageSettings[p.minKey];
                let statusClass = '';

                if (min !== undefined && min > 0) {
                    if (count < min) { statusClass = 'coverage-danger'; isRowDeficient = true; } 
                    else if (count > min) { statusClass = 'coverage-over'; } 
                    else { statusClass = 'coverage-success'; }
                }
                cellHTML += `<span class="coverage-item ${statusClass}">${p.label}: ${count}</span>`;
            });
            summaryCell.innerHTML = cellHTML;
            summaryCells.push(summaryCell);
        });

        if (isRowDeficient) {
            summaryCells.forEach(cell => cell.classList.add('coverage-row-deficient'));
        }

        summaryCells.forEach(cell => coverageContainer.appendChild(cell));
    });
}