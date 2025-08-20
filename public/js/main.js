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

window.syncCalendarUI = function(date) {
  try { window.updatePickerButtonText && window.updatePickerButtonText(date); } catch (_) {}
  try {
    if (typeof weekPickerContainer !== 'undefined' && window.vanillaCalendar) {
      window.updateWeekBadge && window.updateWeekBadge(weekPickerContainer, date);
      window.highlightWeekInCalendar && window.highlightWeekInCalendar(window.vanillaCalendar, date, weekStartsOn());
      const iso = date.toISOString().slice(0,10);
      window.vanillaCalendar.set({
        selected: { dates: [iso] },
        selectedMonth: date.getMonth(),
        selectedYear: date.getFullYear(),
      });
    }
  } catch (_) {}
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

// Fixed version of reinitializeDatePickers function
// Replace the existing window.reinitializeDatePickers function in main.js with this:

window.reinitializeDatePickers = function() {
    vcLog('🔄 Reinitializing date pickers...');
    
    const weekPickerBtn = document.getElementById('date-picker-trigger-btn') || document.getElementById('week-picker-btn');
    const weekPickerContainer = document.getElementById('date-picker-container');

    // Clean up existing calendar
    if (window.vanillaCalendar) {
        vcLog('🗑️ Destroying existing calendar');
        try {
            window.vanillaCalendar.destroy();
        } catch (e) {
            vcWarn('⚠️ Error destroying calendar:', e);
        }
        window.vanillaCalendar = null;
    }

    // Remove any existing event listeners to prevent duplicates
    const oldBtn = weekPickerBtn?.cloneNode(true);
    if (oldBtn && weekPickerBtn?.parentNode) {
        weekPickerBtn.parentNode.replaceChild(oldBtn, weekPickerBtn);
    }

    const startMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const startDayKey = weekStartsOn();
    const firstWeekday = (startMap[startDayKey] ?? 1);
    
    vcLog('📅 Creating new calendar with firstWeekday:', firstWeekday, 'for', startDayKey);

    const calendar = new VanillaCalendar(weekPickerContainer, {
        enableJumpToSelectedDate: true,
        firstWeekday: firstWeekday,

        onClickDate(self, event) {
            vcLog('✅ onClickDate fired (reinit)');
            const dateCell = event?.target?.closest('[data-vc-date]');
            if (!dateCell) { 
                vcWarn('⚠️ No [data-vc-date] cell'); 
                return; 
            }

            const offsetKey = dateCell.dataset.vcDateMonth; // 'prev' | 'current' | 'next'
            let offset = 0;
            if (offsetKey === 'prev') offset = -1;
            if (offsetKey === 'next') offset = 1;

            let dispYear = self?.context?.displayYear;
            let dispMonth = self?.context?.displayMonth;

            if (!Number.isInteger(dispYear) || !Number.isInteger(dispMonth)) {
                const currCell = weekPickerContainer?.querySelector('[data-vc-date-month="current"][data-vc-date]');
                const raw = currCell?.dataset?.vcDate;
                if (raw) { 
                    const [cy, cm] = raw.split('-').map(Number); 
                    dispYear = cy; 
                    dispMonth = cm - 1; 
                    vcLog('🔎 Derived y/m from current cell:', dispYear, dispMonth); 
                }
            }

            let dayNum = NaN;
            const btn = dateCell.querySelector('[data-vc-date-btn]') || dateCell;
            if (btn && btn.textContent) { 
                dayNum = parseInt(btn.textContent.trim(), 10); 
            }
            
            vcLog('📖 displayYear/displayMonth:', dispYear, dispMonth, 'offset:', offset, 'dayNum:', dayNum);

            let pickedDate;
            if (Number.isInteger(dispYear) && Number.isInteger(dispMonth) && Number.isInteger(dayNum)) {
                let m = dispMonth + offset;
                let y = dispYear;
                if (m < 0) { m = 11; y--; }
                if (m > 11) { m = 0;  y++; }
                pickedDate = new Date(y, m, dayNum);
                vcLog('🧮 Computed pickedDate:', pickedDate.toISOString());
            } else {
                const raw = dateCell.dataset.vcDate;
                if (!raw) { 
                    vcWarn('❌ No dataset.vcDate'); 
                    return; 
                }
                vcWarn('↩️ Falling back to dataset.vcDate:', raw);
                const [year, month, day] = raw.split('-').map(Number);
                pickedDate = new Date(year, month - 1, day);
            }

            window.highlightWeekInCalendar(self, pickedDate, weekStartsOn());
            window.updateWeekBadge(weekPickerContainer, pickedDate);
            handleWeekChange(pickedDate);
            window.updatePickerButtonText(pickedDate);
            
            try { 
                self.hide(); 
            } catch (e) { 
                vcWarn('⚠️ Error hiding calendar:', e);
            }
            
            try { 
                window.syncCalendarUI && window.syncCalendarUI(pickedDate); 
            } catch (e) {
                vcWarn('⚠️ Error syncing calendar UI:', e);
            }
            
            if (weekPickerContainer) {
                weekPickerContainer.style.display = 'none';
            }
        },

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
            try { 
                event?.stopPropagation?.(); 
            } catch(_) {}
            
            vcLog('📆 onClickMonth fired (reinit)');
            
            let monthIdx;
            const mBtn = event?.target?.closest('[data-vc-months-month]') || event?.target?.closest('[data-vc-month]');
            if (mBtn) {
                monthIdx = Number(mBtn.dataset.vcMonthsMonth ?? mBtn.dataset.vcMonth);
                vcLog('📅 Picked month index via event:', monthIdx);
            } else if (typeof window.__vc_lastMonthIndex === 'number') {
                monthIdx = window.__vc_lastMonthIndex;
                vcLog('↩️ Using last captured month index:', monthIdx);
            } else {
                vcWarn('❌ Unable to determine month index');
            }
            
            let year = (typeof window.__vc_pendingYear === 'number') ? window.__vc_pendingYear : undefined;
            if (!Number.isInteger(year)) {
                const hdrYearEl = weekPickerContainer?.querySelector('.vc-header [data-vc="year"]');
                const parsed = hdrYearEl ? parseInt(hdrYearEl.textContent.trim(), 10) : NaN;
                if (!Number.isNaN(parsed)) { 
                    year = parsed; 
                    vcLog('📌 Resolved year from header:', year); 
                }
            }
            if (!Number.isInteger(year)) { 
                year = new Date().getFullYear(); 
                vcLog('🕒 Fallback year:', year); 
            }

            if (Number.isInteger(monthIdx)) {
                try {
                    self.set({ selectedMonth: monthIdx, selectedYear: year });
                    vcLog('🎯 Forced selectedMonth/selectedYear:', {monthIdx, year});
                } catch (e) { 
                    vcWarn('set(selectedMonth/Year) failed', e); 
                }
            }

            delete window.__vc_pendingYear;
            try { 
                self.set({ type: 'default' }); 
            } catch (e) { 
                vcWarn('failed to set type default', e); 
            }
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
    vcLog('✅ Calendar initialized');
    
    window.highlightWeekInCalendar(calendar, currentViewDate, weekStartsOn());
    window.updateWeekBadge(weekPickerContainer, currentViewDate);
    window.updatePickerButtonText(currentViewDate);
    calendar.hide();
    
    if (weekPickerContainer) {
        weekPickerContainer.style.display = 'none';
    }
    
    window.vanillaCalendar = calendar;

    // Re-attach button event listener using the new reference
    const newBtn = document.getElementById('date-picker-trigger-btn') || document.getElementById('week-picker-btn');
    if (newBtn) {
        vcLog('🔗 Attaching button click listener');
        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            vcLog('📍 Button clicked');
            if (weekPickerContainer) {
                const isVisible = weekPickerContainer.style.display === 'block';
                weekPickerContainer.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) {
                    window.updateWeekBadge(weekPickerContainer, currentViewDate);
                    window.highlightWeekInCalendar(calendar, currentViewDate, weekStartsOn());
                    calendar.show();
                    vcLog('📅 Calendar shown');
                } else {
                    calendar.hide();
                    vcLog('📅 Calendar hidden');
                }
            }
        });
    }

    // Re-attach document click listener for closing calendar
    // Remove old listener first to prevent duplicates
    const closeHandler = (e) => {
        if (weekPickerContainer && !weekPickerContainer.contains(e.target) && !newBtn.contains(e.target)) {
            calendar.hide();
            if (weekPickerContainer) {
                weekPickerContainer.style.display = 'none';
            }
        }
    };
    
    // Store the handler so we can remove it later if needed
    if (window.__calendarCloseHandler) {
        document.removeEventListener('click', window.__calendarCloseHandler);
    }
    window.__calendarCloseHandler = closeHandler;
    
// tie calendar root (best-effort)
const calRoot = (calendar && calendar.HTML) ? calendar.HTML : document.querySelector('.vanilla-calendar');

// === VC robust open/close guards ===
let __vcJustOpened = false;
function __vcMarkJustOpened() { __vcJustOpened = true; setTimeout(() => { __vcJustOpened = false; }, 120); }
function __vcShowCalendar(calendar, calRoot) {
  if (!calendar) return;
  if (typeof calendar.show === 'function') calendar.show();
  if (calRoot) {
    try {
      calRoot.classList && calRoot.classList.remove('vanilla-calendar_hidden','is-hidden','hidden');
      calRoot.style && (calRoot.style.display = 'block', calRoot.style.visibility = 'visible', calRoot.style.opacity = '1');
    } catch {}
  }
  __vcMarkJustOpened();
  try { console.log('[VC] ✅ Forced visible.'); } catch {}
}
function __vcMakeDocClickHandler(calendar, btn, calEl) {
  return function(e) {
    if (__vcJustOpened) return;
    const inBtn = btn && btn.contains && btn.contains(e.target);
    const inCal = calEl && calEl.contains && calEl.contains(e.target);
    if (!inBtn && !inCal) {
      try { typeof calendar.hide === 'function' && calendar.hide(); } catch {}
      try { if (calEl && calEl.style) calEl.style.display = 'none'; } catch {}
    }
  };
}
document.addEventListener('click', closeHandler);

    window.updatePickerButtonText(currentViewDate);
    vcLog('✅ Date picker reinitialization complete');
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

    // Ensure NEXT is placed immediately to the right of the date picker trigger
    try {
      var dpBtn = document.getElementById('date-picker-trigger-btn');
      var nextBtn = (dom && dom.nextWeekBtn) ? dom.nextWeekBtn : document.getElementById('next-week-btn');
      if (dpBtn && nextBtn && dpBtn.parentNode && nextBtn.parentNode === dpBtn.parentNode) {
        if (dpBtn.nextElementSibling !== nextBtn) {
          dpBtn.parentNode.insertBefore(nextBtn, dpBtn.nextElementSibling);
        }
      }
    } catch (e) { /* ignore */ }

    if (dom.prevWeekBtn) dom.prevWeekBtn.addEventListener('click', function(){ setTimeout(function(){ window.syncCalendarUI && window.syncCalendarUI(currentViewDate); }, 0); });
    if (dom.nextWeekBtn) dom.nextWeekBtn.addEventListener('click', function(){ setTimeout(function(){ window.syncCalendarUI && window.syncCalendarUI(currentViewDate); }, 0); });
    if (dom.thisWeekBtn) dom.thisWeekBtn.addEventListener('click', function(){ setTimeout(function(){ window.syncCalendarUI && window.syncCalendarUI(currentViewDate); }, 0); });
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
