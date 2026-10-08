/** Calendar uses JST, matching the existing GitHub commit date keys. */
export function getCalendarMonth(now: Date) {
  const parts = new Intl.DateTimeFormat('en', {timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now);
  const number = (name: string) => Number(parts.find(p => p.type === name)?.value);
  return {year:number('year'),month:number('month'),today:number('day')};
}

export function getSecuremineCalendarScript(): string {
  return `
(function() {
  const calendar = document.getElementById('commitCalendar');
  const status = document.getElementById('calendarStatus');
  function monthParts(now) {
    const parts = new Intl.DateTimeFormat('en', {timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now);
    const number = name => Number(parts.find(p => p.type === name).value);
    return {year:number('year'),month:number('month'),today:number('day')};
  }
  function draw(year, month, days) {
    const current = monthParts(new Date());
    const highlighted = new Set(days);
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    document.getElementById('calendarMonth').textContent = year + '年' + month + '月';
    calendar.setAttribute('aria-label', year + '年' + month + '月 コミットカレンダー');
    const body = calendar.querySelector('tbody'); body.replaceChildren();
    let row;
    for (let cell = 0; cell < Math.ceil((first + count) / 7) * 7; cell++) {
      if (cell % 7 === 0) { row = document.createElement('tr'); body.append(row); }
      const td = document.createElement('td'); row.append(td);
      const day = cell - first + 1;
      if (day < 1 || day > count) continue;
      const date = document.createElement('span');
      date.className = 'calendar-day' + (highlighted.has(day) ? ' has-commits' : '');
      date.textContent = String(day);
      const label = year + '年' + month + '月' + day + '日' + (highlighted.has(day) ? ' コミットログあり' : '');
      date.setAttribute('aria-label', label); date.title = label;
      if (year === current.year && month === current.month && day === current.today) date.setAttribute('aria-current', 'date');
      date.dataset.day = String(day); td.append(date);
    }
  }
  const initial = monthParts(new Date()); draw(initial.year, initial.month, []);
  let pending = false;
  async function refresh() {
    if (pending) return;
    pending = true; status.textContent = 'コミットログを確認中…';
    try {
      const response = await fetch('/api/taskmine/commit-calendar', {credentials:'same-origin',headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!Number.isInteger(data.year) || !Number.isInteger(data.month) || data.month < 1 || data.month > 12 || !Array.isArray(data.days)) throw new Error('Invalid calendar');
      draw(data.year, data.month, data.days.filter(day => Number.isInteger(day) && day > 0 && day <= 31));
      status.textContent = data.days.length ? '薄水色：コミットログあり' : '今月のコミットログはありません';
    } catch {
      status.textContent = 'コミットログを取得できませんでした';
    } finally { pending = false; }
  }
  document.getElementById('calendarRefresh').onclick = refresh;
  refresh();
})();`;
}
