*** PATCH: js/ui/scheduler.js
--- a/js/ui/scheduler.js
+++ b/js/ui/scheduler.js
@@
-import { /* existing imports */ } from './whatever.js';
+// Keep your existing imports, then add:
+import { setCurrentViewDate, weekStartsOn, currentViewDate } from '../state.js';
+import { getWeekRange } from '../utils.js';
@@
-export function handleWeekChange(dateOrEvent) {
-  // (old logic that might rebuild from current month/year)
-}
+/**
+ * Robust week change handler.
+ * Accepts a Date or an <input type="date"> change event and replaces the view date entirely.
+ */
+export function handleWeekChange(dateOrEvent) {
+  let picked;
+  if (dateOrEvent instanceof Date) {
+    picked = dateOrEvent;
+  } else if (dateOrEvent?.target?.value) {
+    const [yy, mm, dd] = dateOrEvent.target.value.split('-').map(Number);
+    picked = new Date(yy, mm - 1, dd);
+  } else {
+    return;
+  }
+
+  // Optional: snap to the start of the week according to settings
+  const range = getWeekRange(picked, weekStartsOn());
+  const startOfWeek = new Date(
+    range.start.getFullYear(),
+    range.start.getMonth(),
+    range.start.getDate()
+  );
+
+  console.debug('[weekChange] picked:', picked.toISOString(), 'startOfWeek:', startOfWeek.toISOString());
+
+  // CRITICAL: replace the whole date (Y/M/D) in state
+  setCurrentViewDate(startOfWeek);
+
+  // Re-render with the new date in state (adjust to your existing pipeline)
+  renderWeeklySchedule();
+}
@@
-export function handlePrevWeek() {
-  // old logic...
-}
+export function handlePrevWeek() {
+  const d = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), currentViewDate.getDate() - 7);
+  setCurrentViewDate(d);
+  renderWeeklySchedule();
+}
@@
-export function handleNextWeek() {
-  // old logic...
-}
+export function handleNextWeek() {
+  const d = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), currentViewDate.getDate() + 7);
+  setCurrentViewDate(d);
+  renderWeeklySchedule();
+}
@@
-export function handleThisWeek() {
-  // old logic...
-}
+export function handleThisWeek() {
+  const now = new Date();
+  setCurrentViewDate(now);
+  renderWeeklySchedule();
+}
