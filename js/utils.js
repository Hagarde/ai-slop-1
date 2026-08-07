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

export function shuffle(items) { 
  return [...items].sort(() => Math.random() - 0.5); 
}
