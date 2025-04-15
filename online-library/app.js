const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const bodyParser = require('body-parser');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const axios = require('axios');

const app = express();

// Database configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '15May@2004',
    database: 'online_library'
};

// Email configuration
const emailConfig = {
    user: 'dubeyrajat056@gmail.com',
    pass: 'jhdg ovuw cgfj rbvl'
};

// API configurations
const JIKAN_API = 'https://api.jikan.moe/v4';
const MANGA_DEX_API = 'https://api.mangadex.org';

// Session store
const sessionStore = new MySQLStore(dbConfig);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    key: 'session_cookie_name',
    secret: 'your_secret_key_here',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 86400000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailConfig.user,
        pass: emailConfig.pass
    }
});

// Database connection pool
const pool = mysql.createPool(dbConfig);

// Utility functions
const generateOTP = () => crypto.randomInt(100000, 999999).toString();
const getExpiryTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 2);
    return now;
};

// Routes

// Home page
app.get('/', async (req, res) => {
    try {
        // Get a random page to show different manga on each reload
        const randomPage = Math.floor(Math.random() * 10) + 1;

        const response = await axios.get(`${JIKAN_API}/manga`, {
            params: {
                page: randomPage,
                limit: 12,
                order_by: 'score',
                sort: 'desc'
            }
        });

        const mangaList = response.data.data.map(manga => ({
            id: manga.mal_id,
            title: manga.title,
            thumbnail: manga.images?.jpg?.image_url || '/images/default-cover.jpg',
            score: manga.score
        }));

        res.render('home', {
            user: req.session.user || null,
            mangaList,
            isLoggedIn: !!req.session.user,
            error: null
        });
    } catch (error) {
        console.error('Error fetching manga:', error);
        res.render('home', {
            user: req.session.user || null,
            mangaList: [],
            isLoggedIn: !!req.session.user,
            error: 'Failed to load manga. Please try again later.'
        });
    }
});

// Login Routes
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', {
        user: null,
        message: null,
        error: null,
        isLoggedIn: false,
        showRegisterPopup: false
    });
});

app.post('/login', async (req, res) => {
    const { email } = req.body;

    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
        connection.release();

        if (rows.length === 0) {
            return res.render('login', {
                user: null,
                message: null,
                error: 'Email not registered. Please register first.',
                isLoggedIn: false,
                showRegisterPopup: true
            });
        }

        const user = rows[0];
        if (!user.is_verified) {
            return res.render('login', {
                user: null,
                message: null,
                error: 'Account not verified. Please complete registration.',
                isLoggedIn: false,
                showRegisterPopup: false
            });
        }

        // Generate and send OTP
        const otp = generateOTP();
        const expiresAt = getExpiryTime();

        const conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)',
            [email, otp, expiresAt]
        );
        conn.release();

        // Send OTP via email
        const mailOptions = {
            from: emailConfig.user,
            to: email,
            subject: '🔐 Your OTP for Online Library Login',
            html: `
                <div style="background-color: #f4f4f4; padding: 20px; font-family: Arial, sans-serif;">
                    <div style="max-width: 500px; background: #ffffff; padding: 20px; margin: auto; border-radius: 8px; box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.1);">
                        <h2 style="text-align: center; color: #6e8efb;">📚 Online Library OTP</h2>
                        <hr style="border: none; height: 2px; background: #6e8efb; margin: 10px 0;">

                        <p style="font-size: 16px; color: #333; text-align: center;">
                            Hello, <strong>${email}</strong> 👋
                        </p>

                        <p style="font-size: 18px; font-weight: bold; text-align: center; color: #6e8efb;">
                            Your OTP is:
                        </p>

                        <p style="font-size: 24px; font-weight: bold; text-align: center; color: #a777e3; background: #f4f4f4; padding: 10px; border-radius: 5px;">
                            ${otp}
                        </p>

                        <p style="font-size: 16px; text-align: center; color: #555;">
                            This OTP will expire in <strong>2 minutes</strong>. Please do not share it with anyone.
                        </p>

                        <div style="text-align: center; margin-top: 20px;">
                            <a href="https://yourwebsite.com/verify" style="
                                background: linear-gradient(135deg, #6e8efb, #a777e3);
                                color: #ffffff;
                                padding: 12px 20px;
                                text-decoration: none;
                                font-size: 16px;
                                font-weight: bold;
                                border-radius: 5px;
                                display: inline-block;
                            ">
                                Verify Now
                            </a>
                        </div>

                        <p style="font-size: 14px; text-align: center; color: #999; margin-top: 20px;">
                            If you didn't request this, please ignore this email or contact support.
                        </p>

                        <hr style="border: none; height: 1px; background: #ddd; margin: 20px 0;">

                        <p style="font-size: 12px; text-align: center; color: #777;">
                            📩 Online Library | Secure & Trusted
                        </p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        req.session.otpEmail = email;
        res.redirect('/otp-verify');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            user: null,
            message: null,
            error: 'An error occurred. Please try again.',
            isLoggedIn: false,
            showRegisterPopup: false
        });
    }
});

// Registration Routes
app.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('register', {
        user: null,
        error: null,
        message: null,
        isLoggedIn: false
    });
});

app.post('/register', async (req, res) => {
    const { name, email, phone } = req.body;

    try {
        const connection = await pool.getConnection();

        // Check if email exists
        const [existing] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            connection.release();
            return res.render('register', {
                user: null,
                error: 'Email already registered. Please login.',
                message: null,
                isLoggedIn: false
            });
        }

        // Create user
        await connection.query(
            'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
            [name, email, phone, 'temp_password']
        );

        // Generate and send OTP
        const otp = generateOTP();
        const expiresAt = getExpiryTime();

        await connection.query(
            'INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)',
            [email, otp, expiresAt]
        );

        // Create user-specific database
        await connection.query('CALL create_user_database(?)', [email]);

        connection.release();

        // Send OTP email
        const mailOptions = {
            from: emailConfig.user,
            to: email,
            subject: 'Your OTP for Online Library Registration',
            text: `Your OTP is ${otp}. It will expire in 2 minutes.`
        };

        await transporter.sendMail(mailOptions);

        req.session.otpEmail = email;
        req.session.registerData = { name, phone };
        res.redirect('/otp-verify');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', {
            user: null,
            error: 'An error occurred. Please try again.',
            message: null,
            isLoggedIn: false
        });
    }
});

// OTP Verification Routes
app.get('/otp-verify', (req, res) => {
    if (!req.session.otpEmail) {
        return res.redirect('/login');
    }
    res.render('otp-verify', {
        user: null,
        email: req.session.otpEmail,
        error: null,
        message: null,
        isLoggedIn: false
    });
});

app.post('/otp-verify', async (req, res) => {
    const { otp } = req.body;
    const email = req.session.otpEmail;

    if (!email) {
        return res.redirect('/login');
    }

    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(
            'SELECT * FROM otp_verification WHERE email = ? AND otp = ? AND is_used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [email, otp]
        );

        if (rows.length === 0) {
            connection.release();
            return res.render('otp-verify', {
                user: null,
                email,
                error: 'Invalid or expired OTP. Please try again.',
                message: null,
                isLoggedIn: false
            });
        }

        // Mark OTP as used
        await connection.query(
            'UPDATE otp_verification SET is_used = TRUE WHERE id = ?',
            [rows[0].id]
        );

        // Verify user if coming from registration
        await connection.query(
            'UPDATE users SET is_verified = TRUE WHERE email = ?',
            [email]
        );

        // Get user data
        const [userRows] = await connection.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = userRows[0];

        // Update last login
        await connection.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        connection.release();

        // Set session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone
        };

        delete req.session.otpEmail;
        res.redirect('/');
    } catch (error) {
        console.error('OTP verification error:', error);
        res.render('otp-verify', {
            user: null,
            email,
            error: 'An error occurred. Please try again.',
            message: null,
            isLoggedIn: false
        });
    }
});

// OTP Resend Route
app.post('/resend-otp', async (req, res) => {
    const email = req.session.otpEmail;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Session expired' });
    }

    try {
        const otp = generateOTP();
        const expiresAt = getExpiryTime();

        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO otp_verification (email, otp, expires_at) VALUES (?, ?, ?)',
            [email, otp, expiresAt]
        );
        connection.release();

        // Send OTP email
        const mailOptions = {
            from: emailConfig.user,
            to: email,
            subject: 'Your New OTP for Verification',
            text: `Your new OTP is ${otp}. It will expire in 2 minutes.`
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: 'New OTP sent successfully' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ success: false, message: 'Failed to resend OTP' });
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/');
        }
        res.clearCookie('session_cookie_name');
        res.redirect('/login');
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false });
        }
        res.clearCookie('session_cookie_name');
        res.json({ success: true });
    });
});

// Read Later Page
app.get('/read-later', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const userEmail = req.session.user.email;
        const dbName = userEmail.replace('@', '_').replace('.', '_');

        const connection = await pool.getConnection();
        const [items] = await connection.query(
            `SELECT * FROM \`${dbName}\`.readlater ORDER BY added_at DESC`
        );
        connection.release();

        res.render('readlater', {
            user: req.session.user,
            items: items || [],
            isLoggedIn: true,
            error: null
        });
    } catch (error) {
        console.error('Read later error:', error);
        res.render('readlater', {
            user: req.session.user,
            items: [],
            isLoggedIn: true,
            error: 'Failed to load your Read Later list'
        });
    }
});

// Remove from Read Later
app.post('/remove-read-later', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false });
    }

    try {
        const { manga_id } = req.body;
        const userEmail = req.session.user.email;
        const dbName = userEmail.replace('@', '_').replace('.', '_');

        const connection = await pool.getConnection();
        await connection.query(
            `DELETE FROM \`${dbName}\`.readlater WHERE manga_id = ?`,
            [manga_id]
        );
        connection.release();

        res.redirect('/read-later');
    } catch (error) {
        console.error('Remove from read later error:', error);
        res.status(500).redirect('/read-later');
    }
});

// Add to Read Later
app.post('/add-to-read-later', async (req, res) => {
    if (!req.session.user) {
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(401).json({ success: false, message: 'Not logged in' });
        }
        return res.redirect('/login');
    }

    try {
        const { manga_id, title, thumbnail } = req.body;
        const userEmail = req.session.user.email;
        const dbName = userEmail.replace('@', '_').replace('.', '_');

        const connection = await pool.getConnection();

        // Check if already in read later
        const [existing] = await connection.query(
            `SELECT * FROM \`${dbName}\`.readlater WHERE manga_id = ?`,
            [manga_id]
        );

        if (existing.length > 0) {
            connection.release();
            if (req.headers['content-type']?.includes('application/json')) {
                return res.json({ success: false, message: 'Already in your Read Later list' });
            }
            return res.redirect('/manga/' + manga_id);
        }

        await connection.query(
            `INSERT INTO \`${dbName}\`.readlater (manga_id, title, thumbnail_url) VALUES (?, ?, ?)`,
            [manga_id, title, thumbnail]
        );
        connection.release();

        if (req.headers['content-type']?.includes('application/json')) {
            return res.json({ success: true, message: 'Added to Read Later' });
        }
        res.redirect('/read-later');
    } catch (error) {
        console.error('Add to read later error:', error);
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.status(500).redirect('/manga/' + req.body.manga_id);
    }
});

// Manga Details Route (Jikan)
app.get('/manga/:id', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const mangaId = req.params.id;

        // Fetch manga details from Jikan API
        const response = await axios.get(`${JIKAN_API}/manga/${mangaId}/full`);
        const manga = response.data.data;

        // Prepare chapters data
        let chapters = [];
        if (manga.chapters) {
            for (let i = 1; i <= manga.chapters; i++) {
                chapters.push({
                    id: i,
                    chapter: i,
                    title: `Chapter ${i}`
                });
            }
        } else {
            chapters = [
                {
                    id: 1,
                    chapter: 1,
                    title: 'Sample Chapter'
                }
            ];
        }

        res.render('manga-details', {
            user: req.session.user,
            manga: {
                id: manga.mal_id,
                title: manga.title,
                description: manga.synopsis || 'No description available',
                thumbnail: manga.images?.jpg?.large_image_url || '/images/default-cover.jpg',
                chapters: chapters
            },
            isLoggedIn: true
        });
    } catch (error) {
        console.error('Manga details error:', error);
        res.status(500).render('error', {
            user: req.session.user,
            error: 'Failed to load manga details',
            isLoggedIn: !!req.session.user
        });
    }
});

// MangaDex Manga Detail Route
app.get('/mangadex/manga/:id', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const [mangaResponse, chaptersResponse] = await Promise.all([
            axios.get(`${MANGA_DEX_API}/manga/${req.params.id}`, {
                params: { includes: ['cover_art', 'author'] }
            }),
            axios.get(`${MANGA_DEX_API}/manga/${req.params.id}/feed`, {
                params: {
                    limit: 100,
                    order: { chapter: 'asc' },
                    translatedLanguage: ['en']
                }
            })
        ]);
        
        const manga = mangaResponse.data.data;
        const coverArt = manga.relationships.find(r => r.type === 'cover_art');
        const author = manga.relationships.find(r => r.type === 'author');
        
        const mangaData = {
            id: manga.id,
            title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
            description: manga.attributes.description.en || '',
            author: author?.attributes?.name || 'Unknown',
            status: manga.attributes.status || 'unknown',
            coverUrl: `https://uploads.mangadex.org/covers/${manga.id}/${coverArt?.attributes?.fileName}.512.jpg`,
            chapters: chaptersResponse.data.data.map(chapter => ({
                id: chapter.id,
                chapter: chapter.attributes.chapter,
                title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter}`,
                date: new Date(chapter.attributes.publishAt).toLocaleDateString()
            }))
        };
        
        res.render('mangadex-details', {
            user: req.session.user,
            manga: mangaData,
            isLoggedIn: true
        });
    } catch (error) {
        console.error('Error fetching manga details:', error);
        res.status(500).render('error', {
            user: req.session.user,
            error: 'Failed to load manga details',
            isLoggedIn: !!req.session.user
        });
    }
});

// MangaDex Chapter Reader Route
app.get('/mangadex/read/:chapterId', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        // Get chapter data
        const chapterResponse = await axios.get(`${MANGA_DEX_API}/at-home/server/${req.params.chapterId}`);
        const chapterData = chapterResponse.data;
        
        // Get manga details for navigation
        const mangaResponse = await axios.get(`${MANGA_DEX_API}/chapter/${req.params.chapterId}`, {
            params: { includes: ['manga'] }
        });
        
        const mangaId = mangaResponse.data.data.relationships.find(r => r.type === 'manga').id;
        
        res.render('mangadex-reader', {
            user: req.session.user,
            chapterId: req.params.chapterId,
            mangaId,
            baseUrl: chapterData.baseUrl,
            chapterHash: chapterData.chapter.hash,
            pages: chapterData.chapter.data,
            dataSaver: chapterData.chapter.dataSaver,
            chapterNumber: mangaResponse.data.data.attributes.chapter,
            chapterTitle: mangaResponse.data.data.attributes.title || `Chapter ${mangaResponse.data.data.attributes.chapter}`,
            isLoggedIn: true
        });
    } catch (error) {
        console.error('Error fetching chapter:', error);
        res.status(500).render('error', {
            user: req.session.user,
            error: 'Failed to load chapter',
            isLoggedIn: !!req.session.user
        });
    }
});

// Add to Library for MangaDex
app.post('/mangadex/add-to-library', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Not logged in' });
    }

    try {
        const { manga_id, title, thumbnail } = req.body;
        const userEmail = req.session.user.email;
        const dbName = userEmail.replace('@', '_').replace('.', '_');

        const connection = await pool.getConnection();

        // Check if already in library
        const [existing] = await connection.query(
            `SELECT * FROM \`${dbName}\`.library WHERE manga_id = ? AND source = 'mangadex'`,
            [manga_id]
        );

        if (existing.length > 0) {
            // Update last read time
            await connection.query(
                `UPDATE \`${dbName}\`.library SET last_read = NOW() WHERE id = ?`,
                [existing[0].id]
            );
            connection.release();
            return res.json({ success: true, message: 'Updated last read time' });
        }

        // Add to library with source marker
        await connection.query(
            `INSERT INTO \`${dbName}\`.library (manga_id, title, thumbnail_url, source) VALUES (?, ?, ?, 'mangadex')`,
            [manga_id, title, thumbnail]
        );
        connection.release();

        res.json({ success: true, message: 'Added to library' });
    } catch (error) {
        console.error('Add to library error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Library Route
app.get('/library', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const userEmail = req.session.user.email;
        const dbName = userEmail.replace('@', '_').replace('.', '_');

        const connection = await pool.getConnection();
        const [items] = await connection.query(
            `SELECT * FROM \`${dbName}\`.library ORDER BY last_read DESC`
        );
        connection.release();

        res.render('library', {
            user: req.session.user,
            items: items || [],
            isLoggedIn: true,
            error: null
        });
    } catch (error) {
        console.error('Library error:', error);
        res.render('library', {
            user: req.session.user,
            items: [],
            isLoggedIn: true,
            error: 'Failed to load your library'
        });
    }
});

// Remove from Library
app.post('/remove-from-library', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false });
    }

    try {
        const { manga_id } = req.body;
        const userEmail = req.session.user.email;
        const dbName = userEmail.replace('@', '_').replace('.', '_');

        const connection = await pool.getConnection();
        await connection.query(
            `DELETE FROM \`${dbName}\`.library WHERE manga_id = ?`,
            [manga_id]
        );
        connection.release();

        res.redirect('/library');
    } catch (error) {
        console.error('Remove from library error:', error);
        res.status(500).redirect('/library');
    }
});

// Add to Library (Jikan)
app.post('/add-to-library', async (req, res) => {
    if (!req.session.user) {
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(401).json({ success: false, message: 'Not logged in' });
        }
        return res.redirect('/login');
    }

    try {
        const { manga_id, title, thumbnail, pdf_url } = req.body;
        const userEmail = req.session.user.email;
        const dbName = userEmail.replace('@', '_').replace('.', '_');

        const connection = await pool.getConnection();

        // Check if already in library
        const [existing] = await connection.query(
            `SELECT * FROM \`${dbName}\`.library WHERE manga_id = ? AND source IS NULL`,
            [manga_id]
        );

        if (existing.length > 0) {
            // Update last read time
            await connection.query(
                `UPDATE \`${dbName}\`.library SET last_read = NOW() WHERE id = ?`,
                [existing[0].id]
            );
        } else {
            // Add to library
            await connection.query(
                `INSERT INTO \`${dbName}\`.library (manga_id, title, pdf_url, thumbnail_url) VALUES (?, ?, ?, ?)`,
                [manga_id, title, pdf_url, thumbnail]
            );
        }

        connection.release();

        if (req.headers['content-type']?.includes('application/json')) {
            return res.json({ success: true });
        }
        res.redirect(pdf_url);
    } catch (error) {
        console.error('Add to library error:', error);
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(500).json({ success: false, message: 'Database error' });
        }
        res.status(500).redirect('/manga/' + req.body.manga_id);
    }
});

// Search API
app.get('/api/search', async (req, res) => {
    const query = req.query.query;
    if (!query) return res.json([]);

    try {
        const response = await axios.get(`${JIKAN_API}/manga`, {
            params: {
                q: query,
                limit: 5
            }
        });

        const manga = response.data.data.map(item => ({
            title: item.title,
            author: item.authors?.[0]?.name || 'Unknown',
            thumbnail: item.images?.jpg?.image_url || 'https://via.placeholder.com/128x192',
            link: item.url
        }));

        res.json(manga);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch manga' });
    }
});

// MangaDex Search API
app.get("/api/mangadex/search", async (req, res) => {
    const query = req.query.query;
    if (!query) return res.json([]);

    try {
        const response = await axios.get(`${MANGA_DEX_API}/manga`, {
            params: { 
                title: query, 
                limit: 10,
                includes: ['cover_art']
            }
        });

        const results = response.data.data.map(manga => {
            const coverArt = manga.relationships.find(r => r.type === 'cover_art');
            const coverFileName = coverArt?.attributes?.fileName || '';
            return {
                id: manga.id,
                title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
                thumbnail: `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg`
            };
        });

        res.json(results);
    } catch (error) {
        console.error("Error searching MangaDex:", error);
        res.status(500).json({ error: "Failed to search manga" });
    }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});