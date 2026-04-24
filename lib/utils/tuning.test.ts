import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUNING,
  parseTuningFromSearchParams,
  resolveTuningSelection,
  sanitizeTuningSelection,
} from './tuning';

describe('tuning param parsing', () => {
  it('parses valid URL values', () => {
    expect(parseTuningFromSearchParams({ boat: '25-30', fish: 'cod', method: 'net' })).toEqual({
      boat: '25-30',
      fish: 'cod',
      method: 'net',
    });
  });

  it('drops invalid URL values', () => {
    expect(parseTuningFromSearchParams({ boat: '21', fish: 'salmon', method: 'trawl' })).toEqual({
      boat: undefined,
      fish: undefined,
      method: undefined,
    });
  });
});

describe('resolveTuningSelection precedence', () => {
  it('uses URL values over localStorage values', () => {
    const resolved = resolveTuningSelection(
      { boat: '31-40', fish: 'pollock' },
      { boat: '15-19', fish: 'cod', method: 'net' },
    );

    expect(resolved).toEqual({
      boat: '31-40',
      fish: 'pollock',
      method: 'net',
    });
  });

  it('uses localStorage as fallback when URL values are missing', () => {
    const resolved = resolveTuningSelection(
      { boat: undefined, fish: undefined, method: undefined },
      { boat: '25-30', fish: 'hake', method: 'pot' },
    );

    expect(resolved).toEqual({
      boat: '25-30',
      fish: 'hake',
      method: 'pot',
    });
  });

  it('uses defaults when URL and localStorage are absent', () => {
    expect(resolveTuningSelection({}, {})).toEqual(DEFAULT_TUNING);
    expect(resolveTuningSelection({})).toEqual(DEFAULT_TUNING);
  });

  it('remains backward compatible when no tuning params are present', () => {
    const resolved = resolveTuningSelection(parseTuningFromSearchParams({}), undefined);
    expect(resolved).toEqual(DEFAULT_TUNING);
  });

  it('sanitizes invalid local storage values', () => {
    const local = sanitizeTuningSelection({ boat: 'foo' as never, fish: 'bar' as never, method: 'baz' as never });
    expect(local).toEqual({ boat: undefined, fish: undefined, method: undefined });
  });
});
