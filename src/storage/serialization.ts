// ============================================================
// Serialization utilities for storage
// Handles Set, Map, Date, and undefined safely
// ============================================================

/**
 * JSON replacer that converts non-JSON-native types to serializable forms.
 * - Set → sorted array
 * - Map → Record<string, unknown>
 * - Date → ISO string
 * - undefined → null
 */
function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Set) {
    const arr = Array.from(value);
    // Sort for determinism (primitives only)
    return (arr as (string | number)[]).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });
  }
  if (value instanceof Map) {
    const record: Record<string, unknown> = {};
    value.forEach((v, k) => {
      record[String(k)] = v;
    });
    return record;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === undefined) {
    return null;
  }
  return value;
}

/**
 * Serialize data to JSON string.
 * Converts Set, Map, Date, and undefined to JSON-safe forms.
 */
export function serialize<T>(data: T): string {
  return JSON.stringify(data, replacer);
}

/**
 * Deserialize a JSON string back to the original type.
 * Note: Set, Map, and Date are NOT revived automatically;
 * they are returned as their serialized forms (array, object, ISO string).
 */
export function deserialize<T>(json: string): T {
  return JSON.parse(json) as T;
}

// ============================================================
// Validation
// ============================================================

export interface ValidationViolation {
  path: string;
  type: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
}

/**
 * Recursively check for non-JSON-serializable values.
 * Reports violations for Set, Map, Date, and undefined.
 */
export function validateSerializable(data: unknown, path = ''): ValidationResult {
  const violations: ValidationViolation[] = [];
  checkValue(data, path, violations);
  return { valid: violations.length === 0, violations };
}

function checkValue(value: unknown, path: string, violations: ValidationViolation[]): void {
  if (value instanceof Set) {
    violations.push({
      path,
      type: 'Set',
      message: `Value at "${path}" is a Set; use an array instead`,
    });
    return;
  }
  if (value instanceof Map) {
    violations.push({
      path,
      type: 'Map',
      message: `Value at "${path}" is a Map; use a plain object instead`,
    });
    return;
  }
  if (value instanceof Date) {
    violations.push({
      path,
      type: 'Date',
      message: `Value at "${path}" is a Date; use an ISO string instead`,
    });
    return;
  }
  if (value === undefined) {
    violations.push({
      path,
      type: 'undefined',
      message: `Value at "${path}" is undefined; use null instead`,
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      checkValue(item, path ? `${path}[${idx}]` : `[${idx}]`, violations);
    });
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      checkValue(
        (value as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key,
        violations,
      );
    }
  }
}
