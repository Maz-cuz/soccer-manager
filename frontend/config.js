// API Configuration
// For local development with backend running on your computer:
//const API_URL = 'http://localhost:5000/api';

// For production (when deployed to Netlify + Render):
 const API_URL = 'https://midvaalens-backend.onrender.com/api';

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_URL };
}
