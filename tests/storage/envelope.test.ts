import { describe, it, expect } from 'vitest';
import { wrap, unwrap } from '@/storage/envelope';

describe('StorageEnvelope', () => {
  it('should wrap data with schema version and timestamp', () => {
    const data = { foo: 'bar', count: 42 };
    const envelope = wrap(data);

    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.data).toEqual(data);
    expect(envelope.savedAt).toBeLessThanOrEqual(Date.now());
    expect(envelope.savedAt).toBeGreaterThan(Date.now() - 1000);
  });

  it('should unwrap data correctly', () => {
    const data = { test: true };
    const envelope = wrap(data);
    const unwrapped = unwrap(envelope);

    expect(unwrapped).toEqual(data);
  });

  it('should handle complex nested data', () => {
    const data = {
      config: { chips: 1500, speed: 'Normal' },
      players: [{ id: 'p1', name: 'Alice' }],
    };
    const envelope = wrap(data);
    const unwrapped = unwrap(envelope);
    expect(unwrapped).toEqual(data);
  });

  it('should be JSON serializable', () => {
    const data = { value: 123, items: [1, 2, 3] };
    const envelope = wrap(data);
    const json = JSON.stringify(envelope);
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.data).toEqual(data);
  });
});
