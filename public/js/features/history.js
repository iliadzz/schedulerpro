// js/features/history.js

import { scheduleAssignments, saveScheduleAssignments } from '../state.js';
import { generateId } from '../utils.js';
import { renderWeeklySchedule } from '../ui/scheduler.js';

const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

let historyStack = [];
let historyPointer = -1;

export function ModifyAssignmentCommand(userId, dateStr, newAssignment, oldAssignment = null) {
    this.userId = userId;
    this.dateStr = dateStr;
    this.newAssignment = { ...newAssignment };
    this.oldAssignment = oldAssignment ? { ...oldAssignment } : null;
    this.assignmentKey = `${userId}-${dateStr}`;

    this.execute = function() {
        const dayData = scheduleAssignments[this.assignmentKey] || { shifts: [] };
        scheduleAssignments[this.assignmentKey] = dayData;
        const index = this.oldAssignment ? dayData.shifts.findIndex(a => a.assignmentId === this.oldAssignment.assignmentId) : -1;

        if (index > -1) {
            dayData.shifts[index] = this.newAssignment;
        } else {
            dayData.shifts.push(this.newAssignment);
        }
        // FIX: Pass the specific document ID that was changed to the save function.
        saveScheduleAssignments([this.assignmentKey]);
        renderWeeklySchedule();
    };

    this.undo = function() {
        const dayData = scheduleAssignments[this.assignmentKey];
        const index = dayData.shifts.findIndex(a => a.assignmentId === this.newAssignment.assignmentId);

        if (index > -1) {
            if (this.oldAssignment) {
                dayData.shifts[index] = this.oldAssignment;
            } else {
                dayData.shifts.splice(index, 1);
                 // If the last shift is removed, delete the whole entry
                if (dayData.shifts.length === 0) {
                    delete scheduleAssignments[this.assignmentKey];
                }
            }
        }
        // FIX: Pass the specific document ID that was changed to the save function.
        saveScheduleAssignments([this.assignmentKey]);
        renderWeeklySchedule();
    };
}

export function DeleteAssignmentCommand(userId, dateStr, assignmentId) {
    this.userId = userId;
    this.dateStr = dateStr;
    this.assignmentId = assignmentId;
    this.assignmentKey = `${userId}-${dateStr}`;
    this.deletedAssignment = null;

    this.execute = function() {
        const dayData = scheduleAssignments[this.assignmentKey];
        if (dayData && dayData.shifts) {
            const index = dayData.shifts.findIndex(a => a.assignmentId === this.assignmentId);
            if (index > -1) {
                this.deletedAssignment = dayData.shifts.splice(index, 1)[0];
                if (dayData.shifts.length === 0) {
                    delete scheduleAssignments[this.assignmentKey];
                }
            }
        }
        // FIX: Pass the specific document ID that was changed to the save function.
        saveScheduleAssignments([this.assignmentKey]);
        renderWeeklySchedule();
    };

    this.undo = function() {
        if (!this.deletedAssignment) return;
        const dayData = scheduleAssignments[this.assignmentKey] || { shifts: [] };
        scheduleAssignments[this.assignmentKey] = dayData;
        dayData.shifts.push(this.deletedAssignment);
        // FIX: Pass the specific document ID that was changed to the save function.
        saveScheduleAssignments([this.assignmentKey]);
        renderWeeklySchedule();
    };
}

export function DragDropCommand(dragDetails) {
    this.assignment = { ...dragDetails, assignmentId: dragDetails.newAssignmentId || generateId('assign') };
    delete this.assignment.originalUserId;
    delete this.assignment.originalDateStr;
    delete this.assignment.isCopyOperation;
    delete this.assignment.targetUserId;
    delete this.assignment.targetDateStr;
    delete this.assignment.newAssignmentId;

    this.sourceUserId = dragDetails.originalUserId;
    this.sourceDateStr = dragDetails.originalDateStr;
    this.sourceKey = `${this.sourceUserId}-${this.sourceDateStr}`;

    this.targetUserId = dragDetails.targetUserId;
    this.targetDateStr = dragDetails.targetDateStr;
    this.targetKey = `${this.targetUserId}-${this.targetDateStr}`;

    this.isCopy = dragDetails.isCopyOperation;

    this.execute = function() {
        if (!scheduleAssignments[this.targetKey]) {
            scheduleAssignments[this.targetKey] = { shifts: [] };
        }
        scheduleAssignments[this.targetKey].shifts.push(this.assignment);

        const dirtyKeys = [this.targetKey];

        if (!this.isCopy) {
            const sourceDay = scheduleAssignments[this.sourceKey];
            const index = sourceDay.shifts.findIndex(a => a.assignmentId === dragDetails.assignmentId);
            if (index > -1) sourceDay.shifts.splice(index, 1);
            if (sourceDay.shifts.length === 0) delete scheduleAssignments[this.sourceKey];
            dirtyKeys.push(this.sourceKey);
        }
        // FIX: Pass all modified document IDs to the save function.
        saveScheduleAssignments(dirtyKeys);
        renderWeeklySchedule();
    };

    this.undo = function() {
        const targetDay = scheduleAssignments[this.targetKey];
        const index = targetDay.shifts.findIndex(a => a.assignmentId === this.assignment.assignmentId);
        if (index > -1) targetDay.shifts.splice(index, 1);
        if (targetDay.shifts.length === 0) delete scheduleAssignments[this.targetKey];

        const dirtyKeys = [this.targetKey];

        if (!this.isCopy) {
            const sourceDay = scheduleAssignments[this.sourceKey] || { shifts: [] };
            scheduleAssignments[this.sourceKey] = sourceDay;
            const originalAssignment = { ...this.assignment, assignmentId: dragDetails.assignmentId };
            sourceDay.shifts.push(originalAssignment);
            dirtyKeys.push(this.sourceKey);
        }
        // FIX: Pass all modified document IDs to the save function.
        saveScheduleAssignments(dirtyKeys);
        renderWeeklySchedule();
    };
}

export const HistoryManager = {
    doAction: function(command) {
        if (historyPointer < historyStack.length - 1) {
            historyStack = historyStack.slice(0, historyPointer + 1);
        }
        historyStack.push(command);
        historyPointer++;
        command.execute();
        this.updateUndoRedoButtons();
    },
    undo: function() {
        if (historyPointer >= 0) {
            const command = historyStack[historyPointer];
            command.undo();
            historyPointer--;
            this.updateUndoRedoButtons();
        }
    },
    redo: function() {
        if (historyPointer < historyStack.length - 1) {
            historyPointer++;
            const command = historyStack[historyPointer];
            command.execute();
            this.updateUndoRedoButtons();
        }
    },
    updateUndoRedoButtons: function() {
        if (undoBtn && redoBtn) {
            undoBtn.disabled = historyPointer < 0;
            redoBtn.disabled = historyPointer >= historyStack.length - 1;
        }
    },
    clear: function() {
        historyStack = [];
        historyPointer = -1;
        this.updateUndoRedoButtons();
    }
};