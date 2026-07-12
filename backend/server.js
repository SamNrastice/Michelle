// Michelle Booking Avatar - Backend Server with Azure Speech + Gemini AI
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Log preview length for console messages
const LOG_PREVIEW_LENGTH = 80;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: 'audio/*', limit: '50mb' }));

// ─── Rate Limiting ────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' }
});

const voiceLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many voice requests, please try again shortly.' }
});

// ─── Azure Speech Services Configuration ────────────────────────────────────
function createSpeechConfig() {
    const config = sdk.SpeechConfig.fromSubscription(
        process.env.AZURE_SPEECH_KEY,
        process.env.AZURE_SPEECH_REGION || 'eastus'
    );
    config.speechSynthesisVoiceName = 'en-AU-NatashaNeural';
    config.speechSynthesisOutputFormat =
        sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    return config;
}

// ─── Gemini AI Configuration ─────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MICHELLE_SYSTEM_PROMPT = `You are Michelle, a friendly and professional AI booking assistant for a business.
Your personality:
- Warm, helpful and conversational
- Professional but approachable
- Concise – keep responses under 3 sentences unless more detail is needed
- Always confirm booking details clearly

Your capabilities:
- Take appointment/booking requests
- Parse dates and times from natural language (e.g. "Tuesday at 2pm", "tomorrow morning")
- Confirm bookings and ask for any missing details (name, email, service type)
- Answer questions about services and availability

When you detect a booking request, extract and confirm:
- Name of the person
- Date and time requested
- Service or reason for booking
- Contact email (ask if not provided)

Always respond in a natural, conversational tone. If the user mentions a booking, confirm it enthusiastically and ask for any missing details.`;

// In-memory booking store (replace with a database in production)
const bookings = [];

// ─── Mailtrap Email Configuration ───────────────────────────────────────────
function createMailTransport() {
    return nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
        port: parseInt(process.env.MAILTRAP_PORT, 10) || 2525,
        auth: {
            user: process.env.MAILTRAP_USER,
            pass: process.env.MAILTRAP_PASS
        }
    });
}

async function sendBookingConfirmation(booking) {
    if (!process.env.MAILTRAP_USER || !process.env.MAILTRAP_PASS) {
        console.warn('⚠️  Mailtrap credentials not set — skipping email confirmation');
        return false;
    }

    const transport = createMailTransport();
    const mailOptions = {
        from: `"Michelle AI" <${process.env.MAILTRAP_SENDER_EMAIL || 'michelle@nextgenai.agency'}>`,
        to: booking.email,
        subject: `Booking Confirmation – ${booking.date} at ${booking.time}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6C63FF;">✅ Booking Confirmed!</h2>
                <p>Hi <strong>${booking.name}</strong>,</p>
                <p>Your booking has been confirmed. Here are the details:</p>
                <table style="border-collapse: collapse; width: 100%;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Service</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${booking.service || 'General Appointment'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Date</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${booking.date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Time</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${booking.time}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f9f9f9;"><strong>Booking ID</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${booking.id}</td>
                    </tr>
                </table>
                <p style="margin-top: 20px;">If you need to reschedule or cancel, please contact us.</p>
                <p style="color: #888; font-size: 12px;">This is an automated confirmation from Michelle AI Booking Assistant.</p>
            </div>
        `
    };

    await transport.sendMail(mailOptions);
    console.log(`📧 Confirmation email sent to ${booking.email}`);
    return true;
}

// ─── Helper: Recognize speech from audio buffer ───────────────────────────────
function recognizeSpeechFromBuffer(audioBuffer) {
    return new Promise((resolve, reject) => {
        const speechConfig = createSpeechConfig();
        const pushStream = sdk.AudioInputStream.createPushStream();
        pushStream.write(audioBuffer);
        pushStream.close();

        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        recognizer.recognizeOnceAsync(
            (result) => {
                recognizer.close();
                if (result.reason === sdk.ResultReason.RecognizedSpeech) {
                    resolve({ success: true, text: result.text });
                } else if (result.reason === sdk.ResultReason.NoMatch) {
                    resolve({ success: false, error: 'Speech not recognized', text: '' });
                } else {
                    const details = sdk.CancellationDetails.fromResult(result);
                    reject(new Error(details.errorDetails || 'Recognition canceled'));
                }
            },
            (err) => {
                recognizer.close();
                reject(new Error(err));
            }
        );
    });
}

// ─── Helper: Synthesize speech and return audio bytes ────────────────────────
function synthesizeSpeechToBuffer(text) {
    return new Promise((resolve, reject) => {
        const speechConfig = createSpeechConfig();
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

        synthesizer.speakTextAsync(
            text,
            (result) => {
                synthesizer.close();
                if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                    resolve(Buffer.from(result.audioData));
                } else {
                    const details = sdk.CancellationDetails.fromResult(result);
                    reject(new Error(details.errorDetails || 'Synthesis canceled'));
                }
            },
            (err) => {
                synthesizer.close();
                reject(new Error(err));
            }
        );
    });
}

// ─── Helper: Get Gemini AI response ──────────────────────────────────────────
async function getGeminiResponse(userMessage, conversationHistory = []) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: MICHELLE_SYSTEM_PROMPT
    });

    const history = conversationHistory.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
}

// ─── Routes ──────────────────────────────────────────────────────────

app.get('/', apiLimiter, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check
app.get('/api/health', apiLimiter, (req, res) => {
    res.json({
        status: 'healthy',
        message: 'Michelle Avatar is running',
        azureConnected: !!process.env.AZURE_SPEECH_KEY,
        geminiConnected: !!process.env.GEMINI_API_KEY,
        mailtrapConfigured: !!(process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS),
        timestamp: new Date().toISOString()
    });
});

// Speech-to-Text: receives raw audio, returns recognized text
app.post('/api/speech/recognize', voiceLimiter, async (req, res) => {
    try {
        const rawBody = req.body;

        if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
            return res.status(400).json({ success: false, error: 'No audio data received' });
        }

        // Ensure we always work with a Buffer
        const audioBuffer = Buffer.from(rawBody);
        console.log(`🎙️  Recognizing audio (${audioBuffer.length} bytes)...`);
        const result = await recognizeSpeechFromBuffer(audioBuffer);
        console.log(result.success ? `✅ Recognized: "${result.text}"` : '❌ No speech recognized');
        res.json(result);
    } catch (error) {
        console.error('Speech recognition error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Text-to-Speech: receives text, returns MP3 audio bytes
app.post('/api/speech/synthesize', apiLimiter, async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'No text provided' });
        }

        console.log(`🔊 Synthesizing: "${text.length > LOG_PREVIEW_LENGTH ? text.substring(0, LOG_PREVIEW_LENGTH) + '...' : text}"`);
        const audioBuffer = await synthesizeSpeechToBuffer(text);

        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Length', audioBuffer.length);
        res.send(audioBuffer);
    } catch (error) {
        console.error('Speech synthesis error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Chat: text in, AI text response out
app.post('/api/chat', apiLimiter, async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'No message provided' });
        }

        console.log(`💬 Chat message: "${message.length > LOG_PREVIEW_LENGTH ? message.substring(0, LOG_PREVIEW_LENGTH) + '...' : message}"`);
        const response = await getGeminiResponse(message, Array.isArray(history) ? history : []);
        console.log(`🤖 Michelle: "${response.length > LOG_PREVIEW_LENGTH ? response.substring(0, LOG_PREVIEW_LENGTH) + '...' : response}"`);

        res.json({ success: true, response });
    } catch (error) {
        console.error('Gemini AI error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Full voice pipeline: audio in → STT → Gemini → TTS → audio out
app.post('/api/voice/process', voiceLimiter, async (req, res) => {
    try {
        const rawBody = req.body;

        if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
            return res.status(400).json({ success: false, error: 'No audio data received' });
        }

        // Ensure we always work with a Buffer
        const audioBuffer = Buffer.from(rawBody);

        // Step 1: Speech-to-Text
        console.log('🎙️  Voice pipeline: recognizing speech...');
        const sttResult = await recognizeSpeechFromBuffer(audioBuffer);

        if (!sttResult.success || !sttResult.text) {
            return res.status(400).json({
                success: false,
                error: 'Could not recognize speech',
                transcript: ''
            });
        }

        const transcript = sttResult.text;
        console.log(`✅ Transcript: "${transcript.length > LOG_PREVIEW_LENGTH ? transcript.substring(0, LOG_PREVIEW_LENGTH) + '...' : transcript}"`);

        // Step 2: Gemini AI response
        console.log('🤖 Getting Gemini response...');
        const aiResponse = await getGeminiResponse(transcript);
        console.log(`🤖 Michelle: "${aiResponse.length > LOG_PREVIEW_LENGTH ? aiResponse.substring(0, LOG_PREVIEW_LENGTH) + '...' : aiResponse}"`);

        // Step 3: Text-to-Speech
        console.log('🔊 Synthesizing response audio...');
        const responseAudio = await synthesizeSpeechToBuffer(aiResponse);

        // Return transcript + AI response + audio as base64
        res.json({
            success: true,
            transcript,
            response: aiResponse,
            audio: responseAudio.toString('base64'),
            audioMimeType: 'audio/mpeg'
        });
    } catch (error) {
        console.error('Voice pipeline error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create a booking
app.post('/api/bookings', apiLimiter, async (req, res) => {
    try {
        const { name, email, date, time, service, notes } = req.body;

        if (!name || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'Missing required booking fields: name, date, time'
            });
        }

        // Collision-safe ID using cryptographically secure random bytes
        const booking = {
            id: `BK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            name: String(name),
            email: email ? String(email) : '',
            date: String(date),
            time: String(time),
            service: service ? String(service) : 'General Appointment',
            notes: notes ? String(notes) : '',
            createdAt: new Date().toISOString(),
            status: 'confirmed'
        };

        bookings.push(booking);
        console.log(`📅 New booking: ${booking.id} – ${name} on ${date} at ${time}`);

        // Send confirmation email if email is provided
        let emailSent = false;
        if (email) {
            try {
                emailSent = await sendBookingConfirmation(booking);
            } catch (emailErr) {
                console.error('Email send failed:', emailErr.message);
            }
        }

        res.json({
            success: true,
            message: 'Booking confirmed!',
            booking,
            emailSent
        });
    } catch (error) {
        console.error('Booking error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// List all bookings
app.get('/api/bookings', apiLimiter, (req, res) => {
    res.json({ success: true, bookings });
});

// Get a specific booking by ID
app.get('/api/bookings/:id', apiLimiter, (req, res) => {
    const booking = bookings.find((b) => b.id === req.params.id);
    if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, booking });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🎭 Michelle Avatar Server running at http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);

    if (process.env.AZURE_SPEECH_KEY) {
        console.log(`✅ Azure Speech Services: CONNECTED (${process.env.AZURE_SPEECH_REGION || 'eastus'})`);
    } else {
        console.warn('⚠️  AZURE_SPEECH_KEY not set – speech features will not work');
    }

    if (process.env.GEMINI_API_KEY) {
        console.log('✅ Gemini AI: CONNECTED');
    } else {
        console.warn('⚠️  GEMINI_API_KEY not set – AI responses will not work');
    }

    if (process.env.MAILTRAP_USER) {
        console.log('✅ Mailtrap Email: CONFIGURED');
    } else {
        console.warn('⚠️  MAILTRAP_USER/PASS not set – email confirmations disabled');
    }

    console.log('\n🎤 Michelle is ready!\n');
});
