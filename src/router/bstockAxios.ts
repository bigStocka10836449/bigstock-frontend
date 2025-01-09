import axios from 'axios';

const apiClient = axios.create({
  baseURL: "/api", // 使用 .
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;