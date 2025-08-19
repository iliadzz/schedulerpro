*** PATCH: js/state.js
--- a/js/state.js
+++ b/js/state.js
@@
-// (Your existing exports, including currentViewDate and weekStartsOn)
+// (Your existing exports, including currentViewDate and weekStartsOn)
+
+/**
+ * MANDATORY FIX: ensure consumers replace the full Y/M/D when changing weeks.
+ * This setter prevents accidental "partial month" mutations like:
+ *   new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), picked.getDate())
+ * which is what causes "Jan 4" to become "Aug 4".
+ */
+export function setCurrentViewDate(d) {
+  // clone to avoid external mutation and normalize to 00:00
+  const normalized = new Date(d.getFullYear(), d.getMonth(), d.getDate());
+  currentViewDate = normalized;
+  try {
+    localStorage.setItem('currentViewDate', normalized.toISOString());
+  } catch (_) {}
+}
+
+// Ensure this file continues to export currentViewDate and weekStartsOn as before.
+export { currentViewDate, weekStartsOn };
