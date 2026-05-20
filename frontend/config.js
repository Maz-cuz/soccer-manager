// API Configuration
// For local development with backend running on your computer:
// const API_URL = 'http://localhost:3000/api';

// For production:
const API_URL = 'https://soccer-manager-61iv.onrender.com/api';

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_URL };
}
