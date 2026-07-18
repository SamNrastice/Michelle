# Michelle — AI Booking Avatar

Michelle is a voice-enabled AI booking assistant. Users interact with her via voice or text; she understands natural-language booking requests, manages appointments, and sends confirmation emails.

## Repository Layout

```
/
├── backend/          # Node.js/Express server (all business logic)
│   ├── server.js     # Main entry point — routes, AI, speech, email
│   └── package.json
├── public/
│   └── index.html    # Static frontend served by the backend
└── .env.example      # Environment variable template
```

## Setup

### Prerequisites

- Node.js ≥ 18
- Azure Speech Services account (Speech-to-Text + Text-to-Speech)
- Google Gemini API key
- Mailtrap account (for email confirmations, optional)

### Install & Run

```bash
cd backend
npm install
cp ../.env.example ../.env   # fill in your keys
node server.js               # starts on http://localhost:3000
```

Development mode (auto-restart on file changes):

```bash
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` at the repository root and populate every value:

| Variable | Required | Description |
|---|---|---|
| `AZURE_SPEECH_KEY` | Yes | Azure Cognitive Services speech subscription key |
| `AZURE_SPEECH_REGION` | No | Azure region (default: `eastus`) |
| `GEMINI_API_KEY` | Yes | Google Gemini AI API key |
| `GEMINI_PROJECT_ID` | No | Google Cloud project ID |
| `MAILTRAP_HOST` | No | SMTP host (default: `sandbox.smtp.mailtrap.io`) |
| `MAILTRAP_PORT` | No | SMTP port (default: `2525`) |
| `MAILTRAP_USER` | No | Mailtrap username — if absent, emails are skipped |
| `MAILTRAP_PASS` | No | Mailtrap password |
| `MAILTRAP_SENDER_EMAIL` | No | From address for confirmation emails |
| `PORT` | No | HTTP port (default: `3000`) |

## Architecture

```
Browser (public/index.html)
       │  HTTP / fetch
       ▼
Express server (backend/server.js)
       ├── Azure Speech SDK  ← STT / TTS
       ├── Google Gemini AI  ← Conversational AI (gemini-1.5-flash)
       ├── Nodemailer        ← Booking confirmation emails via Mailtrap
       └── In-memory store   ← Bookings array (replace with DB in production)
```

**Rate limits** (per IP, per minute):
- General API endpoints: 30 requests
- Voice endpoints: 10 requests

**Voice pipeline** (`POST /api/voice/process`):
1. Audio buffer → Azure STT → transcript
2. Transcript → Gemini AI → text response
3. Text response → Azure TTS → MP3 audio buffer

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check — reports connection status for Azure, Gemini, Mailtrap |
| `POST` | `/api/chat` | Send a text message; receive Michelle's AI text reply |
| `POST` | `/api/speech/recognize` | Send raw audio bytes; receive transcript |
| `POST` | `/api/speech/synthesize` | Send text; receive MP3 audio bytes |
| `POST` | `/api/voice/process` | Full pipeline: audio in → STT → AI → TTS → audio out |
| `POST` | `/api/bookings` | Create a booking (name, email, date, time, service, notes) |
| `GET` | `/api/bookings` | List all bookings |

### Chat

```
POST /api/chat
Content-Type: application/json

{ "message": "Book me in for Tuesday at 2pm", "history": [] }
```

`history` is an optional array of `{ role: "user"|"model", content: "..." }` objects for multi-turn context.

### Voice Process

```
POST /api/voice/process
Content-Type: audio/webm   (or any audio/* MIME type)

<raw audio bytes>
```

Response:
```json
{
  "success": true,
  "transcript": "...",
  "response": "...",
  "audio": "<base64 MP3>",
  "audioMimeType": "audio/mpeg"
}
```

### Create Booking

```
POST /api/bookings
Content-Type: application/json

{
  "name": "Alice",
  "email": "alice@example.com",
  "date": "2025-08-05",
  "time": "14:00",
  "service": "Consultation",
  "notes": "First visit"
}
```

`name`, `date`, and `time` are required. If `email` is provided, a confirmation email is sent via Mailtrap.

## Michelle's Persona

Michelle's system prompt instructs her to:
- Be warm, professional, and concise (≤ 3 sentences unless detail is needed)
- Parse natural-language dates and times (e.g. "tomorrow morning", "next Tuesday at 3")
- Collect name, date/time, service type, and contact email when taking a booking
- Confirm booking details clearly and enthusiastically

The system prompt lives in the `MICHELLE_SYSTEM_PROMPT` constant in `backend/server.js` and can be customised there.

## Notes for Agents

- **No test suite is currently present.** Validate changes by running the server and hitting the health endpoint.
- **Bookings are stored in memory.** They are lost on restart. For production, replace the `bookings` array with a persistent database.
- **Speech voice** is hardcoded to `en-AU-NatashaNeural` in `createSpeechConfig()`. Change there to use a different Azure Neural voice.
- **Gemini model** is hardcoded to `gemini-1.5-flash` in `getGeminiResponse()`.
