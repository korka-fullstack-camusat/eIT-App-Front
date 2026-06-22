import axios from "axios";

const api = axios.create({
  baseURL: "",
});

// Attache automatiquement le token JWT à chaque requête
api.interceptors.request.use(config => {
  const token = localStorage.getItem("parc_it_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
