// js/main.js
const VC_DEBUG = true;
function vcLog(...args){ if(VC_DEBUG) console.log('[VC]', ...args); }
function vcWarn(...args){ if(VC_DEBUG) console.warn('[VC]', ...args); }


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


// === Calendar Helpers (single source of truth) ================================
(function(){
  function weekStartIndex(key){ // for JS Date.getDay (0=Sun..6=Sat)
    var map = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
    return (map[key] != null) ? map[key] : 1;
  }

  window.highlightWeekInCalendar = function(calendar, date, weekStartsOnKey){
    var startIdx = weekStartIndex(weekStartsOnKey);
    var base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = base.getDay();
    var diff = (day - startIdx + 7) % 7;
    var weekStart = new Date(base);
    weekStart.setDate(base.getDate() - diff);
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    function iso(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().substring(0,10); }
    var from = iso(weekStart), to = iso(weekEnd);
    if (calendar && typeof calendar.update === 'function') {
      calendar.update({ settings: { selection: { day: 'range' } }, selected: { from: from, to: to } });
    } else if (calendar && typeof calendar.set === 'function') {
      calendar.set({ settings: { selection: { day: 'range' } }, selected: { from: from, to: to } });
    }
  };

  function ensureWeekBadge(container) {
    var badge = container.querySelector('#vc-week-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'vc-week-badge';
      badge.className = 'vc-week-badge';
      badge.setAttribute('aria-live', 'polite');
      container.insertAdjacentElement('afterbegin', badge);
    }
    if (!document.getElementById('vc-week-badge-style')) {
      var st = document.createElement('style');
      st.id = 'vc-week-badge-style';
      st.textContent = '.vc-week-badge{font-size:.9rem;font-weight:600;margin-bottom:.5rem;padding:.35rem .6rem;border-radius:.6rem;background:#3498db;color:#fff;display:inline-block;box-shadow:0 1px 3px rgba(0,0,0,.08)}@media (prefers-color-scheme: dark){.vc-week-badge{box-shadow:0 1px 3px rgba(0,0,0,.35)}}';
      document.head.appendChild(st);
    }
    return badge;
  }

  window.formatWeekRangeLabel = function(date){
    var range = getWeekRange(date, weekStartsOn());
    function fmt(d){ return d.toLocaleDateString(undefined, { month:'short', day:'numeric' }); }
    return fmt(range.start) + ' – ' + fmt(range.end);
  };

  window.updateWeekBadge = function(container, date){
    var badge = ensureWeekBadge(container);
    badge.textContent = window.formatWeekRangeLabel(date);
  };

  window.updatePickerButtonText = function(date){
    var label = window.formatWeekRangeLabel(date);
    var btn = document.getElementById('date-picker-trigger-btn') || document.getElementById('week-picker-btn');
    if (btn) {
      btn.textContent = label;
      btn.style.color = '#fff';
    }
  };
})();
// =============================================================================

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
    const weekPickerBtn = document.getElementById('date-picker-trigger-btn') || document.getElementById('week-picker-btn');
    const weekPickerContainer = document.getElementById('date-picker-container');

    if (window.vanillaCalendar) {
        window.vanillaCalendar.destroy();
    }

    const startMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const startDayKey = weekStartsOn();
    const firstWeekday = startMap[startDayKey] || 1;

    const calendar = new VanillaCalendar(weekPickerContainer, {
        firstWeekday: firstWeekday,

        onClickDate(self, event) {
            const dateCell = event?.target?.closest('[data-vc-date]');
            if (!dateCell) {
              return;
            }
            const selectedDateStr = dateCell.dataset.vcDate; // YYYY-MM-DD
            const [year, month, day] = selectedDateStr.split('-').map(Number);
            const pickedDate = new Date(year, month - 1, day);
            window.highlightWeekInCalendar(self, pickedDate, weekStartsOn());
            window.updateWeekBadge(weekPickerContainer, pickedDate);
            handleWeekChange(pickedDate);
            window.updatePickerButtonText(pickedDate);
            self.hide();
            if (weekPickerContainer) weekPickerContainer.style.display = 'none';
          },  // <-- IMPORTANT: comma after actions

        onClickTitle: (self, event) => {
            event.stopPropagation();
            const target = event.target;
            if (target.closest('[data-vc="month"]')) {
                self.set({ type: 'month' });
            } else if (target.closest('[data-vc="year"]')) {
                self.set({ type: 'year' });
            }
        },

        onClickMonth: (self, event) => {
            event.stopPropagation();
            self.set({ type: 'default' });
        },

        onClickYear: (self, event) => {
            event.stopPropagation();
            self.set({ type: 'month' });
        },

        settings: {
            visibility: { theme: 'light', alwaysVisible: false },
            selection: { day: 'single' },
            selected: { dates: [ currentViewDate.toISOString().substring(0, 10) ] }
        }
    });

    calendar.init();
    window.highlightWeekInCalendar(calendar, currentViewDate, weekStartsOn());
    window.updateWeekBadge(weekPickerContainer, currentViewDate);
    window.window.updatePickerButtonText(currentViewDate);
    calendar.hide();
    if (weekPickerContainer) weekPickerContainer.style.display = 'none';
    window.vanillaCalendar = calendar;

    if (weekPickerBtn) {
        weekPickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (weekPickerContainer) {
                const isVisible = weekPickerContainer.style.display === 'block';
                weekPickerContainer.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) {
                    window.updateWeekBadge(weekPickerContainer, currentViewDate);
                    window.highlightWeekInCalendar(calendar, currentViewDate, weekStartsOn());
                    calendar.show();
                } else {
                    calendar.hide();
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (weekPickerContainer && !weekPickerContainer.contains(e.target) && e.target !== weekPickerBtn) {
            calendar.hide();
            if (weekPickerContainer) weekPickerContainer.style.display = 'none';
        }
    });

    window.window.updatePickerButtonText(currentViewDate); // ensure global call
};


// --- Application Entry Point ---
window.__startApp = function() {
    if (isAppInitialized) {
        return;
    }

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
