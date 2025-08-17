// js/utils.js

export function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return "Invalid Date";
    return date.toISOString().split('T')[0];
}

/**
 * Calculates the start and end dates of a week based on a given date and a specified start day.
 * @param {Date} date - The date to get the week range for.
 * @param {string} [startDay='mon'] - The day the week starts on ('sun' or 'mon').
 * @returns {{start: Date, end: Date}} An object containing the start and end dates of the week.
 */
export function getWeekRange(date, startDay = 'mon') {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // Normalize to the start of the day

    const dayOfWeek = d.getDay(); // Sunday is 0, Monday is 1, etc.

    let diff;
    if (startDay === 'mon') {
        // If today is Sunday (0), we need to go back 6 days. Otherwise, go back (dayOfWeek - 1) days.
        diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    } else { // 'sun'
        // If today is Sunday (0), diff is 0. If Monday (1), go back 1 day, etc.
        diff = -dayOfWeek;
    }

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() + diff);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return { start: weekStart, end: weekEnd };
}


export function getDatesOfWeek(startDate) {
    const dates = [];
    let currentDate = new Date(startDate);
    for (let i = 0; i < 7; i++) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
}

export function formatTimeForDisplay(timeStr) {
    if (!timeStr) return '';
    return timeStr;
}

export function formatTimeToHHMM(hour, minute) {
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${h}:${m}`;
}

export function calculateShiftDuration(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    let diff = (end - start) / (1000 * 60 * 60);
    if (diff < 0) diff += 24; // Handles overnight shifts
    return diff;
}

export function populateTimeSelectsForElements(hourSelect, minuteSelect, defaultHour = "09", defaultMinute = "00") {
    if (!hourSelect || !minuteSelect) return;
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];
    hourSelect.innerHTML = '';
    hours.forEach(hour => {
        const option = document.createElement('option');
        option.value = hour;
        option.textContent = hour;
        hourSelect.appendChild(option);
    });
    minuteSelect.innerHTML = '';
    minutes.forEach(minute => {
        const option = document.createElement('option');
        option.value = minute;
        option.textContent = minute;
        minuteSelect.appendChild(option);
    });
    hourSelect.value = defaultHour;
    minuteSelect.value = defaultMinute;
}

export function getContrastColor(hexColor) {
    if (!hexColor || hexColor.length < 7) return '#1C3A4D';
    try {
        let r = parseInt(hexColor.substr(1, 2), 16);
        let g = parseInt(hexColor.substr(3, 2), 16);
        let b = parseInt(hexColor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#1C3A4D' : '#FFFFFF';
    } catch (e) {
        return '#1C3A4D';
    }
}

export function createItemActionButtons(editHandler, deleteHandler) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'item-actions';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.title = 'Edit';
    editBtn.onclick = editHandler;
    actionsDiv.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.title = 'Delete';
    deleteBtn.classList.add('danger-btn');
    deleteBtn.onclick = deleteHandler;
    actionsDiv.appendChild(deleteBtn);

    return actionsDiv;
}

// --- NEW AND IMPROVED TIME FUNCTIONS ---

/**
 * Converts "HH:MM" time string to total minutes from midnight.
 * @param {string} hhmm - The time string "HH:MM".
 * @returns {number}
 */
export function timeToMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Normalizes a time span to handle overnight shifts (e.g., 22:00-02:00).
 * @param {number} startMin - Start time in minutes.
 * @param {number} endMin - End time in minutes.
 * @returns {Array<number>} An array [start, end] with end adjusted for overnight.
 */
function normalizeSpan(startMin, endMin) {
  return endMin >= startMin ? [startMin, endMin] : [startMin, endMin + 24 * 60];
}

/**
 * Calculates the total number of overlapping minutes between two time spans.
 * @param {string} shiftStart - "HH:MM"
 * @param {string} shiftEnd - "HH:MM"
 * @param {string} periodStart - "HH:MM"
 * @param {string} periodEnd - "HH:MM"
 * @returns {number}
 */
export function calculateOverlap(shiftStart, shiftEnd, periodStart, periodEnd) {
    const [as, ae] = normalizeSpan(timeToMinutes(shiftStart), timeToMinutes(shiftEnd));
    const [bs, be] = normalizeSpan(timeToMinutes(periodStart), timeToMinutes(periodEnd));
    
    const overlapStart = Math.max(as, bs);
    const overlapEnd = Math.min(ae, be);

    return Math.max(0, overlapEnd - overlapStart);
}