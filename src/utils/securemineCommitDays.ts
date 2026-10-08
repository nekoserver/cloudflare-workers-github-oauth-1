import { getCalendarMonth } from './securemineCalendar';

export function mergeCommitDays(year: number, month: number, dates: string[], summaries: string[]): number[] {
  const prefix = year + '-' + String(month).padStart(2, '0') + '-';
  const days = new Set<number>();
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const add = (date: string) => {
    if (!date.startsWith(prefix) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const day = Number(date.slice(-2));
    if (day >= 1 && day <= last) days.add(day);
  };
  dates.forEach(add);
  for (const summary of summaries) {
    const counts = JSON.parse(summary);
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) throw new Error('Invalid commit counts');
    for (const [date, count] of Object.entries(counts)) {
      if (typeof count === 'number' && count > 0) add(date);
    }
  }
  return [...days].sort((a,b) => a-b);
}

export async function readWorkspaceCommitDays(db: D1Database, workspaceId: string, now: Date) {
  const {year, month} = getCalendarMonth(now);
  const prefix = year + '-' + String(month).padStart(2, '0') + '-';
  const [lists, summaries] = await Promise.all([
    db.prepare('SELECT DISTINCT date FROM commit_list_cache WHERE workspace_id = ? AND date LIKE ? AND commit_count > 0')
      .bind(workspaceId, prefix + '%').all<{date:string}>(),
    db.prepare('SELECT counts FROM commit_calendar_cache WHERE workspace_id = ? AND year = ? AND month = ?')
      .bind(workspaceId,year,month).all<{counts:string}>(),
  ]);
  return {year,month,days:mergeCommitDays(year,month,(lists.results || []).map(r=>r.date),(summaries.results || []).map(r=>r.counts))};
}
