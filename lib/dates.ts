const KST_OFFSET_MIN = 9 * 60;

export function kstNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + (KST_OFFSET_MIN + now.getTimezoneOffset()) * 60_000);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isRecentKST(dateYmd: string, now: Date = new Date()): boolean {
  const today = kstNow(now);
  const todayYmd = ymd(today);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  return dateYmd === todayYmd || dateYmd === ymd(yest);
}

export function parseLooseKoreanDate(raw: string, now: Date = new Date()): string | null {
  const m = raw.trim().match(/^(\d{2}|\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (!m) return null;
  let year = Number(m[1]);
  if (year < 100) year += 2000;
  const month = String(Number(m[2])).padStart(2, "0");
  const day = String(Number(m[3])).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatKoreanDate(now: Date = new Date()): string {
  const d = kstNow(now);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
