/**
 * BiteBuddy Scoring Algorithm
 *
 * Determines food safety score (0-100) and result (safe/warning/danger)
 * based on bacteria detection levels from the biosensor.
 *
 * Bacteria tested:
 *   - Salmonella spp.     (causes salmonellosis)
 *   - E. coli O157:H7    (causes HUS, severe diarrhea)
 *   - Staph. aureus      (causes food poisoning)
 *
 * Detection levels: ND (Not Detected), Trace, Detected
 */

const BACTERIA_RULES = {
  salmonella: { ND: 0, Trace: 20, Detected: 60 },
  ecoli:      { ND: 0, Trace: 25, Detected: 60 },
  staph:      { ND: 0, Trace: 10, Detected: 30 },
};

/**
 * Compute safety score and result from raw bacteria readings.
 * @param {Object} readings - { salmonella, ecoli, staph } each 'ND'|'Trace'|'Detected'
 * @returns {{ score: number, result: 'safe'|'warning'|'danger' }}
 */
function computeScore(readings) {
  const { salmonella, ecoli, staph } = readings;

  // Immediate danger: any pathogen fully detected
  if (salmonella === 'Detected' || ecoli === 'Detected') {
    return { score: Math.floor(Math.random() * 20) + 10, result: 'danger' };
  }

  // Calculate deduction from 100
  const deduction =
    BACTERIA_RULES.salmonella[salmonella] +
    BACTERIA_RULES.ecoli[ecoli] +
    BACTERIA_RULES.staph[staph];

  // Add small random variance ±5 for realism
  const variance = Math.floor(Math.random() * 10) - 5;
  const rawScore = 100 - deduction + variance;
  const score = Math.max(5, Math.min(100, rawScore));

  let result;
  if (score >= 80) result = 'safe';
  else if (score >= 50) result = 'warning';
  else result = 'danger';

  // Staph detected overrides to at least warning
  if (staph === 'Detected' && result === 'safe') result = 'warning';

  return { score, result };
}

/**
 * Generate simulated bacteria readings for demo/testing.
 * @param {'safe'|'warning'|'danger'} preset
 * @returns {{ salmonella, ecoli, staph }}
 */
function generateSimulatedReadings(preset) {
  const presets = {
    safe:    { salmonella: 'ND',       ecoli: 'ND',       staph: 'ND' },
    warning: { salmonella: 'Trace',    ecoli: 'ND',       staph: 'ND' },
    danger:  { salmonella: 'Detected', ecoli: 'ND',       staph: 'Trace' },
  };

  const base = presets[preset] || presets.safe;

  // add slight randomness to warning
  if (preset === 'warning' && Math.random() > 0.5) {
    return { ...base, staph: 'Trace' };
  }

  return base;
}

module.exports = { computeScore, generateSimulatedReadings };
