import { describe, it, expect } from 'vitest';
import {
  generateCalibrationReport,
  formatReportAsText,
  type CalibrationReport,
} from '@/simulation/calibration-report';
import type { SimulationResult } from '@/simulation/batch-runner';

// ============================================================
// Test fixtures
// ============================================================

function makeSimulationResult(overrides?: Partial<SimulationResult>): SimulationResult {
  return {
    sngsCompleted: 100,
    sngsErrored: 0,
    chipConservationPassed: true,
    perPreset: {
      Shark: {
        vpip: 0.22,
        pfr: 0.18,
        threeBet: 0.085,
        vpipTarget: 0.23,
        pfrTarget: 0.19,
        threeBetTarget: 0.09,
        handsEligible: 1000,
        threeBetOpportunities: 200,
        avgFinishPosition: 3.5,
        finishPositionStdDev: 2.1,
        firstPlaceRate: 0.15,
        results: [1, 2, 3, 4, 5, 6, 7, 8],
        vpipCount: 220,
        pfrCount: 180,
        threeBetCount: 17,
      },
      TAG: {
        vpip: 0.20,
        pfr: 0.17,
        threeBet: 0.07,
        vpipTarget: 0.19,
        pfrTarget: 0.16,
        threeBetTarget: 0.07,
        handsEligible: 1000,
        threeBetOpportunities: 180,
        avgFinishPosition: 4.0,
        finishPositionStdDev: 2.3,
        firstPlaceRate: 0.12,
        results: [1, 2, 3, 4, 5, 6, 7, 8],
        vpipCount: 200,
        pfrCount: 170,
        threeBetCount: 12,
      },
      Nit: {
        vpip: 0.10,
        pfr: 0.07,
        threeBet: 0.03,
        vpipTarget: 0.10,
        pfrTarget: 0.07,
        threeBetTarget: 0.03,
        handsEligible: 900,
        threeBetOpportunities: 150,
        avgFinishPosition: 4.5,
        finishPositionStdDev: 2.0,
        firstPlaceRate: 0.08,
        results: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        vpipCount: 90,
        pfrCount: 63,
        threeBetCount: 4,
      },
    },
    timingMs: {
      totalMs: 5000,
      avgHandMs: 0.5,
      totalHands: 10000,
    },
    ...overrides,
  };
}

// ============================================================
// AC-16: Report structure
// ============================================================

describe('AC-16: calibration report structure', () => {
  it('should generate report with presetResults array', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);

    expect(report.presetResults).toBeDefined();
    expect(Array.isArray(report.presetResults)).toBe(true);
    expect(report.presetResults.length).toBe(3);
  });

  it('should include chipConservation status', () => {
    const simResult = makeSimulationResult({ chipConservationPassed: true });
    const report = generateCalibrationReport(simResult);

    expect(report.chipConservation).toBeDefined();
    expect(report.chipConservation.passed).toBe(true);
  });

  it('should include chipConservation failed when simulation failed', () => {
    const simResult = makeSimulationResult({ chipConservationPassed: false });
    const report = generateCalibrationReport(simResult);

    expect(report.chipConservation.passed).toBe(false);
  });

  it('should include completion stats', () => {
    const simResult = makeSimulationResult({ sngsCompleted: 100, sngsErrored: 0 });
    const report = generateCalibrationReport(simResult);

    expect(report.completion.completed).toBe(100);
    expect(report.completion.total).toBe(100);
  });

  it('should include completion with errors', () => {
    const simResult = makeSimulationResult({ sngsCompleted: 98, sngsErrored: 2 });
    const report = generateCalibrationReport(simResult);

    expect(report.completion.completed).toBe(98);
    expect(report.completion.total).toBe(100);
  });

  it('should include determinism result', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);

    expect(report.determinism).toBeDefined();
    expect(typeof report.determinism.passed).toBe('boolean');
    expect(typeof report.determinism.runs).toBe('number');
  });

  it('should include balance rankings', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);

    expect(report.balance).toBeDefined();
    expect(report.balance.rankings).toBeDefined();
    expect(Array.isArray(report.balance.notes)).toBe(true);
  });

  it('should include performance metrics', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);

    expect(report.performance).toBeDefined();
    expect(report.performance.avgHandMs).toBe(0.5);
    expect(report.performance.totalMs).toBe(5000);
    expect(report.performance.totalHands).toBe(10000);
  });
});

// ============================================================
// PresetCalibration structure
// ============================================================

describe('preset calibration entries', () => {
  it('should include vpip, pfr, threeBet with actual and target values', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);

    const sharkEntry = report.presetResults.find((p) => p.preset === 'Shark');
    expect(sharkEntry).toBeDefined();
    expect(sharkEntry!.vpip.actual).toBeCloseTo(0.22, 3);
    expect(sharkEntry!.vpip.target).toBeCloseTo(0.23, 3);
    expect(sharkEntry!.pfr.actual).toBeCloseTo(0.18, 3);
    expect(sharkEntry!.pfr.target).toBeCloseTo(0.19, 3);
    expect(sharkEntry!.threeBet.actual).toBeCloseTo(0.085, 3);
    expect(sharkEntry!.threeBet.target).toBeCloseTo(0.09, 3);
  });

  it('should mark stats within ±2% as passed', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);

    const sharkEntry = report.presetResults.find((p) => p.preset === 'Shark');
    expect(sharkEntry).toBeDefined();

    // Shark vpip: actual=0.22, target=0.23, diff=0.01 = 1% → should pass
    expect(sharkEntry!.vpip.passed).toBe(true);
    // Shark pfr: actual=0.18, target=0.19, diff=0.01 = 1% → should pass
    expect(sharkEntry!.pfr.passed).toBe(true);
  });

  it('should mark stats outside ±2% as failed', () => {
    const simResult = makeSimulationResult({
      perPreset: {
        Shark: {
          vpip: 0.10, // far from target 0.23
          pfr: 0.05,
          threeBet: 0.01,
          vpipTarget: 0.23,
          pfrTarget: 0.19,
          threeBetTarget: 0.09,
          handsEligible: 1000,
          threeBetOpportunities: 200,
          avgFinishPosition: 4.5,
          finishPositionStdDev: 2.0,
          firstPlaceRate: 0.10,
          results: [1, 2, 3, 4],
          vpipCount: 100,
          pfrCount: 50,
          threeBetCount: 2,
        },
      },
    });

    const report = generateCalibrationReport(simResult);
    const sharkEntry = report.presetResults.find((p) => p.preset === 'Shark');
    expect(sharkEntry).toBeDefined();
    expect(sharkEntry!.vpip.passed).toBe(false);
  });
});

// ============================================================
// AC-17: Human-readable text format
// ============================================================

describe('AC-17: human-readable text format', () => {
  it('should produce non-empty text output', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);
    const text = formatReportAsText(report);

    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(100);
  });

  it('should include preset names in the report', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);
    const text = formatReportAsText(report);

    expect(text).toContain('Shark');
    expect(text).toContain('TAG');
    expect(text).toContain('Nit');
  });

  it('should include VPIP, PFR, 3-Bet labels', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);
    const text = formatReportAsText(report);

    expect(text.toLowerCase()).toContain('vpip');
    expect(text.toLowerCase()).toContain('pfr');
  });

  it('should include chip conservation result', () => {
    const simResult = makeSimulationResult({ chipConservationPassed: true });
    const report = generateCalibrationReport(simResult);
    const text = formatReportAsText(report);

    expect(text.toLowerCase()).toContain('chip');
  });

  it('should include completion info', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);
    const text = formatReportAsText(report);

    expect(text).toContain('100');
  });

  it('should include performance info', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);
    const text = formatReportAsText(report);

    // Should mention hands or performance
    expect(text.toLowerCase()).toMatch(/hand|performance|ms|time/);
  });

  it('should use newlines for readable formatting', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);
    const text = formatReportAsText(report);

    expect(text).toContain('\n');
  });

  it('should indicate pass/fail for each preset stat', () => {
    const simResult = makeSimulationResult();
    const report = generateCalibrationReport(simResult);
    const text = formatReportAsText(report);

    // Should contain some form of pass/fail indicator
    expect(text.toLowerCase()).toMatch(/pass|fail|ok|error/);
  });
});

// ============================================================
// CalibrationReport type conformance
// ============================================================

describe('CalibrationReport type correctness', () => {
  it('should return a properly typed report object', () => {
    const simResult = makeSimulationResult();
    const report: CalibrationReport = generateCalibrationReport(simResult);

    // Type-level check via accessing all fields
    expect(report.presetResults).toBeDefined();
    expect(report.chipConservation).toBeDefined();
    expect(report.completion).toBeDefined();
    expect(report.determinism).toBeDefined();
    expect(report.balance).toBeDefined();
    expect(report.performance).toBeDefined();
  });
});
