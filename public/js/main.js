// js/main.js

import { setLanguage } from './i18n.js';
import { HistoryManager } from './features/history.js';
import { populateTimeSelectsForElements, getWeekRange } from './utils.js';
import * as dom from './dom.js';
import { setupAuthListeners } from './firebase/auth.js';
import { initializeSync, initializeDataListeners, cleanupDataListeners } from './firebase/firestore.js';
import { currentUser, currentViewDate, weekStartsOn } from './state.js';
import { initializeSchedulerFilter, renderDepartments, resetDepartmentForm, handleSaveDepartment } from './ui/departments.js';
import { renderRoles, resetRoleForm, handleSaveRole, populateRoleColorPalette, ensureRoleDeptMultiselect, populateRoleDeptCheckboxes } from './ui/roles.js';
import { renderEmployees, populateTerminationReasons, resetEmployeeForm, handleSaveEmployee, initEmployeeModalListeners } from './ui/employees.js';
import { renderShiftTemplates, resetShiftTemplateForm, handleSaveShiftTemplate, ensureShiftDeptMultiselect, populateShiftDeptCheckboxes, initTimePickerModal } from './ui/shifts.js';
import { renderWeeklySchedule, handlePrevWeek, handleNextWeek, handleThisWeek, handleWeekChange, handlePrint, handleCopyWeek, executeCopyWeek, handleClearWeek, initClearWeekModalListeners } from './ui/scheduler.js';
import { initSettingsTab, handleSaveSettings, handleFullBackup, handleRestoreFile } from './ui/settings.js';
import { showEventsModal, handleSaveEvent, populateEventColorPalette, initEventListeners as initEventModalListeners } from './ui/events.js';
import { showAddEmployeeModal, initModalListeners, initAssignShiftModalListeners, handleAssignShift } from './ui/modals.js';
import { Calendar as VanillaCalendar } from '../vendor/Vanilla-calendar/index.mjs';


// --- Helper: highlight full week in Vanilla Calendar ---
function highlightWeekInCalendar(calendar, date, weekStartsOnKey) {
    try {
        const startMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        const startIdx = startMap[weekStartsOnKey] ?? 1;
        const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        // Compute start of week according to settings
        const day = base.getDay();
        const diff = (day - startIdx + 7) % 7;
        const weekStart = new Date(base);
        weekStart.setDate(base.getDate() - diff);
        const iso = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().substring(0,10);
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            dates.push(iso(d));
        }
        // Switch to multiple-day selection and set all 7 dates
        calendar.update({
            settings: { selection: { day: 'multiple' } },
            selected: { dates }
        });
    } catch (err) {
        console.warn('Failed to highlight week in calendar:', err);
    }
}
let isAppInitialized = false;

export function resetAppInitialization() {
    isAppInitialized = false;
}

export function applyRbacPermissions() {
    if (!currentUser || !currentUser.claims) {
        document.documentElement.dataset.role = 'User'; // Default to most restrictive
        return;
    }
    const role = currentUser.claims.role || 'User';
    document.documentElement.dataset.role = role.replace(/\s+/g, '-');
}

window.reinitializeDatePickers = function() {
    const weekPickerBtn = document.getElementById('date-picker-trigger-btn');
    const weekPickerContainer = document.getElementById('date-picker-container');

    if (window.vanillaCalendar) {
        window.vanillaCalendar.destroy();
    }

    const updatePickerButtonText = (date) => {
        const week = getWeekRange(date);
        const fmt = (dt) => dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        if (weekPickerBtn) weekPickerBtn.textContent = `${fmt(week.start)} – ${fmt(week.end)}`;
    };

    const startMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const startDayKey = weekStartsOn();
    const firstWeekday = startMap[startDayKey] ?? 1;

    const calendar = new VanillaCalendar(weekPickerContainer, {
        firstWeekday,
        actions: {
            clickDay(event, self) {
                const selectedDateStr = self.context?.selectedDates?.[0];
                if (selectedDateStr) {
                    const d = new Date(selectedDateStr + 'T00:00:00');
                    // Highlight the full week in the calendar UI
                    highlightWeekInCalendar(calendar, d, weekStartsOn());
                    // Update app state + grid
                    handleWeekChange({ target: { value: selectedDateStr } });
                    updatePickerButtonText(new Date(selectedDateStr));
                    calendar.hide();
                    if (weekPickerContainer) weekPickerContainer.style.display = 'none';
                }
            },
        },
        settings: {
             visibility: { theme: 'light', alwaysVisible: false },
             selection: { day: 'single' },
             selected: { dates: [currentViewDate.toISOString().substring(0, 10)] }
        }
    });

    calendar.init();
    // Pre-highlight the current week when opening
    highlightWeekInCalendar(calendar, currentViewDate, weekStartsOn());
    calendar.hide();
    if (weekPickerContainer) weekPickerContainer.style.display = 'none';
    window.vanillaCalendar = calendar; 

    if (weekPickerBtn) {
        weekPickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (weekPickerContainer) weekPickerContainer.style.display = 'block';
            // Ensure current week is highlighted before showing
            highlightWeekInCalendar(calendar, currentViewDate, weekStartsOn());
            calendar.show();
        });
    }

    document.addEventListener('click', (e) => {
        if (weekPickerContainer && !weekPickerContainer.contains(e.target) && e.target !== weekPickerBtn) {
            calendar.hide();
            if (weekPickerContainer) weekPickerContainer.style.display = 'none';
        }
    });
    
    updatePickerButtonText(currentViewDate);
};

// --- Application Entry Point ---
window.__startApp = function() {
    if (isAppInitialized) {
        console.log("Application already initialized. Skipping...");
        return;
    }
    console.log("DOM and Auth ready. Initializing application...");

    initializeDataListeners();
    initializeSync();
    
    window.reinitializeDatePickers();

    populateRoleColorPalette();
    populateTimeSelectsForElements(dom.customShiftStartHourSelect, dom.customShiftStartMinuteSelect);
    populateTimeSelectsForElements(dom.customShiftEndHourSelect, dom.customShiftEndMinuteSelect);

    populateTerminationReasons();
    populateEventColorPalette();
    initEventModalListeners();
    initTimePickerModal();
    initModalListeners();
    initAssignShiftModalListeners();
    initEmployeeModalListeners();
    initClearWeekModalListeners();

    renderDepartments();

    ensureShiftDeptMultiselect();
    populateShiftDeptCheckboxes();
    ensureRoleDeptMultiselect();
    populateRoleDeptCheckboxes();

    renderRoles();
    renderEmployees();
    renderShiftTemplates();
    initSettingsTab();

    initializeSchedulerFilter();
    renderWeeklySchedule();

    HistoryManager.updateUndoRedoButtons();

    // --- Event Listener Setup ---
    dom.languageSelect.addEventListener('change', (e) => {
        setLanguage(e.target.value);
        renderDepartments();
        renderRoles();
        renderEmployees();
        renderShiftTemplates();
        initSettingsTab();
        renderWeeklySchedule();
    });

    dom.tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (link.hasAttribute('data-tab')) {
                const tabId = link.dataset.tab;
                dom.tabLinks.forEach(l => l.classList.remove('active'));
                dom.tabContents.forEach(c => c.classList.remove('active'));
                link.classList.add('active');
                document.getElementById(tabId)?.classList.add('active');
                HistoryManager.clear();
                if (tabId) localStorage.setItem('activeTabId', tabId);
            }
        });
    });

    dom.addDepartmentBtn.addEventListener('click', handleSaveDepartment);
    dom.cancelEditDepartmentBtn.addEventListener('click', resetDepartmentForm);
    dom.addRoleBtn.addEventListener('click', handleSaveRole);
    dom.cancelEditRoleBtn.addEventListener('click', resetRoleForm);
    dom.showAddEmployeeModalBtn.addEventListener('click', showAddEmployeeModal);
    dom.addEmployeeBtn.addEventListener('click', handleSaveEmployee);
    dom.cancelEditEmployeeBtn.addEventListener('click', () => {
        resetEmployeeForm();
        if(dom.employeeFormModal) dom.employeeFormModal.style.display = 'none';
    });
    dom.addShiftTemplateBtn.addEventListener('click', handleSaveShiftTemplate);
    dom.cancelEditShiftTemplateBtn.addEventListener('click', resetShiftTemplateForm);
    dom.prevWeekBtn.addEventListener('click', handlePrevWeek);
    dom.nextWeekBtn.addEventListener('click', handleNextWeek);
    dom.thisWeekBtn.addEventListener('click', handleThisWeek);
    
    const copyWeekSourceDate = document.getElementById('copy-week-source-date');
    if (copyWeekSourceDate) copyWeekSourceDate.addEventListener('change', handleWeekChange);

    dom.printScheduleBtn.addEventListener('click', handlePrint);

    const openCopyWeekModalBtn = document.getElementById('open-copy-week-modal-btn');
    if (openCopyWeekModalBtn) openCopyWeekModalBtn.addEventListener('click', handleCopyWeek);

    const confirmCopyWeekBtn = document.getElementById('confirm-copy-week-btn');
    if (confirmCopyWeekBtn) confirmCopyWeekBtn.addEventListener('click', executeCopyWeek);

    dom.clearCurrentWeekBtn.addEventListener('click', handleClearWeek);
    dom.manageEventsBtn.addEventListener('click', showEventsModal);

    dom.saveRestaurantSettingsBtn.addEventListener('click', handleSaveSettings);
    dom.backupAllDataBtn.addEventListener('click', handleFullBackup);
    dom.restoreDataInput.addEventListener('change', handleRestoreFile);
    dom.saveAssignedShiftBtn.addEventListener('click', handleAssignShift);
    dom.addEventBtn.addEventListener('click', handleSaveEvent);

    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.addEventListener('click', () => {
        HistoryManager.undo();
        renderWeeklySchedule();
    });
    if (redoBtn) redoBtn.addEventListener('click', () => {
        HistoryManager.redo();
        renderWeeklySchedule();
    });

    window.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            if (event.shiftKey) {
                HistoryManager.redo();
            } else {
                HistoryManager.undo();
            }
            renderWeeklySchedule();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            HistoryManager.redo();
            renderWeeklySchedule();
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
        const roleColorPopup = document.getElementById('role-color-popup');
        if (roleColorPopup && !roleColorPopup.contains(event.target) && event.target !== dom.roleColorPreview) {
            roleColorPopup.style.display = 'none';
        }
    });
    
    window.addEventListener('beforeunload', () => {
        cleanupDataListeners();
        console.log("Firestore listeners cleaned up on tab close.");
    });

    document.querySelectorAll('.modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    const savedTabId = localStorage.getItem('activeTabId') || 'scheduler-tab';
    const toActivateBtn = document.querySelector(`.tab-link[data-tab="${savedTabId}"]`);
    if (toActivateBtn) {
      toActivateBtn.click();
    } else {
      document.querySelector('.tab-link[data-tab="scheduler-tab"]')?.click();
    }
    
    isAppInitialized = true; 
}

// --- Initialize Auth ---
setupAuthListeners();