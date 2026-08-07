(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuizSessions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;

  function normalize(raw) {
    const bySubject = raw && typeof raw === "object" && !Array.isArray(raw) && raw.bySubject && typeof raw.bySubject === "object" && !Array.isArray(raw.bySubject)
      ? { ...raw.bySubject }
      : {};
    return { version: VERSION, bySubject };
  }

  function subjectOf(session) {
    const subject = session?.settings?.subject;
    return typeof subject === "string" && subject.trim() ? subject : "";
  }

  function save(raw, session) {
    const subject = subjectOf(session);
    const next = normalize(raw);
    if (subject) next.bySubject[subject] = session;
    return next;
  }

  function loadForSubject(raw, subject) {
    const session = normalize(raw).bySubject[subject];
    return session && typeof session === "object" && !Array.isArray(session) ? session : null;
  }

  function removeForSubject(raw, subject) {
    const next = normalize(raw);
    delete next.bySubject[subject];
    return next;
  }

  function migrateLegacy(raw, legacySession) {
    return subjectOf(legacySession) ? save(raw, legacySession) : normalize(raw);
  }

  return { VERSION, normalize, save, loadForSubject, removeForSubject, migrateLegacy };
});
