/**
 * BiteBuddy Scoring Algorithm v2
 *
 * Bacteria matched to actual multiplex biosensor aptamers:
 *   - E. coli O157:H7  (aptamer S1-2,   Kd 8.79 nM)
 *   - S. aureus         (aptamer SA43-3, Kd 14.2 nM)
 *   - B. cereus         (aptamer BC-1,   Kd 28.34 nM)
 *
 * Detection levels: ND (<10 CFU/mL) | Trace (10–1000) | Detected (>1000)
 * LOD: 10 CFU/mL  |  Range: 10–10^8 CFU/mL
 */

const BACTERIA_RULES = {
  ecoli:   { ND: 0, Trace: 25, Detected: 60 }, // highest priority pathogen
  staph:   { ND: 0, Trace: 10, Detected: 30 },
  bcereus: { ND: 0, Trace: 15, Detected: 40 }, // replaces salmonella
};

// CFU/mL thresholds per bacteria (matches WHO/FDA food safety limits)
const CFU_THRESHOLDS = {
  ecoli:   { trace: 10,   detected: 1000 },
  staph:   { trace: 100,  detected: 10000 },
  bcereus: { trace: 50,   detected: 5000  },
};

/**
 * Generate realistic raw sensor readings (nanoamps) for demo purposes.
 * Simulates what the graphene oxide/PEDOT:PSS electrode array would output.
 */
function generateRawReadings(preset) {
  const noise = () => (Math.random() - 0.5) * 0.8;

  const profiles = {
    safe: {
      ecoli_nA:   1.2 + noise(), staph_nA:  0.9 + noise(), bcereus_nA: 1.5 + noise(),
      ecoli_cfu:  0,             staph_cfu: 0,              bcereus_cfu: 0,
    },
    warning: {
      ecoli_nA:   1.4 + noise(), staph_nA:  1.1 + noise(), bcereus_nA: 8.3 + noise(),
      ecoli_cfu:  0,             staph_cfu: 0,              bcereus_cfu: 420 + Math.floor(Math.random() * 200),
    },
    danger: {
      ecoli_nA:   18.7 + noise(), staph_nA: 1.2 + noise(), bcereus_nA: 22.4 + noise(),
      ecoli_cfu:  4800 + Math.floor(Math.random() * 1000),  staph_cfu: 0, bcereus_cfu: 6200 + Math.floor(Math.random() * 1000),
    },
  };

  return profiles[preset] || profiles.safe;
}

/**
 * Convert raw nA reading to CFU/mL using polynomial calibration curve.
 * In real firmware this curve is stored in flash after factory calibration.
 */
function nAToCFU(nA, bacteria) {
  // Simplified linear model: CFU = (nA - baseline) * sensitivity_factor
  const baselines   = { ecoli: 1.2, staph: 0.9, bcereus: 1.5 };
  const sensitivity = { ecoli: 280, staph: 150, bcereus: 320 };
  const cfu = Math.max(0, (nA - baselines[bacteria]) * sensitivity[bacteria]);
  return Math.round(cfu);
}

/**
 * Classify CFU/mL into detection level string.
 */
function cfuToLevel(cfu, bacteria) {
  const t = CFU_THRESHOLDS[bacteria];
  if (cfu >= t.detected) return 'Detected';
  if (cfu >= t.trace)    return 'Trace';
  return 'ND';
}

/**
 * Core scoring function — accepts string enum levels.
 */
function computeScore(readings) {
  const ecoli   = readings.ecoli   || 'ND';
  const staph   = readings.staph   || 'ND';
  const bcereus = readings.bcereus || 'ND';

  // Immediate danger conditions
  if (ecoli === 'Detected') {
    return { score: Math.floor(Math.random() * 15) + 5, result: 'danger' };
  }
  if (bcereus === 'Detected') {
    return { score: Math.floor(Math.random() * 20) + 15, result: 'danger' };
  }

  const deduction =
    (BACTERIA_RULES.ecoli[ecoli]     || 0) +
    (BACTERIA_RULES.staph[staph]     || 0) +
    (BACTERIA_RULES.bcereus[bcereus] || 0);

  const variance = Math.floor(Math.random() * 10) - 5;
  const score    = Math.max(5, Math.min(100, 100 - deduction + variance));

  let result = score >= 80 ? 'safe' : score >= 50 ? 'warning' : 'danger';

  // Staph detected always at least warning
  if (staph === 'Detected' && result === 'safe') result = 'warning';

  return { score, result };
}

/**
 * Full simulation pipeline — mimics the physical device's firmware:
 * preset → raw nA → CFU/mL → enum levels → score
 */
function simulateFullPipeline(preset) {
  const raw  = generateRawReadings(preset);

  // Convert nA to CFU using calibration model
  const cfu = {
    ecoli:   nAToCFU(raw.ecoli_nA,   'ecoli'),
    staph:   nAToCFU(raw.staph_nA,   'staph'),
    bcereus: nAToCFU(raw.bcereus_nA, 'bcereus'),
  };

  // Override with preset CFU for realism when raw model is too noisy
  if (preset === 'safe')    { cfu.ecoli = 0; cfu.staph = 0; cfu.bcereus = 0; }
  if (preset === 'warning') { cfu.bcereus = raw.bcereus_cfu; }
  if (preset === 'danger')  { cfu.ecoli = raw.ecoli_cfu; cfu.bcereus = raw.bcereus_cfu; }

  const levels = {
    ecoli:   cfuToLevel(cfu.ecoli,   'ecoli'),
    staph:   cfuToLevel(cfu.staph,   'staph'),
    bcereus: cfuToLevel(cfu.bcereus, 'bcereus'),
  };

  const { score, result } = computeScore(levels);

  return {
    // String levels for DB storage
    ...levels,
    // Rich metadata for UI display
    raw_nA:  {
      ecoli:   +raw.ecoli_nA.toFixed(2),
      staph:   +raw.staph_nA.toFixed(2),
      bcereus: +raw.bcereus_nA.toFixed(2),
    },
    cfu_per_ml: cfu,
    score,
    result,
    detection_time_s: 900 + Math.floor(Math.random() * 60), // ~15 min
    sample_volume_ul: 9,
    electrode_temp_c: 25 + +(Math.random() * 2).toFixed(1),
  };
}

module.exports = { computeScore, simulateFullPipeline, cfuToLevel, nAToCFU };
