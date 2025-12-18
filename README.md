# Customer Service Chatbot

A simple, beginner-friendly customer service chatbot built with Node.js, React, and OpenAI API.

## 📁 Project Structure

```
chatbot/
├── backend/           # Node.js/Express server
│   ├── server.js      # Main server file with API endpoints
│   ├── package.json   # Backend dependencies
│   └── .env          # Environment variables (create this yourself)
├── frontend/          # React application
│   ├── src/
│   │   ├── App.js     # Main React component
│   │   ├── App.css    # Styles for the chat UI
│   │   ├── index.js   # React entry point
│   │   └── index.css  # Global styles
│   ├── public/
│   │   └── index.html # HTML template
│   └── package.json   # Frontend dependencies
└── README.md          # This file
```

## 🚀 How to Run the Project

### Step 1: Set Up the Backend

1. **Navigate to the backend folder:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file:**
   ```bash
   # Copy the example file
   cp .env.example .env
   ```
   
   Then edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   PORT=3001
   ```
   
   **How to get an OpenAI API key:**
   - Go to https://platform.openai.com/api-keys
   - Sign up or log in
   - Create a new API key
   - Copy it into your `.env` file

4. **Start the backend server:**
   ```bash
   npm start
   ```
   
   You should see: `🚀 Server is running on http://localhost:3001`

### Step 2: Set Up the Frontend

1. **Open a new terminal window** (keep the backend running)

2. **Navigate to the frontend folder:**
   ```bash
   cd frontend
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the React app:**
   ```bash
   npm start
   ```
   
   The app will automatically open in your browser at `http://localhost:3000`

## 🎯 How It Works

### Backend (`backend/server.js`)
- **Express Server**: Handles HTTP requests from the frontend
- **CORS**: Allows the React app to communicate with the backend
- **OpenAI Integration**: Sends user messages to OpenAI and returns AI responses
- **API Endpoint**: `/api/chat` receives messages and returns AI responses

### Frontend (`frontend/src/App.js`)
- **React Component**: Manages the chat interface
- **State Management**: Keeps track of messages and loading states
- **API Calls**: Sends user messages to the backend and displays AI responses
- **UI**: Clean chat interface with message bubbles

## 📝 Key Files Explained

### `backend/server.js`
- Sets up the Express server
- Creates the `/api/chat` endpoint that talks to OpenAI
- Handles errors gracefully
- Uses environment variables for the API key (keeps it secret!)

### `frontend/src/App.js`
- Main React component that shows the chat UI
- Manages the list of messages (user + AI)
- Handles sending messages to the backend
- Shows a loading indicator while waiting for AI response

### `frontend/src/App.css`
- Styles the chat interface
- Makes user messages blue (right side)
- Makes AI messages white (left side)
- Responsive design for mobile devices

## 🔧 Troubleshooting

**Backend won't start:**
- Make sure you've installed dependencies: `npm install` in the backend folder
- Check that your `.env` file exists and has a valid `OPENAI_API_KEY`
- Make sure port 3001 is not already in use

**Frontend won't start:**
- Make sure you've installed dependencies: `npm install` in the frontend folder
- Make sure the backend is running first
- Check that port 3000 is not already in use

**Can't get AI responses:**
- Verify your OpenAI API key is correct in the `.env` file
- Check that you have credits in your OpenAI account
- Look at the backend terminal for error messages

**CORS errors:**
- Make sure the backend is running on port 3001
- The frontend should be running on port 3000
- Check that `cors` is installed in the backend

## 💡 Next Steps (Optional Enhancements)

- Add message history persistence (save chats to a database)
- Add user authentication
- Support for file uploads
- Multiple chat rooms
- Voice input/output
- Customize the AI's personality in the system message

## 📚 Learning Resources

- **Express.js**: https://expressjs.com/
- **React**: https://react.dev/
- **OpenAI API**: https://platform.openai.com/docs

---

**Happy coding! 🎉**

