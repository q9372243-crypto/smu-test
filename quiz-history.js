(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuizHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HISTORY_VERSION = 1;

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function cloneArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function outcome(answer) {
    if (answer && answer.rate === "partial") return "partial";
    if (answer && answer.submitted && answer.correct === true) return "correct";
    if (answer && answer.submitted && answer.correct === false) return "wrong";
    return "ungraded";
  }

  function summarize(results) {
    const rows = Array.isArray(results) ? results : [];
    const counts = { correct: 0, wrong: 0, partial: 0, ungraded: 0 };
    let answered = 0;
    rows.forEach(result => {
      const kind = counts[result?.outcome] === undefined ? "ungraded" : result.outcome;
      counts[kind] += 1;
      if (result?.submitted) answered += 1;
    });
    const scored = counts.correct + counts.wrong;
    return {
      total: rows.length,
      answered,
      ...counts,
      scored,
      accuracy: scored ? Math.round(counts.correct / scored * 100) : null,
    };
  }

  function buildRecord(session, byId) {
    const raw = asObject(session);
    const lookup = byId && typeof byId.get === "function" ? byId : new Map();
    const answers = asObject(raw.answers);
    const questionIds = cloneArray(raw.questionIds);
    const completedAt = Number(raw.completedAt) || Date.now();
    const startedAt = Number(raw.startedAt) || completedAt;
    const results = questionIds.map(questionId => {
      const question = asObject(lookup.get(questionId));
      const answer = asObject(answers[questionId]);
      return {
        questionId,
        subject: String(question.subject || ""),
        chapter: String(question.chapter || ""),
        type: String(question.type || ""),
        submitted: answer.submitted === true,
        outcome: outcome(answer),
        points: Number(answer.points) || 0,
      };
    });
    const settings = asObject(raw.settings);
    return {
      id: String(raw.id || raw.sessionId || `session-${completedAt}`),
      startedAt,
      completedAt,
      durationSeconds: Math.max(0, Math.round((completedAt - startedAt) / 1000)),
      isMock: raw.isMock === true,
      mockTotal: Number(raw.mockTotal) || 0,
      settings: {
        subject: String(settings.subject || ""),
        chapters: cloneArray(settings.chapters),
        types: cloneArray(settings.types),
        scope: String(settings.scope || "all"),
        order: String(settings.order || "sequential"),
        studyMode: String(settings.studyMode || "quiz"),
        limit: Number(settings.limit) || 0,
      },
      results,
      summary: summarize(results),
    };
  }

  function loadHistory(value) {
    let raw = value;
    if (typeof value === "string") {
      try { raw = JSON.parse(value); } catch { raw = null; }
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Array.isArray(raw.sessions)) {
      return { version: HISTORY_VERSION, sessions: [] };
    }
    return { version: HISTORY_VERSION, sessions: raw.sessions.filter(item => item && typeof item === "object") };
  }

  function appendRecord(history, record) {
    const current = loadHistory(history);
    const next = current.sessions.filter(item => item.id !== record.id);
    next.push(record);
    next.sort((left, right) => Number(right.completedAt) - Number(left.completedAt));
    return { version: HISTORY_VERSION, sessions: next };
  }

  function aggregateBySubject(records) {
    const subjects = new Map();
    (Array.isArray(records) ? records : []).forEach(record => {
      const completedAt = Number(record?.completedAt) || 0;
      (Array.isArray(record?.results) ? record.results : []).forEach(result => {
        if (!result?.subject || !result?.chapter) return;
        if (!subjects.has(result.subject)) subjects.set(result.subject, { subject: result.subject, results: [], sessionIds: new Set(), chapters: new Map(), completedAt: 0 });
        const subject = subjects.get(result.subject);
        subject.results.push(result);
        subject.sessionIds.add(record.id);
        subject.completedAt = Math.max(subject.completedAt, completedAt);
        if (!subject.chapters.has(result.chapter)) subject.chapters.set(result.chapter, { chapter: result.chapter, results: [], sessionIds: new Set(), completedAt: 0 });
        const chapter = subject.chapters.get(result.chapter);
        chapter.results.push(result);
        chapter.sessionIds.add(record.id);
        chapter.completedAt = Math.max(chapter.completedAt, completedAt);
      });
    });
    return [...subjects.values()].map(subject => ({
      subject: subject.subject,
      completedAt: subject.completedAt,
      sessionCount: subject.sessionIds.size,
      summary: summarize(subject.results),
      chapters: [...subject.chapters.values()]
        .map(chapter => ({ chapter: chapter.chapter, completedAt: chapter.completedAt, sessionCount: chapter.sessionIds.size, summary: summarize(chapter.results) }))
        .sort((left, right) => left.chapter.localeCompare(right.chapter, "zh-CN")),
    })).sort((left, right) => left.subject.localeCompare(right.subject, "zh-CN"));
  }

  return { HISTORY_VERSION, outcome, summarize, buildRecord, loadHistory, appendRecord, aggregateBySubject };
});
