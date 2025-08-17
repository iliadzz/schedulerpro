// js/main.js

import { setLanguage } from './i18n.js';
import { HistoryManager } from './features/history.js';
import { populateTimeSelectsForElements } from './utils.js';
import * as dom from './dom.js';
import { setupAuthListeners } from './firebase/auth.js';
import { initializeSync, initializeDataListeners } from './firebase/firestore.js';
import { currentUser } from './state.js';

import { initializeSchedulerFilter, renderDepartments, resetDepartmentForm, handleSaveDepartment } from './ui/departments.js';
import { renderRoles, resetRoleForm, handleSaveRole, populateRoleColorPalette, ensureRoleDeptMultiselect, populateRoleDeptCheckboxes } from './ui/roles.js';
import { renderEmployees, populateTerminationReasons, resetEmployeeForm, handleSaveEmployee, initEmployeeModalListeners } from './ui/employees.js';
import { renderShiftTemplates, resetShiftTemplateForm, handleSaveShiftTemplate, ensureShiftDeptMultiselect, populateShiftDeptCheckboxes, initTimePickerModal } from './ui/shifts.js';
import { renderWeeklySchedule, handlePrevWeek, handleNextWeek, handleThisWeek, handleWeekChange, handlePrint, handleCopyWeek, executeCopyWeek, handleClearWeek } from './ui/scheduler.js';
import { initSettingsTab, handleSaveSettings, handleFullBackup, handleRestoreFile } from './ui/settings.js';
import { showEventsModal, handleSaveEvent, populateEventColorPalette, initEventListeners as initEventModalListeners } from './ui/events.js';
import { showAddEmployeeModal, initModalListeners, initAssignShiftModalListeners, handleAssignShift } from './ui/modals.js';

// Flag to prevent the app from being initialized more than once per session
let isAppInitialized = false;

/**
 * Resets the initialization flag when a user logs out.
 */
export function resetAppInitialization() {
    isAppInitialized = false;
}

export function applyRbacPermissions() {
    if (!currentUser || !currentUser.claims) {
        document.documentElement.dataset.role = 'User'; // Default to most restrictive
        return;
    }
    // Set the data-role attribute on the HTML tag based on the user's role claim.
    const role = currentUser.claims.role || 'User';
    document.documentElement.dataset.role = role.replace(/\s+/g, '-'); // e.g., "General Manager" -> "General-Manager"
}


// --- Application Entry Point ---
window.__startApp = function() {
    // Prevent re-initialization
    if (isAppInitialized) {
        console.log("Application already initialized. Skipping...");
        return;
    }
    console.log("DOM and Auth ready. Initializing application...");

    // Initialize Firestore listeners first to ensure data is available
    initializeDataListeners();

    // Then initialize the sync mechanism
    initializeSync();

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
    dom.weekPickerAlt.addEventListener('change', handleWeekChange);
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
    
    // Set the flag to true after the first successful initialization
    isAppInitialized = true; 
}

// --- Initialize Auth ---
setupAuthListeners();