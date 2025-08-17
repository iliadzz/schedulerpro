// js/ui/shifts.js

/**
 * @file Manages all UI interactions for the 'Shift Templates' tab.
 * This includes rendering the list of templates, handling the add/edit form,
 * managing department filters, and controlling the interactive time picker modal.
 */

// --- 1. IMPORT MODULES ---
import { shiftTemplates, departments, saveShiftTemplates, currentUser } from '../state.js';
import * as dom from '../dom.js';
import { getTranslatedString } from '../i18n.js';
import { createItemActionButtons, calculateShiftDuration, formatTimeForDisplay, formatTimeToHHMM, generateId } from '../utils.js';

// --- 2. MODULE-LEVEL STATE AND CONSTANTS ---

// Key for storing the department filter state in localStorage.
const SHIFTS_FILTER_KEY = 'shiftsDepartmentFilterState';

// Default sort mode for the template list ('ST' for Start Time, 'END' for End Time).
let sortMode = 'ST';

// Constants for day sorting and display.
const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const dayNames = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

// --- 3. TIME PICKER MODAL LOGIC ---

// Holds a reference to the pill and input elements that the time picker is currently modifying.
let activeTimePickerTarget = {
    pill: null,
    input: null
};

/**
 * Opens and populates the time picker modal with hours and minutes.
 * @param {HTMLElement} pillElement - The button element that displays the time.
 * @param {HTMLInputElement} inputElement - The hidden input element that stores the time value.
 */
function openTimePicker(pillElement, inputElement) {
    const modal = document.getElementById('time-picker-modal');
    if (!modal) return;

    activeTimePickerTarget.pill = pillElement;
    activeTimePickerTarget.input = inputElement;

    const [currentHour, currentMinute] = inputElement.value.split(':');

    const hoursContainer = document.getElementById('time-picker-hours');
    const minutesContainer = document.getElementById('time-picker-minutes');
    hoursContainer.innerHTML = '';
    minutesContainer.innerHTML = '';

    // Populate hour pills (00-23).
    for (let i = 0; i < 24; i++) {
        const hour = String(i).padStart(2, '0');
        const hourPill = document.createElement('button');
        hourPill.type = 'button';
        hourPill.className = 'pill';
        hourPill.textContent = hour;
        hourPill.dataset.hour = hour;
        if (hour === currentHour) {
            hourPill.classList.add('active');
        }
        hourPill.addEventListener('click', () => {
            hoursContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            hourPill.classList.add('active');
        });
        hoursContainer.appendChild(hourPill);
    }

    // Populate minute pills (00, 05, 10, ...).
    for (let i = 0; i < 60; i += 5) {
        const minute = String(i).padStart(2, '0');
        const minutePill = document.createElement('button');
        minutePill.type = 'button';
        minutePill.className = 'pill';
        minutePill.textContent = minute;
        minutePill.dataset.minute = minute;
        if (minute === currentMinute) {
            minutePill.classList.add('active');
        }
        minutePill.addEventListener('click', () => {
            minutesContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            minutePill.classList.add('active');
        });
        minutesContainer.appendChild(minutePill);
    }

    modal.style.display = 'block';
}

/**
 * Saves the selected time from the modal to the target elements and closes the modal.
 */
function saveSelectedTime() {
    const modal = document.getElementById('time-picker-modal');
    const selectedHourPill = document.querySelector('#time-picker-hours .pill.active');
    const selectedMinutePill = document.querySelector('#time-picker-minutes .pill.active');

    if (!selectedHourPill || !selectedMinutePill) {
        alert('Please select an hour and a minute.');
        return;
    }

    const newTime = `${selectedHourPill.dataset.hour}:${selectedMinutePill.dataset.minute}`;

    if (activeTimePickerTarget.input && activeTimePickerTarget.pill) {
        activeTimePickerTarget.input.value = newTime;
        activeTimePickerTarget.pill.textContent = newTime;
    }

    modal.style.display = 'none';
}

/**
 * Closes the time picker modal without saving.
 */
function cancelTimePicker() {
    const modal = document.getElementById('time-picker-modal');
    if(modal) modal.style.display = 'none';
}

/**
 * Initializes event listeners for the time picker modal buttons and triggers.
 */
export function initTimePickerModal() {
    dom.shiftTemplateStartTimePill?.addEventListener('click', () => {
        openTimePicker(dom.shiftTemplateStartTimePill, dom.shiftTemplateStartTimeInput);
    });
    dom.shiftTemplateEndTimePill?.addEventListener('click', () => {
        openTimePicker(dom.shiftTemplateEndTimePill, dom.shiftTemplateEndTimeInput);
    });

    document.getElementById('time-picker-save-btn')?.addEventListener('click', saveSelectedTime);
    document.getElementById('time-picker-cancel-btn')?.addEventListener('click', cancelTimePicker);
}


// --- 4. UTILITY FUNCTIONS for FORM ---

/**
 * Renders a set of interactive pills (buttons) inside a container.
 * Used for selecting days and departments in the shift template form.
 * @param {HTMLElement} container - The container to render pills into.
 * @param {Array<object>} items - The data array for the pills (e.g., departments).
 * @param {Array<string>} selectedIds - An array of IDs that should be marked as active.
 * @param {string} key - A prefix for the pill's class name (e.g., 'dept').
 * @param {string} nameProp - The property from the item object to use for the pill's text.
 * @param {string} activeClass - The CSS class to apply when a pill is active.
 */
function renderPills(container, items, selectedIds, key, nameProp, activeClass) {
    container.innerHTML = '';
    items.forEach(item => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `pill ${key}-pill`;
        pill.dataset.id = item.id;
        pill.textContent = item[nameProp];
        if (selectedIds.includes(item.id)) {
            pill.classList.add(activeClass);
            pill.setAttribute('aria-pressed', 'true');
        } else {
            pill.setAttribute('aria-pressed', 'false');
        }
        pill.addEventListener('click', () => {
            pill.classList.toggle(activeClass);
            const isPressed = pill.getAttribute('aria-pressed') === 'true';
            pill.setAttribute('aria-pressed', String(!isPressed));
        });
        container.appendChild(pill);
    });
}

/**
 * Gets the IDs of all currently selected pills within a container.
 * @param {HTMLElement} container - The pill container element.
 * @param {string} activeClass - The CSS class that indicates a pill is active.
 * @returns {Array<string>} An array of the selected item IDs.
 */
function getSelectedPillIds(container, activeClass) {
    const selected = [];
    container.querySelectorAll(`.pill.${activeClass}`).forEach(pill => {
        selected.push(pill.dataset.id);
    });
    return selected;
}

// --- 5. DEPARTMENT FILTER LOGIC ---

/**
 * Dynamically creates the multi-select dropdown for filtering shift templates by department if it doesn't already exist.
 */
export function ensureShiftDeptMultiselect() {
  if (document.getElementById('shift-dept-multiselect')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'multiselect';
  wrapper.id = 'shift-dept-multiselect';
  wrapper.innerHTML = `
    <div class="select-box" id="shift-dept-button">
        <span id="shift-dept-text">All Departments</span>
        <i class="fas fa-chevron-down"></i>
    </div>
    <div class="checkboxes-container" id="shift-dept-checkboxes"></div>
  `;
  // Replace the old filter element with this new multi-select component.
  if (dom.shiftTemplateListFilter && dom.shiftTemplateListFilter.parentElement) {
    dom.shiftTemplateListFilter.style.display = 'none';
    dom.shiftTemplateListFilter.parentElement.insertBefore(wrapper, dom.shiftTemplateListFilter);
  }
  const button = wrapper.querySelector('#shift-dept-button');
  const checks = wrapper.querySelector('#shift-dept-checkboxes');
  button.addEventListener('click', () => {
    checks.classList.toggle('visible');
    button.classList.toggle('expanded');
  });
  // Close dropdown if clicked outside.
  window.addEventListener('click', (ev) => {
    if (!wrapper.contains(ev.target)) {
      checks.classList.remove('visible');
      button.classList.remove('expanded');
    }
  });
}

/**
 * Populates the department filter dropdown with checkboxes, based on saved state.
 */
export function populateShiftDeptCheckboxes() {
  const checks = document.getElementById('shift-dept-checkboxes');
  if (!checks) return;
  checks.innerHTML = '';
  // Load filter state from localStorage to persist user's choice.
  const savedJSON = localStorage.getItem(SHIFTS_FILTER_KEY);
  const saved = savedJSON ? JSON.parse(savedJSON) : null;
  const isChecked = (value, def = true) => {
    if (!saved) return def;
    const rec = saved.find(s => s.value === value);
    return rec ? !!rec.checked : def;
  };
  const allChecked = isChecked('all', true);
  let allLabel = document.createElement('label');
  allLabel.innerHTML = `<input type="checkbox" value="all" ${allChecked ? 'checked' : ''}> <strong>All Departments</strong>`;
  checks.appendChild(allLabel);
  departments.forEach(d => {
    let lab = document.createElement('label');
    let checked = isChecked(d.id, true);
    lab.innerHTML = `<input type="checkbox" value="${d.id}" ${checked ? 'checked' : ''}> ${d.name}`;
    checks.appendChild(lab);
  });
  // Add event listeners to handle checkbox changes.
  checks.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener('change', (e) => {
    const all = checks.querySelector('input[value="all"]');
    const boxes = [...checks.querySelectorAll('input[type="checkbox"]')];
    // Handle "All" checkbox logic.
    if (e && e.target.value === 'all') {
      boxes.forEach(cb => cb.checked = all.checked);
    } else {
      all.checked = boxes.slice(1).every(cb => cb.checked);
    }
    // Save state and re-render.
    const state = boxes.map(cb => ({ value: cb.value, checked: cb.checked }));
    localStorage.setItem(SHIFTS_FILTER_KEY, JSON.stringify(state));
    updateShiftDeptLabel();
    renderShiftTemplates();
  }));
  updateShiftDeptLabel();
}

/**
 * Retrieves the currently selected department IDs from the filter state.
 * @returns {Array<string>|null} An array of department IDs, or null if 'All' is selected.
 */
function getSelectedShiftDepartmentIds() {
  const savedJSON = localStorage.getItem(SHIFTS_FILTER_KEY);
  if (!savedJSON) return null;
  const saved = JSON.parse(savedJSON);
  const selected = saved.filter(s => s.value !== 'all' && s.checked).map(s => s.value);
  const all = saved.find(s => s.value === 'all');
  return (all && all.checked) ? null : selected;
}

/**
 * Updates the text of the department filter dropdown button to reflect the current selection.
 */
function updateShiftDeptLabel() {
  const labelSpan = document.getElementById('shift-dept-text');
  if (!labelSpan) return;
  const selected = getSelectedShiftDepartmentIds();
  if (selected === null) {
    labelSpan.textContent = 'All Departments';
  } else if (selected.length === 0) {
    labelSpan.textContent = 'None selected';
  } else {
    const names = departments.filter(d => selected.includes(d.id)).map(d => d.name);
    labelSpan.textContent = names.length > 2 ? `${names.length} selected` : names.join(', ');
  }
}

// --- 6. CRUD AND RENDER FUNCTIONS ---

/**
 * Populates the shift template form with data for editing.
 * @param {object} template - The shift template object to edit.
 */
export function populateShiftTemplateFormForEdit(template) {
    dom.editingShiftTemplateIdInput.value = template.id;
    dom.shiftTemplateNameInput.value = template.name;

    dom.shiftTemplateStartTimeInput.value = template.start;
    dom.shiftTemplateStartTimePill.textContent = template.start;
    dom.shiftTemplateEndTimeInput.value = template.end;
    dom.shiftTemplateEndTimePill.textContent = template.end;

    renderPills(dom.shiftFormDepartmentPills, departments, template.departmentIds || [], 'dept', 'abbreviation', 'active');
    renderPills(dom.shiftFormDayPills, daysOrder.map(d => ({id: d, name: dayNames[d]})), template.availableDays || [], 'day', 'name', 'active');

    dom.addShiftTemplateBtn.textContent = 'Save Changes';
    dom.cancelEditShiftTemplateBtn.style.display = 'inline-block';
}

/**
 * Resets the shift template form to its default, empty state.
 */
export function resetShiftTemplateForm() {
    dom.editingShiftTemplateIdInput.value = '';
    dom.shiftTemplateNameInput.value = '';

    dom.shiftTemplateStartTimeInput.value = "09:00";
    dom.shiftTemplateStartTimePill.textContent = "09:00";
    dom.shiftTemplateEndTimeInput.value = "17:00";
    dom.shiftTemplateEndTimePill.textContent = "17:00";

    renderPills(dom.shiftFormDepartmentPills, departments, [], 'dept', 'abbreviation', 'active');
    renderPills(dom.shiftFormDayPills, daysOrder.map(d => ({id: d, name: dayNames[d]})), daysOrder, 'day', 'name', 'active');

    dom.addShiftTemplateBtn.textContent = 'Save';
    dom.cancelEditShiftTemplateBtn.style.display = 'none';
}

/**
 * Deletes a shift template after user confirmation.
 * @param {string} stId - The ID of the shift template to delete.
 */
export function deleteShiftTemplate(stId) {
    if (!confirm(`Are you sure you want to delete this shift template?`)) return;
    const updatedTemplates = shiftTemplates.filter(st => st.id !== stId);
    shiftTemplates.length = 0;
    Array.prototype.push.apply(shiftTemplates, updatedTemplates);
    saveShiftTemplates();
    renderShiftTemplates();
    if (dom.editingShiftTemplateIdInput.value === stId) {
        resetShiftTemplateForm();
    }
}

/**
 * Handles the 'Save' button click for a shift template, either creating or updating.
 */
export function handleSaveShiftTemplate() {
    const name = dom.shiftTemplateNameInput.value.trim();
    const start = dom.shiftTemplateStartTimeInput.value;
    const end = dom.shiftTemplateEndTimeInput.value;
    const editingId = dom.editingShiftTemplateIdInput.value;

    const departmentIds = getSelectedPillIds(dom.shiftFormDepartmentPills, 'active');
    const availableDays = getSelectedPillIds(dom.shiftFormDayPills, 'active');

    if (availableDays.length === 0) {
        alert("A shift must be available on at least one day.");
        return;
    }
    if (!name || !start || !end) {
        alert('Please fill in all shift template details.');
        return;
    }
    if (start === end) {
        alert("Shift start and end times cannot be the same.");
        return;
    }

    const templateData = { name, start, end, departmentIds, availableDays };

    if (editingId) {
        const templateIndex = shiftTemplates.findIndex(st => st.id === editingId);
        if (templateIndex > -1) {
            shiftTemplates[templateIndex] = { ...shiftTemplates[templateIndex], ...templateData };
        }
    } else {
        shiftTemplates.push({ id: generateId('shift'), ...templateData });
    }
    saveShiftTemplates();
    renderShiftTemplates();
    resetShiftTemplateForm();
}

/**
 * Renders the entire list of shift templates, grouped by department.
 * This is the main rendering function for the "Shift Templates" tab.
 */
export function renderShiftTemplates() {
    if (!dom.shiftTemplateContainer) return;
    dom.shiftTemplateContainer.innerHTML = '';

    resetShiftTemplateForm(); // Initialize the form pills.

    const selectedDeptIds = getSelectedShiftDepartmentIds();

    let filteredTemplates = shiftTemplates;
    const multiselectElement = document.getElementById('shift-dept-multiselect');

    // Apply role-based filtering (Managers only see their departments).
    if (currentUser && currentUser.role === 'Manager') {
        const managerDepts = currentUser.managedDepartmentIds || [];
        filteredTemplates = filteredTemplates.filter(st => {
            return (st.departmentIds || []).some(deptId => managerDepts.includes(deptId));
        });
        if (multiselectElement) {
            multiselectElement.style.display = 'none';
        }
    } else {
        // Apply department filter from the multi-select dropdown.
        if (multiselectElement) {
            multiselectElement.style.display = 'block';
        }
        if (selectedDeptIds !== null) {
            filteredTemplates = shiftTemplates.filter(st => {
                const templateDepts = Array.isArray(st.departmentIds) ? st.departmentIds : (st.departmentId ? [st.departmentId] : []);

                if (templateDepts.length === 0) {
                    return selectedDeptIds.includes('_unassigned');
                }
                return templateDepts.some(deptId => selectedDeptIds.includes(deptId));
            });
        }
    }


    // Group templates by department for display.
    const groupedByDept = filteredTemplates.reduce((acc, template) => {
        const deptIds = Array.isArray(template.departmentIds) ? template.departmentIds : (template.departmentId ? [template.departmentId] : []);
        if (deptIds.length === 0) {
            if (!acc._unassigned) {
                acc._unassigned = { name: 'Unassigned', templates: [] };
            }
            acc._unassigned.templates.push(template);
        } else {
            deptIds.forEach(deptId => {
                if (!acc[deptId]) {
                    acc[deptId] = {
                        name: departments.find(d => d.id === deptId)?.name || 'Unassigned',
                        templates: []
                    };
                }
                acc[deptId].templates.push(template);
            });
        }
        return acc;
    }, {});

    // Sort templates within each group based on the selected sort mode.
    Object.values(groupedByDept).forEach(deptGroup => {
        deptGroup.templates.sort((a, b) => {
            if (sortMode === 'ST') {
                if (a.start < b.start) return -1;
                if (a.start > b.start) return 1;
                const durationA = calculateShiftDuration(a.start, a.end);
                const durationB = calculateShiftDuration(b.start, b.end);
                return durationA - durationB;
            } else { // END
                if (a.end < b.end) return -1;
                if (a.end > b.end) return 1;
                return a.start.localeCompare(b.start);
            }
        });
    });

    // Sort the department groups themselves.
    const deptOrder = departments.map(d => d.id);
    const sortedDeptGroups = Object.keys(groupedByDept).sort((a,b) => {
        if (a === '_unassigned') return 1;
        if (b === '_unassigned') return -1;
        return deptOrder.indexOf(a) - deptOrder.indexOf(b);
    });

    // Create and append the final HTML structure.
    const gridContainer = document.createElement('div');
    gridContainer.className = 'template-grid-container';

    sortedDeptGroups.forEach(deptId => {
        const deptGroup = groupedByDept[deptId];
        const deptColumn = document.createElement('div');
        deptColumn.className = 'department-column';
        deptColumn.innerHTML = `<h3>${deptGroup.name}</h3>`;

        deptGroup.templates.forEach(st => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'template-item';

            const duration = calculateShiftDuration(st.start, st.end).toFixed(1);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'template-info';
            infoDiv.innerHTML = `
                <span class="template-time">${formatTimeForDisplay(st.start)} - ${formatTimeForDisplay(st.end)}</span>
                <span class="template-name-span">| ${st.name}</span>
                <span class="template-duration">[${duration}]</span>
            `;

            const deptPills = document.createElement('div');
            deptPills.className = 'department-pills-container';
            departments.forEach(dept => {
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'pill dept-pill';
                pill.textContent = dept.abbreviation;
                const templateDepts = Array.isArray(st.departmentIds) ? st.departmentIds : (st.departmentId ? [st.departmentId] : []);
                if (templateDepts.includes(dept.id)) {
                    pill.classList.add('active');
                }
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let currentDepts = Array.isArray(st.departmentIds) ? st.departmentIds : (st.departmentId ? [st.departmentId] : []);
                    const index = currentDepts.indexOf(dept.id);
                    if (index > -1) {
                        currentDepts.splice(index, 1);
                    } else {
                        currentDepts.push(dept.id);
                    }
                    st.departmentIds = currentDepts;
                    saveShiftTemplates();
                    renderShiftTemplates();
                });
                deptPills.appendChild(pill);
            });

            infoDiv.appendChild(deptPills);

            infoDiv.appendChild(createItemActionButtons(
                () => populateShiftTemplateFormForEdit(st),
                () => deleteShiftTemplate(st.id)
            ));
            itemDiv.appendChild(infoDiv);

            const dayPills = document.createElement('div');
            dayPills.className = 'day-pills-container';
            daysOrder.forEach(day => {
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'pill day-pill';
                pill.textContent = dayNames[day];
                if ((st.availableDays || []).includes(day)) {
                    pill.classList.add('active');
                }
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentDays = st.availableDays || [];
                    const index = currentDays.indexOf(day);
                    if (index > -1) {
                        currentDays.splice(index, 1);
                    } else {
                        currentDays.push(day);
                    }
                    st.availableDays = currentDays;
                    saveShiftTemplates();
                    renderShiftTemplates();
                });
                dayPills.appendChild(pill);
            });

            itemDiv.appendChild(dayPills);

            deptColumn.appendChild(itemDiv);
        });

        gridContainer.appendChild(deptColumn);
    });

    dom.shiftTemplateContainer.appendChild(gridContainer);
}