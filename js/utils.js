// Buffer de logs pour le debug et signalement de bug
export const sessionLogs = [];
const maxSessionLogs = 200;

export function bufferLog(level, args) {
  const time = new Date().toLocaleTimeString('fr-FR');
  const formatted = args.map(a => {
    if (typeof a === 'object' && a !== null) {
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }
    return String(a);
  }).join(' ');
  sessionLogs.push(`[${time}] [${level.toUpperCase()}] ${formatted}`);
  if (sessionLogs.length > maxSessionLogs) sessionLogs.shift();
}

export function setupLogging() {
  ['log', 'warn', 'error', 'info'].forEach(level => {
    const orig = console[level];
    console[level] = function (...args) {
      bufferLog(level, args);
      orig.apply(console, args);
    };
  });
}

export const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));

export const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
