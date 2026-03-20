import { describe, it, expect } from 'vitest';
import { serialize, deserialize, validateSerializable } from '@/storage/serialization';

// AC-10: Set serialized as sorted array
describe('serialize - Set handling', () => {
  it('converts Set to sorted array', () => {
    const data = { items: new Set([3, 1, 2]) };
    const json = serialize(data);
    const parsed = JSON.parse(json);
    expect(parsed.items).toEqual([1, 2, 3]);
  });

  it('handles empty Set', () => {
    const json = serialize({ s: new Set<number>() });
    const parsed = JSON.parse(json);
    expect(parsed.s).toEqual([]);
  });
});

// AC-11: Map serialized as Record
describe('serialize - Map handling', () => {
  it('converts Map to Record object', () => {
    const data = { map: new Map([['a', 1], ['b', 2]]) };
    const json = serialize(data);
    const parsed = JSON.parse(json);
    expect(parsed.map).toEqual({ a: 1, b: 2 });
  });

  it('handles empty Map', () => {
    const json = serialize({ m: new Map() });
    const parsed = JSON.parse(json);
    expect(parsed.m).toEqual({});
  });
});

// AC-12: Date serialized as ISO string
describe('serialize - Date handling', () => {
  it('converts Date to ISO string', () => {
    const date = new Date('2024-01-15T12:00:00.000Z');
    const json = serialize({ date });
    const parsed = JSON.parse(json);
    expect(parsed.date).toBe('2024-01-15T12:00:00.000Z');
  });
});

// AC-13: undefined serialized as null
describe('serialize - undefined handling', () => {
  it('converts undefined to null', () => {
    const data = { value: undefined as unknown };
    const json = serialize(data);
    const parsed = JSON.parse(json);
    expect(parsed.value).toBeNull();
  });
});

// Round-trip test
describe('deserialize', () => {
  it('round-trips plain objects', () => {
    const data = { name: 'Alice', chips: 1500, active: true };
    const json = serialize(data);
    const result = deserialize<typeof data>(json);
    expect(result).toEqual(data);
  });

  it('round-trips nested objects', () => {
    const data = { player: { id: 'p1', stats: { wins: 3 } } };
    const json = serialize(data);
    const result = deserialize<typeof data>(json);
    expect(result).toEqual(data);
  });

  it('throws on invalid JSON', () => {
    expect(() => deserialize('not json')).toThrow();
  });
});

// AC-14: Serialization validation
describe('validateSerializable', () => {
  it('returns valid for plain objects', () => {
    const result = validateSerializable({ name: 'test', count: 42, flag: true });
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects Set violations', () => {
    const result = validateSerializable({ items: new Set([1, 2, 3]) });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'Set')).toBe(true);
  });

  it('detects Map violations', () => {
    const result = validateSerializable({ map: new Map() });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'Map')).toBe(true);
  });

  it('detects Date violations', () => {
    const result = validateSerializable({ d: new Date() });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'Date')).toBe(true);
  });

  it('detects undefined violations', () => {
    const result = validateSerializable({ x: undefined });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.type === 'undefined')).toBe(true);
  });

  it('detects nested violations', () => {
    const result = validateSerializable({ nested: { deep: { s: new Set() } } });
    expect(result.valid).toBe(false);
    expect(result.violations[0]?.path).toContain('nested');
  });

  it('returns valid for arrays of primitives', () => {
    const result = validateSerializable([1, 'two', true, null]);
    expect(result.valid).toBe(true);
  });
});
