import { describe, it, expect } from 'vitest';
import { smsSegmentInfo } from '../../server/lib/sms/segments';

describe('smsSegmentInfo', () => {
  it('empty body is zero segments', () => {
    expect(smsSegmentInfo('')).toEqual({ encoding: 'gsm', length: 0, segments: 0 });
  });

  it('short GSM-7 body is one segment', () => {
    const r = smsSegmentInfo('Your inspection is ready.');
    expect(r.encoding).toBe('gsm');
    expect(r.segments).toBe(1);
  });

  it('GSM-7 body over 160 chars splits at 153 chars/part', () => {
    const r = smsSegmentInfo('a'.repeat(161));
    expect(r.encoding).toBe('gsm');
    expect(r.segments).toBe(2); // ceil(161/153)
  });

  it('a Unicode char forces unicode encoding and 70-char single-segment limit', () => {
    const r = smsSegmentInfo('Café ' + 'a'.repeat(70));
    expect(r.encoding).toBe('unicode');
    expect(r.segments).toBe(2); // 75 chars > 70 → ceil(75/67)
  });
});
