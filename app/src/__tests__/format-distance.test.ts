import { formatDistance } from '../utils/format-distance';

describe('formatDistance', () => {
  it('formats 500 meters as "500m"', () => {
    expect(formatDistance(500)).toBe('500m');
  });

  it('formats 999 meters as "999m"', () => {
    expect(formatDistance(999)).toBe('999m');
  });

  it('formats 1000 meters as "1.0km"', () => {
    expect(formatDistance(1000)).toBe('1.0km');
  });

  it('formats 2200 meters as "2.2km"', () => {
    expect(formatDistance(2200)).toBe('2.2km');
  });

  it('formats 10000 meters as "10km"', () => {
    expect(formatDistance(10000)).toBe('10km');
  });

  it('formats 15750 meters as "16km"', () => {
    expect(formatDistance(15750)).toBe('16km');
  });
});
