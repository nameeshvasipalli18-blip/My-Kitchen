import axios from 'axios';

const TOKEN_KEY = 'my-kitchen-auth-token';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const getStoredToken = () => window.localStorage.getItem(TOKEN_KEY);

export const persistStoredToken = (token) => {
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
};

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

export default api;
