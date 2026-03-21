/**
 * SPEC-AI-007: Guardrail test — Math.random() must NOT be called in AI/engine decision paths.
 *
 * Uses Bash grep to scan source files (avoids @types/node dependency).
 * Exceptions:
 *   - Default parameter values like `rng: () => number = Math.random` are allowed
 *   - game-worker.ts thinking delay (cosmetic timing) is allowed
 */

import { describe, it, expect } from 'vitest';
// @ts-expect-error -- no @types/node in this project; execSync works at runtime
import { execSync } from 'child_process';

function grepMathRandom(dir: string): string[] {
  try {
    const output = execSync(
      `grep -rn "Math\\.random" ${dir} --include="*.ts" || true`,
      { encoding: 'utf-8' },
    );
    return output.split('\n').filter((line: string) => line.trim().length > 0);
  } catch {
    return [];
  }
}

function isAllowedUsage(line: string): boolean {
  // Default parameter: `= Math.random` at end or before , or )
  if (/=\s*Math\.random\s*[,)}\s]*$/.test(line)) return true;
  if (line.includes('= Math.random,') || line.includes('= Math.random)')) return true;

  // game-worker.ts cosmetic delay
  if (line.includes('game-worker.ts') && line.includes('Math.random()')) return true;

  return false;
}

describe('SPEC-AI-007: No Math.random() in AI/engine decision paths', () => {
  it('src/ai/ must not call Math.random() at runtime', () => {
    const matches = grepMathRandom('src/ai/');
    const violations = matches.filter((line) => !isAllowedUsage(line));

    if (violations.length > 0) {
      expect.fail(
        `Found ${violations.length} Math.random() violation(s) in src/ai/:\n${violations.join('\n')}`,
      );
    }
    expect(violations).toHaveLength(0);
  });

  it('src/engine/ must not call Math.random() at runtime', () => {
    const matches = grepMathRandom('src/engine/');
    const violations = matches.filter((line) => !isAllowedUsage(line));

    if (violations.length > 0) {
      expect.fail(
        `Found ${violations.length} Math.random() violation(s) in src/engine/:\n${violations.join('\n')}`,
      );
    }
    expect(violations).toHaveLength(0);
  });
});
