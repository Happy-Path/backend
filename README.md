# Happy Path - Backend

## Description

The backend for the **Happy Path** application is built using **Node.js** and **Express.js**. It handles user authentication, registration, and connects to a **MongoDB** database. The API supports multiple user roles, including **student**, **teacher**, and **parent**, with role-based access control.

## Features

- **User Authentication**: Register, login, and retrieve user details
- **User Roles**: Different roles like student, teacher, and parent with personalized responses
- **MongoDB Integration**: Stores user data securely, including authentication information and user roles
- **Token-based Authentication**: Uses **JWT (JSON Web Tokens)** for authentication after login
- **CORS Support**: Allows requests from your frontend during development

## Tech Stack

- **Node.js**: Backend runtime environment
- **Express.js**: Web framework for Node.js
- **MongoDB**: NoSQL database for storing user data
- **JWT**: JSON Web Token for secure authentication
- **Nodemon**: Auto-restart server during development

## Getting Started

### Prerequisites

1. **Node.js**: Ensure `node` and `npm` are installed. [Download Node.js](https://nodejs.org/)
2. **MongoDB**: Install locally or use MongoDB Atlas
   - [Install MongoDB locally](https://docs.mongodb.com/manual/installation/)
   - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
3. **(Optional)** **Postman or Insomnia**: For testing API endpoints

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Happy-Path/backend.git
cd backend
```

2. Install dependencies:

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root folder and add:

```env
PORT=5000
MONGO_URI=<Your MongoDB Connection String>
JWT_SECRET=<Your JWT Secret Key>
```

Replace `<Your MongoDB Connection String>` and `<Your JWT Secret Key>` with your credentials.

### Running the Server

**Development Mode (with Nodemon):**

```bash
npm run dev
```

**Production Mode:**

```bash
node server.js
```

The backend will start on the port specified in `.env` (default: 5000).

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login a user |
| GET | `/api/auth/me` | Get authenticated user details |

### Notes:
- Include `Content-Type: application/json` for POST requests
- Use the JWT token in the `Authorization` header for protected routes

## Development Notes

- **CORS**: Ensure your frontend URL is allowed in the backend for development:

```javascript
const cors = require('cors');
app.use(cors({ 
  origin: 'http://localhost:8081', 
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));
```

- **Nodemon** watches your files for changes and restarts the server automatically

## Folder Structure

```
backend/
│
├─ models/        # Mongoose models (User, etc.)
├─ routes/        # Express routes (auth, users, etc.)
├─ middleware/    # Middleware (auth, error handling, etc.)
├─ server.js      # Entry point
├─ package.json
└─ .env
```

## License

MIT License
