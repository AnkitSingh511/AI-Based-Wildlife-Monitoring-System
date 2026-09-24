/**
 * anomalyDetector.js
 * 
 * Module for analyzing tracked wildlife detections and identifying anomalies.
 * Supported Anomaly Types:
 * 1. RESTRICTED_ZONE (Severity: HIGH)
 * 2. LOW_CONFIDENCE (Severity: LOW)
 * 3. LONG_STAY (Severity: MEDIUM)
 * 4. SUDDEN_MOVEMENT (Severity: MEDIUM)
 */

const tracker = require('../tracking/tracker');

// Default restricted zones list for wildlife monitoring
const DEFAULT_RESTRICTED_ZONES = [
  'Village Boundary',
  'Highway Area',
  'Human Settlement',
  'Restricted Zone 1'
];

/**
 * Checks whether a given location is considered a restricted zone.
 * 
 * @param {string} location - Location name to check
 * @param {Array<string>} restrictedZones - List of restricted zone names
 * @returns {boolean} True if restricted zone, false otherwise
 */
function isRestrictedZone(location, restrictedZones = DEFAULT_RESTRICTED_ZONES) {
  if (!location || typeof location !== 'string') return false;

  return restrictedZones.some(zone => 
    location.toLowerCase().includes(zone.toLowerCase()) || 
    location.toLowerCase().includes('restricted')
  );
}

/**
 * Analyzes an array of tracked detection records and identifies anomalies.
 * 
 * @param {Array<Object>} trackedRecords - Array of tracked records from tracker.js
 * @param {Array<string>} [restrictedZones] - Optional custom list of restricted zones
 * @returns {Array<Object>} List of structured anomaly and normal report objects
 */
function analyzeDetections(trackedRecords, restrictedZones = DEFAULT_RESTRICTED_ZONES) {
  if (!Array.isArray(trackedRecords)) {
    throw new Error('Invalid input: trackedRecords must be an array.');
  }

  const results = [];

  // Tracks consecutive detection counts per species at the same location
  // Structure: { "Leopard": { location: "Zone A", count: 3 } }
  const consecutiveCounts = {};

  for (const record of trackedRecords) {
    // Validate record object
    if (!record || typeof record !== 'object') {
      continue;
    }

    const { species, currentLocation, previousLocation, currentTimestamp, timestamp, confidence } = record;
    const recordTimestamp = currentTimestamp || timestamp || 'N/A';

    // Rule State Update: Track consecutive detections in the same location for LONG_STAY
    if (!consecutiveCounts[species]) {
      consecutiveCounts[species] = { location: currentLocation, count: 1 };
    } else if (consecutiveCounts[species].location === currentLocation) {
      consecutiveCounts[species].count += 1;
    } else {
      consecutiveCounts[species] = { location: currentLocation, count: 1 };
    }

    const detectedAnomalies = [];

    // Rule 1: RESTRICTED_ZONE (Severity: HIGH)
    if (isRestrictedZone(currentLocation, restrictedZones)) {
      detectedAnomalies.push({
        anomaly: true,
        species: species,
        anomalyType: 'RESTRICTED_ZONE',
        severity: 'HIGH',
        location: currentLocation,
        timestamp: recordTimestamp,
        message: `${species} detected in restricted area: ${currentLocation}.`
      });
    }

    // Rule 2: LOW_CONFIDENCE (Severity: LOW) - Confidence below 0.50
    if (typeof confidence === 'number' && confidence < 0.50) {
      detectedAnomalies.push({
        anomaly: true,
        species: species,
        anomalyType: 'LOW_CONFIDENCE',
        severity: 'LOW',
        location: currentLocation,
        timestamp: recordTimestamp,
        message: `Low confidence detection for ${species} (${(confidence * 100).toFixed(1)}%).`
      });
    }

    // Rule 3: LONG_STAY (Severity: MEDIUM) - 3 or more consecutive detections in same location
    if (consecutiveCounts[species].count >= 3) {
      detectedAnomalies.push({
        anomaly: true,
        species: species,
        anomalyType: 'LONG_STAY',
        severity: 'MEDIUM',
        location: currentLocation,
        timestamp: recordTimestamp,
        message: `${species} detected repeatedly (${consecutiveCounts[species].count} consecutive times) at ${currentLocation}.`
      });
    }

    // Rule 4: SUDDEN_MOVEMENT (Severity: MEDIUM) - Location changed between consecutive detections
    if (previousLocation !== null && previousLocation !== undefined && previousLocation !== currentLocation) {
      detectedAnomalies.push({
        anomaly: true,
        species: species,
        anomalyType: 'SUDDEN_MOVEMENT',
        severity: 'MEDIUM',
        location: currentLocation,
        timestamp: recordTimestamp,
        message: `${species} suddenly moved from ${previousLocation} to ${currentLocation}.`
      });
    }

    // Store results
    if (detectedAnomalies.length > 0) {
      results.push(...detectedAnomalies);
    } else {
      results.push({
        anomaly: false,
        species: species,
        location: currentLocation,
        timestamp: recordTimestamp,
        message: 'Normal wildlife activity.'
      });
    }
  }

  return results;
}

/**
 * Helper function to load sample detections via tracker.js and run anomaly analysis.
 * 
 * @returns {Array<Object>} Array of anomaly objects
 */
function runAnomalyDetectionOnSampleData() {
  const trackedRecords = tracker.loadAndTrackDetections();
  return analyzeDetections(trackedRecords);
}

module.exports = {
  analyzeDetections,
  isRestrictedZone,
  runAnomalyDetectionOnSampleData,
  DEFAULT_RESTRICTED_ZONES
};
