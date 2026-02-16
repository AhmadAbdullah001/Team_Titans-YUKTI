# eVault - Setup Instructions

## Issues Fixed

1. **API Endpoint Typo**: Changed `/handleuupload` to `/handleupload` in both frontend and backend
2. **Wrong Port**: Changed frontend API calls from port 3000 to port 5000 for backend
3. **Response Data Handling**: Fixed hash extraction from `data.hash` to `data.result`
4. **Frontend Dependencies**: Removed Express from root package.json (only needed in backend)
5. **Backend Script**: Added start script to backend package.json for easy server startup

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend folder (copy from `.env.example`):
```
PORT=5000
URL=mongodb+srv://yourmongodburl
PINATA_API_KEY=your_pinata_key
PINATA_API_SECRET=your_pinata_secret
```

Start the backend server:
```bash
npm start
# or
node server.js
```

The backend will run on `http://localhost:5000`

### 2. Frontend Setup

```bash
npm install
npm start
```

The frontend will run on `http://localhost:3000`

## Architecture

- **Frontend**: React app on port 3000 handles file upload UI
- **Backend**: Express server on port 5000 handles IPFS uploads via Pinata
- **Database**: MongoDB stores file metadata
- **Storage**: IPFS/Pinata for decentralized file storage

## API Endpoints

- `POST /api/upload/handleupload` - Upload file to IPFS
- `POST /api/verify/` - Verify file authenticity by hash
