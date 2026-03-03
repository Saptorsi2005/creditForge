import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  me: () => api.get('/auth/me'),
};

// Dashboard API
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getCharts: () => api.get('/dashboard/charts'),
};

// Applications API
export const applicationsAPI = {
  create: (data) => api.post('/applications', data),
  getAll: (params) => api.get('/applications', { params }),
  getOne: (id) => api.get(`/applications/${id}`),
  uploadDocuments: (id, formData) =>
    api.post(`/applications/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  analyze: (id) => api.post(`/applications/${id}/analyze`),
  rerunAnalysis: (id) => api.post(`/applications/${id}/rerun-analysis`),
  getStatus: (id) => api.get(`/applications/${id}/status`),
};

// Analysis API
export const analysisAPI = {
  getCompanyAnalysis: (id) => api.get(`/applications/${id}/company-analysis`),
  getAIResearch: (id) => api.get(`/applications/${id}/ai-research`),
  getRiskScore: (id) => api.get(`/applications/${id}/risk-score`),
  getCAMReport: (id) => api.get(`/applications/${id}/cam-report`),
  downloadCAMPDF: (id) => api.get(`/applications/${id}/cam-report/pdf`, {
    responseType: 'blob',
  }),
  applyOverride: (id, data) => api.put(`/applications/${id}/company-analysis/override`, data),
};


// Settings API
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  reset: () => api.post('/settings/reset'),
};

export default api;
