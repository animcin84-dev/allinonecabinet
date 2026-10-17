import { describe, expect, it } from 'vitest'
import { calendarFile, csvFile } from './export'
describe('local portable exports', () => {
  it('uses UTC instants and preserves Cyrillic across byte-limited folded lines', () => {
    const title = 'Демо: Кездесу · Встреча '.repeat(12)
    const content = calendarFile({id:'meeting-demo',title,start:'2026-10-10T18:00:00+05:00',end:'2026-10-10T19:00:00+05:00',description:'Алматы; команда, перевод\\язык\nДемо'},'2026-10-10T08:00:00Z')
    const unfolded = content.replace(/\r\n /g,'')
    expect(unfolded).toContain('DTSTART:20261010T130000Z\r\nDTEND:20261010T140000Z')
    expect(unfolded).toContain(`SUMMARY:${title}`)
    expect(unfolded).toContain('DESCRIPTION:Алматы\\; команда\\, перевод\\\\язык\\nДемо')
    expect(content.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75)).toBe(true)
  })
  it('does not turn TEXT into extra calendar properties; keeps stable UID and cancelled status', () => {
    const content = calendarFile({id:'meeting-demo',title:'Test\r\nATTENDEE:malicious',start:'2026-10-10T13:00:00Z',description:'Demo',cancelled:true})
    expect(content).toContain('SUMMARY:Test\\nATTENDEE:malicious')
    expect(content).not.toContain('\r\nATTENDEE:')
    expect(content).toContain('UID:meeting-demo@allinone.local')
    expect(content).toContain('STATUS:CANCELLED')
    expect(content).not.toContain('DTEND:')
    expect(()=>calendarFile({id:'x',title:'x',start:'invalid',description:'x'})).toThrow('invalidDate')
  })
  it('quotes delimiters/newlines and neutralizes untrusted formulas while retaining numeric corrections', () => {
    const csv = csvFile([['Дата','Причина','XP'],['Алматы','текст, "цитата"\nстрока',-10],['=HYPERLINK("x")','  ＋SUM(1)',20],['\t=1','@SUM(1)',0]])
    expect(csv.startsWith('\ufeff')).toBe(true)
    expect(csv).toContain('"текст, ""цитата""\nстрока",-10')
    expect(csv).toContain('"\t=HYPERLINK(""x"")"')
    expect(csv).toContain('"\t  ＋SUM(1)"')
    expect(csv).toContain('"\t@SUM(1)"')
    expect(()=>csvFile([[Number.NaN]])).toThrow('invalidNumber')
  })
})
