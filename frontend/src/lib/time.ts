/** Replay clock. Hour 0 is 25 May 2025 00:00 IST; the replay runs 336 hours. */
export const HOURS = 336;
export const T0_UTC_MS = Date.UTC(2025, 4, 24, 18, 30); // 25 May 2025 00:00 IST
const IST_OFFSET_MS = 5.5 * 3600e3;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const at = (h: number) => new Date(T0_UTC_MS + h * 3600e3 + IST_OFFSET_MS);

export const dayLabel = (h: number) => {
  const d = at(h);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};
export const timeLabel = (h: number) => `${String(at(h).getUTCHours()).padStart(2, "0")}:00`;
export const dtLabel = (h: number) => `${dayLabel(h)}, ${timeLabel(h)}`;
export const dtIst = (h: number) => `${dtLabel(h)} IST`;
export const dayIndex = (h: number) => Math.floor(h / 24);
