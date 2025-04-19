# Happy Path - Backend

## Description
The backend for the **Happy Path** application is built using Node.js and Express. It handles user authentication, registration, and connection to a MongoDB database. This API supports different user roles such as **student**, **teacher**, and **parent**.

## Features
- **User Authentication**: Register, login, and retrieve user details.
- **User Roles**: Different roles like student, teacher, and parent with personalized responses.
- **MongoDB Integration**: Stores user data, including authentication information and user role.
- **Token-based Authentication**: Uses JWT (JSON Web Tokens) for authentication after login.

## Tech Stack
- **Node.js**: Backend runtime environment
- **Express**: Web framework for Node.js
- **MongoDB**: NoSQL database for storing user data
- **JWT**: JSON Web Token for secure authentication

## Getting Started

### Prerequisites
1. Install **Node.js** (Ensure you have `node` and `npm` installed)
   - You can download it from [here](https://nodejs.org/).
2. Install **MongoDB** (For local development) or use **MongoDB Atlas** for a cloud-based solution.
   - [Install MongoDB locally](https://www.mongodb.com/docs/manual/installation/)
   - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

### Install Dependencies

Clone the repository and install the dependencies:

```bash
git clone https://github.com/Happy-Path/backend.git
cd backend
npm install
