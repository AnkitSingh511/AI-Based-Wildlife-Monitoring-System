/**
 * alertGenerator.js
 * 
 * Module for generating structured wildlife alerts from anomaly detection results.
 * Supports both image and video detection alert formats.
 */

const anomalyDetector = require('../anomaly/anomalyDetector');

/**
 * Converts a single anomaly result object into a structured alert object.
 * 
 * @param {Object} anomalyResult - Anomaly result object from anomalyDetector.js
 * @returns {Object} Structured alert object
 */
function generateAlert(anomalyResult) {
  // Safe input validation
  if (!anomalyResult || typeof anomalyResult !== 'object') {
    throw new Error('Invalid input: anomalyResult must be an object.');
  }

  const mediaType = anomalyResult.mediaType !== undefined ? anomalyResult.mediaType : 'image';
  const video = anomalyResult.video !== undefined ? anomalyResult.video : '';
  const frameTimestamp = anomalyResult.frameTimestamp !== undefined ? anomalyResult.frameTimestamp : '';
  const videoDetections = Array.isArray(anomalyResult.videoDetections) ? anomalyResult.videoDetections : [];

  // If an anomaly was detected, format a positive alert record
  if (anomalyResult.anomaly === true) {
    return {
      alert: true,
      species: anomalyResult.species,
      alertType: anomalyResult.anomalyType,
      severity: anomalyResult.severity,
      location: anomalyResult.location,
      timestamp: anomalyResult.timestamp,
      mediaType: mediaType,
      video: video,
      frameTimestamp: frameTimestamp,
      videoDetections: videoDetections,
      message: anomalyResult.message
    };
  }

  // If no anomaly was detected, format a normal status record
  return {
    alert: false,
    species: anomalyResult.species,
    location: anomalyResult.location,
    timestamp: anomalyResult.timestamp,
    mediaType: mediaType,
    video: video,
    frameTimestamp: frameTimestamp,
    videoDetections: videoDetections,
    message: 'No alert. Normal wildlife activity.'
  };
}

/**
 * Converts an array of anomaly result objects into alert objects.
 * 
 * @param {Array<Object>} anomalyResults - Array of anomaly result objects
 * @returns {Array<Object>} Array of generated alert objects
 */
function generateAlerts(anomalyResults) {
  if (!Array.isArray(anomalyResults)) {
    throw new Error('Invalid input: anomalyResults must be an array.');
  }

  return anomalyResults.map(result => generateAlert(result));
}

/**
 * Loads sample detection data, runs anomaly detection, and generates final alerts.
 * 
 * @returns {Array<Object>} Array of generated alerts for the sample dataset
 */
function generateAlertsFromSampleData() {
  const anomalyResults = anomalyDetector.runAnomalyDetectionOnSampleData();
  return generateAlerts(anomalyResults);
}

module.exports = {
  generateAlert,
  generateAlerts,
  generateAlertsFromSampleData
};
