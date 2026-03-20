/**
 * SPEC-AI-007: Guardrail test — Math.random() must NOT be called in AI/engine decision paths.
 *
 * Reads all .ts source files in src/ai/ and src/engine/ and asserts that
 * Math.random is never called as a runtime expression (not as a default parameter).
 *
 * Exceptions:
 *   - Default parameter values like `rng: () => number = Math.random` are allowed
 *     (these are never actually called at runtime when a seeded rng is provided)
 *   - game-worker.ts thinking delay (cosmetic timing, not game logic) is allowed
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SRC_AI_DIR = path.join(PROJECT_ROOT, 'src', 'ai');
const SRC_ENGINE_DIR = path.join(PROJECT_ROOT, 'src', 'engine');

/**
 * Collect all .ts files recursively under a directory.
 */
function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Find lines where Math.random is used as a runtime call or assignment
 * (i.e., NOT a default parameter value).
 *
 * Patterns to DETECT (violations):
 *   Math.random()           — direct call
 *   Math.random             — passed as value (not in a default param position)
 *
 * Patterns to ALLOW:
 *   = Math.random           — default parameter: `rng = Math.random`
 *   rng: () => number = Math.random  — typed default parameter
 *
 * Exceptions (always allowed by filename):
 *   game-worker.ts          — thinking delay (cosmetic, not game logic)
 */
interface Violation {
  file: string;
  line: number;
  content: string;
}

function findMathRandomViolations(files: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const filePath of files) {
    const relPath = path.relative(PROJECT_ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Skip lines that don't mention Math.random
      if (!line.includes('Math.random')) continue;

      // Allow default parameter assignments: `= Math.random` at end or followed by ,/)
      // This pattern covers: `rng = Math.random`, `rng: () => number = Math.random`
      if (/=\s*Math\.random\s*[,)}\n]/.test(line) || line.trimEnd().endsWith('= Math.random')) {
        continue;
      }

      // Allow the randomDelay function in game-worker.ts (cosmetic timing delay)
      // The entire randomDelay function body uses Math.random for timing only
      if (relPath.includes('game-worker.ts')) {
        // Allow the randomDelay helper (cosmetic thinking delay)
        if (line.includes('Math.random() *') || line.includes('Math.random() ')) {
          continue;
        }
      }

      // Any remaining Math.random usage is a violation
      violations.push({
        file: relPath,
        line: i + 1,
        content: line.trim(),
      });
    }
  }

  return violations;
}

describe('SPEC-AI-007: No Math.random() in AI/engine decision paths', () => {
  it('src/ai/ files must not call Math.random() at runtime', () => {
    const aiFiles = collectTsFiles(SRC_AI_DIR);
    expect(aiFiles.length).toBeGreaterThan(0);

    const violations = findMathRandomViolations(aiFiles);

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line}: ${v.content}`)
        .join('\n');
      expect.fail(
        `Found ${violations.length} Math.random() violation(s) in src/ai/:\n${report}`,
      );
    }

    expect(violations).toHaveLength(0);
  });

  it('src/engine/ files must not call Math.random() at runtime (except cosmetic delay in game-worker.ts)', () => {
    const engineFiles = collectTsFiles(SRC_ENGINE_DIR);
    expect(engineFiles.length).toBeGreaterThan(0);

    const violations = findMathRandomViolations(engineFiles);

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line}: ${v.content}`)
        .join('\n');
      expect.fail(
        `Found ${violations.length} Math.random() violation(s) in src/engine/:\n${report}`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
