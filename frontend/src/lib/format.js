export function shortAddress(value, size = 4) {
  if (!value) return "—";
  const text = String(value);
  if (text.length <= size * 2 + 2) return text;
  return `${text.slice(0, size + 2)}…${text.slice(-size)}`;
}

export function formatAddress(value) {
  return value || "—";
}

export function safeAddress(value) {
  if (!value) return "—";
  try {
    const text = String(value);
    if (!text.startsWith("0x")) return "—";
    if (!/^[0-9a-fA-F]{40}$/.test(text.slice(2))) return "—";
    return shortAddress(text);
  } catch {
    return "—";
  }
}

export function formatTime(seconds) {
  if (!seconds) return "—";
  const date = new Date(Number(seconds) * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatUtc(seconds) {
  if (!seconds) return "—";
  const date = new Date(Number(seconds) * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString();
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.floor(total / 60)}m ${total % 60}s`;
  if (total < 86400) return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
  return `${Math.floor(total / 86400)}d ${Math.floor((total % 86400) / 3600)}h`;
}

export function timeAgo(seconds) {
  if (!seconds) return "—";
  const delta = Math.max(0, Math.round(Date.now() / 1000 - Number(seconds)));
  return `${formatDuration(delta)} ago`;
}

export function timeUntil(seconds) {
  if (!seconds) return "—";
  const delta = Math.round(Number(seconds) - Date.now() / 1000);
  if (delta <= 0) return "closed";
  return `about ${formatDuration(delta)}`;
}

export function isExpired(seconds) {
  return Boolean(seconds) && Number(seconds) * 1000 <= Date.now();
}

export function formatPercent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

export function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|[_\s])([a-z])/g, (_, prefix, letter) => `${prefix ? " " : ""}${letter.toUpperCase()}`);
}

export function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function plural(count, singular, pluralWord = `${singular}s`) {
  return `${count} ${Number(count) === 1 ? singular : pluralWord}`;
}