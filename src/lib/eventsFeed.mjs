// Events calendar feed (2026-10-02): upcoming events from Promotions posts as an iCalendar (.ics)
// feed at https://revlo.ng/events.ics, for event listing sites (e.g. Allevents) and calendar apps.

const icsText = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTime = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// Lines longer than 75 octets are folded, as the format requires.
const fold = line => { const out = []; let rest = line; while (Buffer.byteLength(rest) > 74) { let cut = 74; while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut -= 1; out.push(rest.slice(0, cut)); rest = ` ${rest.slice(cut)}`; } out.push(rest); return out.join('\r\n'); };

/** events: [{ uid, title, summary, start, end, venue, location, url, created_at }] */
export function buildIcs(events, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Revlo.ng//Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Revlo.ng events', 'X-WR-TIMEZONE:Africa/Lagos'];
  for (const e of events) {
    const end = e.end || new Date(new Date(e.start).getTime() + 2 * 3600000).toISOString();
    lines.push('BEGIN:VEVENT',
      `UID:${e.uid}@revlo.ng`,
      `DTSTAMP:${icsTime(e.created_at || now)}`,
      `DTSTART:${icsTime(e.start)}`,
      `DTEND:${icsTime(end)}`,
      `SUMMARY:${icsText(e.title)}`,
      `LOCATION:${icsText([e.venue, e.location].filter(Boolean).join(', '))}`,
      `DESCRIPTION:${icsText(`${e.summary || ''}\n\nMore on Revlo.ng: ${e.url}`.trim())}`,
      `URL:${e.url}`,
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
