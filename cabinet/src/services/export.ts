/** Local downloads only; neither export contacts a calendar or spreadsheet service. */
export function downloadText(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Keep the URL alive while the browser starts the download.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function calendarText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
}
function utc(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('invalidDate')
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
function fold(line: string) {
  const encoder = new TextEncoder()
  let output = '', length = 0
  for (const character of line) {
    const bytes = encoder.encode(character).length
    if (length + bytes > 75) { output += '\r\n '; length = 1 }
    output += character
    length += bytes
  }
  return output
}
export interface CalendarExport {
  id: string
  title: string
  start: string
  end?: string
  description: string
  location?: string
  cancelled?: boolean
}
/** RFC 5545: UTC timestamps, escaped TEXT, CRLF and UTF-8-safe 75-octet folding. */
export function calendarFile(event: CalendarExport, now = new Date().toISOString()) {
  const start = utc(event.start)
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Allinone//Frontend Demo//RU',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${encodeURIComponent(event.id)}@allinone.local`, `DTSTAMP:${utc(now)}`,
    `DTSTART:${start}`,
  ]
  if (event.end && Date.parse(event.end) > Date.parse(event.start)) lines.push(`DTEND:${utc(event.end)}`)
  lines.push(`SUMMARY:${calendarText(event.title)}`, `DESCRIPTION:${calendarText(event.description)}`)
  if (event.location) lines.push(`LOCATION:${calendarText(event.location)}`)
  lines.push(`STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT', 'END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
/** CSV for human viewing. Protect untrusted text from spreadsheet formula interpretation. */
export function csvFile(rows: (string | number)[][]) {
  return '\ufeff' + rows.map((row) => row.map((value) => {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('invalidNumber')
      return String(value)
    }
    const safe = /^[\s]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(value) ? `\t${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }).join(',')).join('\r\n') + '\r\n'
}
