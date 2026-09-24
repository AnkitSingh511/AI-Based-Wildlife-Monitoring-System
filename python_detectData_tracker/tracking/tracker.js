/**
 * tracker.js
 * 
 * Module for tracking wildlife detections across locations over time.
 * Maintains species movement history and tracks previous/current positions.
 */

const fs = require('fs');
const path = require('path');

// Stores the last known location and timestamp for each species
// Example structure: { "Tiger": { location: "Zone A", timestamp: "2026-09-20 10:30" } }
const lastSeenMap = {};

// Stores the full movement history for each species
// Example structure: { "Tiger": [ { location: "Zone A", timestamp: "..." }, ... ] }
const speciesHistory = {};

/**
 * Resets internal tracking state (useful for fresh tracking runs or unit tests).
 */
function resetTracker() {
  for (const species in lastSeenMap) {
    delete lastSeenMap[species];
  }
  for (const species in speciesHistory) {
    delete speciesHistory[species];
  }
}

/**
 * Process a single detection record and calculate movement tracking details.
 * 
 * @param {Object} detection - Raw detection object containing species, confidence, location, timestamp, image, mediaType, video, frameTimestamp, videoDetections
 * @returns {Object} Tracked detection record with previous & current location/timestamp info
 */
function trackSingleDetection(detection) {
  const {
    species,
    confidence,
    location,
    timestamp,
    image,
    mediaType,
    video,
    frameTimestamp,
    videoDetections
  } = detection;

  // Retrieve previous detection details for this species (if any)
  const lastSeen = lastSeenMap[species] || null;

  const previousLocation = lastSeen ? lastSeen.location : null;
  const previousTimestamp = lastSeen ? lastSeen.timestamp : null;

  // Build the tracked detection record
  const trackedRecord = {
    species: species,
    previousLocation: previousLocation,
    currentLocation: location,
    previousTimestamp: previousTimestamp,
    currentTimestamp: timestamp,
    confidence: confidence,
    image: image,
    mediaType: mediaType,
    video: video,
    frameTimestamp: frameTimestamp,
    videoDetections: videoDetections
  };

  // Update the last seen state for this species
  lastSeenMap[species] = {
    location: location,
    timestamp: timestamp
  };

  // Append to the movement history of this species
  if (!speciesHistory[species]) {
    speciesHistory[species] = [];
  }
  speciesHistory[species].push({
    location: location,
    timestamp: timestamp,
    confidence: confidence,
    image: image,
    mediaType: mediaType,
    video: video,
    frameTimestamp: frameTimestamp,
    videoDetections: videoDetections
  });

  return trackedRecord;
}

/**
 * Processes an array of raw detection objects and returns tracked records.
 * 
 * @param {Array<Object>} detections - Array of raw detection objects
 * @returns {Array<Object>} Array of tracked detection records
 */
function processDetections(detections) {
  if (!Array.isArray(detections)) {
    throw new Error('Input must be an array of detection records.');
  }

  return detections.map(detection => trackSingleDetection(detection));
}

/**
 * Reads detection records from sampleDetection.json and returns tracked records.
 * 
 * @param {string} [filePath] - Optional custom path to JSON detection file
 * @returns {Array<Object>} Array of tracked detection records
 */
function loadAndTrackDetections(filePath) {
  const defaultPath = path.join(__dirname, '../data/sampleDetection.json');
  const targetPath = filePath || defaultPath;

  const rawData = fs.readFileSync(targetPath, 'utf8');
  const detections = JSON.parse(rawData);

  return processDetections(detections);
}

/**
 * Returns the full movement history map for all species.
 * 
 * @returns {Object} speciesHistory object
 */
function getSpeciesHistory() {
  return speciesHistory;
}

// Export functions for external use by other modules (e.g. anomalyDetector.js)
module.exports = {
  trackSingleDetection,
  processDetections,
  loadAndTrackDetections,
  getSpeciesHistory,
  resetTracker
};
