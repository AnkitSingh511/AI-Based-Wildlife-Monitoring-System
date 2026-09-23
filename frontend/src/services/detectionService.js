import { apiRequest } from "./api";

/**
 * Detection service communicating with backend detection routes
 */
export const detectionService = {
  /**
   * Upload an image file for AI/ML wildlife detection and automatic database record creation
   * @param {FormData} formData
   */
  async uploadAndDetect(formData) {
    const data = await apiRequest("/detections/upload-detect", {
      method: "POST",
      body: formData,
    });
    return data.detection || data;
  },

  /**
   * Fetch all wildlife detection records
   */
  async getAllDetections() {
    const data = await apiRequest("/detections", {
      method: "GET",
    });
    return data.detections || [];
  },

  /**
   * Fetch a single detection record by its database ID
   * @param {string} id
   */
  async getDetectionById(id) {
    const data = await apiRequest(`/detections/${id}`, {
      method: "GET",
    });
    return data.detection;
  },

  /**
   * Create a new wildlife detection record
   * @param {{ species: string, confidence: number, location: string, timestamp: string, image: string }} payload
   */
  async createDetection(payload) {
    const data = await apiRequest("/detections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.detection || data;
  },

  /**
   * Update an existing detection record
   * @param {string} id
   * @param {object} payload
   */
  async updateDetection(id, payload) {
    const data = await apiRequest(`/detections/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return data.detection || data;
  },

  /**
   * Delete a detection record
   * @param {string} id
   */
  async deleteDetection(id) {
    return await apiRequest(`/detections/${id}`, {
      method: "DELETE",
    });
  },
};

export default detectionService;
