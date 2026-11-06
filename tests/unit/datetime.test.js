import { describe, it, expect } from 'vitest';
import {
  parseDateSlashMDY,
  parseDateSlashDMY,
  parseDateDotDMY,
  parseTime24h,
  parseTime12h,
  parseWtwDateTime,
  excelSerialToDateString,
  excelSerialToTimeString,
  dateStringToExcelSerial,
  timeStringToExcelSerial
} from '../../src/core/import/datetime.js';

describe('date parsers — never guessed, strict per declared format', () => {
  it('parses MM/DD/YYYY (US order)', () => {
    expect(parseDateSlashMDY('03/24/2026')).toEqual({ ok: true, date: '2026-03-24' });
  });

  it('parses MM/DD/YY two-digit year (EUREKA)', () => {
    expect(parseDateSlashMDY('04/02/25')).toEqual({ ok: true, date: '2025-04-02' });
  });

  it('parses DD/MM/YYYY (European order, ISY_PRH)', () => {
    expect(parseDateSlashDMY('30/03/2026')).toEqual({ ok: true, date: '2026-03-30' });
  });

  it('parses D.M.YYYY (WTW)', () => {
    expect(parseDateDotDMY('24.3.2026')).toEqual({ ok: true, date: '2026-03-24' });
  });

  it('rejects an impossible day/month combination rather than guessing', () => {
    expect(parseDateSlashMDY('13/40/2025').ok).toBe(false);
    expect(parseDateSlashDMY('32/01/2025').ok).toBe(false);
  });

  it('rejects a non-existent calendar day (Feb 30)', () => {
    expect(parseDateSlashMDY('02/30/2025').ok).toBe(false);
  });

  it('accepts a leap-day only in a leap year', () => {
    expect(parseDateSlashDMY('29/02/2024').ok).toBe(true);
    expect(parseDateSlashDMY('29/02/2025').ok).toBe(false);
  });
});

describe('time parsers', () => {
  it('parses 24h HH:MM:SS', () => {
    expect(parseTime24h('09:55:02')).toEqual({ ok: true, time: '09:55:02' });
  });

  it('parses 12h with AM/PM, including the 12 AM/PM edge cases', () => {
    expect(parseTime12h('02:42:17 PM')).toEqual({ ok: true, time: '14:42:17' });
    expect(parseTime12h('12:00:00 AM')).toEqual({ ok: true, time: '00:00:00' });
    expect(parseTime12h('12:00:00 PM')).toEqual({ ok: true, time: '12:00:00' });
  });

  it('rejects out-of-range time components', () => {
    expect(parseTime24h('25:00:00').ok).toBe(false);
    expect(parseTime24h('10:70:00').ok).toBe(false);
  });

  it('parses the WTW combined cell, tolerating the trailing space', () => {
    expect(parseWtwDateTime('24.03.2026 09:50:34 ')).toEqual({ ok: true, date: '2026-03-24', time: '09:50:34' });
  });
});

describe('Excel serial round trip — pure UTC day arithmetic, no runtime-TZ drift', () => {
  it('matches the known Praha fixture date (10.8.2026 -> serial 46244)', () => {
    expect(excelSerialToDateString(46244)).toBe('2026-08-10');
    expect(dateStringToExcelSerial('2026-08-10')).toBe(46244);
  });

  it('round-trips an arbitrary date through serial and back', () => {
    const date = '2025-12-31';
    const serial = dateStringToExcelSerial(date);
    expect(excelSerialToDateString(serial)).toBe(date);
  });

  it('round-trips a time of day through serial and back', () => {
    const time = '14:42:17';
    const serial = timeStringToExcelSerial(time);
    expect(excelSerialToTimeString(serial)).toBe(time);
  });

  for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo', 'Europe/Prague']) {
    it(`date math is unaffected by process.env.TZ=${tz}`, () => {
      const original = process.env.TZ;
      process.env.TZ = tz;
      try {
        expect(excelSerialToDateString(46244)).toBe('2026-08-10');
        expect(dateStringToExcelSerial('2026-08-10')).toBe(46244);
      } finally {
        process.env.TZ = original;
      }
    });
  }
});
