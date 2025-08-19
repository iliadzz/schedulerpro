// js/main.js (merged fix)
// - Fixes week selection jumping to current month by ensuring a full YYYY-MM-DD
//   is constructed in onClickDate and passed through to handleWeekChange.
// - Adds debug logs to trace the date throughout the flow.
// - Includes an optional microtask nudge in onClickMonth to ensure VC view commit.
// - Keeps highlight/update helpers as single source of truth and adds comments.

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
  // Map settings key to JS Date.getDay() (0..6). Keeps logic centralized.
  function weekStartIndex(key){ // for JS Date.getDay (0=Sun..6=Sat)
    var map = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
    return (map[key] != null) ? map[key] : 1;
  }

  // Highlight the full week of "date" in VanillaCalendar
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

  // Small UI badge above the calendar showing the selected week range
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

  // Format the week range label (e.g., Jan 1 – Jan 7)
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

// Re-initialize the VanillaCalendar week picker and wire its click handlers.
window.reinitializeDatePickers = function() {
    const weekPickerBtn = document.getElementById('date-picker-trigger-btn') || document.getElementById('week-picker-btn');
    const weekPickerContainer = document.getElementById('date-picker-container');

    if (window.vanillaCalendar) {
        window.vanillaCalendar.destroy();
    }

    const startMap = { sun: 7, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const startDayKey = weekStartsOn();
    const firstWeekday = startMap[startDayKey] || 1;

    const calendar = new VanillaCalendar(weekPickerContainer, {
        firstWeekday: firstWeekday,

        // CRITICAL: Build a COMPLETE date from either VC's selectedDates or the current view + clicked day.
        onClickDate: function (self, event) {
            if (event) event.stopPropagation();

            // Prefer the ISO string VanillaCalendar usually provides:
            let iso = self?.context?.selectedDates?.[0] || null;

            // If not present (can happen after switching month/year), build ISO from view state + clicked day
            if (!iso) {
                const viewYear  = self?.context?.date?.current?.year;   // e.g. 2026
                const viewMonth = self?.context?.date?.current?.month;  // 1..12
                // Try to grab the day from dataset; fallback to text
                const day = Number(event?.target?.dataset?.calendarDay ?? event?.target?.textContent);
                if (viewYear && viewMonth && day) {
                    const mm = String(viewMonth).padStart(2, '0');
                    const dd = String(day).padStart(2, '0');
                    iso = `${viewYear}-${mm}-${dd}`;
                }
            }

            if (!iso) return;

            const [y, m, dNum] = iso.split('-').map(Number);
            const picked = new Date(y, m - 1, dNum);

            // Debug trace to verify what we're passing forward
            console.debug('[vc] iso:', iso, 'picked:', picked.toISOString());

            window.highlightWeekInCalendar(calendar, picked, weekStartsOn());
            window.updateWeekBadge(weekPickerContainer, picked);
            handleWeekChange(picked);
            window.updatePickerButtonText(picked);
            calendar.hide();
            if (weekPickerContainer) { weekPickerContainer.style.display = 'none'; }
        },

        // Allow clicking title parts to change view type (month/year pickers)
        onClickTitle: (self, event) => {
            event.stopPropagation(); // Prevents the calendar from closing
            const target = event.target;
            if (target.closest('[data-vc="month"]')) {
                self.set({ type: 'month' });
            } else if (target.closest('[data-vc="year"]')) {
                self.set({ type: 'year' });
            }
        },

        // When a month is picked, return to day view. A tiny microtask helps VC commit its view.
        onClickMonth: (self, event) => {
            event.stopPropagation();
            self.set({ type: 'default' }); // Switch back to day view
            // Optional guard: ensure the internal view commit completes before the very next click.
            queueMicrotask(() => {});
        },

        // When a year is picked, go select the month next.
        onClickYear: (self, event) => {
            event.stopPropagation();
            self.set({ type: 'month' }); // Switch to month view for the new year
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
    window.updatePickerButtonText(currentViewDate);
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

    // Close calendar when clicking outside
    document.addEventListener('click', (e) => {
        if (weekPickerContainer && !weekPickerContainer.contains(e.target) && e.target !== weekPickerBtn) {
            calendar.hide();
            if (weekPickerContainer) weekPickerContainer.style.display = 'none';
        }
    });

    // Ensure button label matches current view on init
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

    const confirmCopyWeekBtn = document.getElementById('confirm-copyWeek-btn');
    // Fix potential ID typo by guarding both IDs
    const confirmCopyWeekBtnAlt = document.getElementById('confirm-copy-week-btn');
    if (confirmCopyWeekBtn) confirmCopyWeekBtn.addEventListener('click', executeCopyWeek);
    if (confirmCopyWeekBtnAlt) confirmCopyWeekBtnAlt.addEventListener('click', executeCopyWeek);

    dom.clearCurrentWeekBtn.addEventListener('click', handleClearWeek);
    dom.manageEventsBtn.addEventListener('click', showEventsModal);

    dom.saveRestaurantSettingsBtn.addEventListener('click', handleSaveSettings);
    dom.backupAllDataBtn.addEventListener('click', handleFullBackup);
    dom.restoreDataInput.addEventListener('change', handleRestoreFile);
    dom.saveAssignedShiftBtn.addEventListener('click', handleAssignShift);
    dom.addEventBtn.addEventListener('click', handleSaveEvent);

    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) addEventListener('click', () => { HistoryManager.undo(); renderWeeklySchedule(); });
    if (redoBtn) addEventListener('click', () => { HistoryManager.redo(); renderWeeklySchedule(); });

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
