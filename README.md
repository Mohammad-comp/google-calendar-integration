# Google Calendar Integration

This project implements a full-stack integration of Google Calendar using OAuth 2.0 authentication. It enables users to securely connect their Google accounts, view calendar events, and create new ones through a React-based user interface and a Node.js (Express) backend.


## ✅ Features

- Google OAuth 2.0 authentication
- Calendar authorization and token exchange
- Secure retrieval and creation of calendar events
- Express-based backend with TypeScript
- React frontend with TypeScript


## 🧰 Prerequisites
Before getting started, ensure you have the following installed:

- Node.js (v18+ recommended)
- `npm` (comes with Node.js)
- Git
- A Google Cloud project with OAuth 2.0 credentials set up
 

## ⚙️ Setup Instructions
### Backend Setup

1. Navigate to the `backend/` directory.
2. Install dependencies:
`npm install`
3. Create a `.env` file and populate it with the following:

GOOGLE_CLIENT_ID=your-client-id

GOOGLE_CLIENT_SECRET=your-client-secret

GOOGLE_REDIRECT_URI=http://localhost:3000/callback

4. Start the development server:
`npm run dev`


### Frontend Setup

1. Navigate to the `frontend/` directory.
2. Install dependencies:
`npm install`
3. Start the frontend application:
`npm run dev`
4. Access the integration component at the appropriate route (e.g., `/global-settings`) to authenticate and interact with Google Calendar.


## 🧪 Manual Testing
To test:
- Navigate to the /global-settings route.
- Click “Connect with Google.”
- Follow the OAuth process and check calendar functionality.
- Use browser dev tools or console logs to verify tokens or errors.


## ⚠️ This is a standalone demo. It is not linked to any production system or client-facing infrastructure.


## License

This project is intended for internal or academic use.

---


## Author
Mohammad Abdullah — 2025 Summer Internship Project
