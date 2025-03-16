require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// In-memory storage
const pastes = new Map();
const bannedIPs = new Set();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));
app.use(cors());
app.use(morgan('dev'));
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Middleware to check banned IPs
const checkBannedIP = (req, res, next) => {
    const ip = req.ip;
    if (bannedIPs.has(ip)) {
        return res.status(403).json({ error: 'Your IP has been banned' });
    }
    next();
};

// Authentication middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Routes

// Generate unique ID
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Create new paste
app.post('/api/paste', checkBannedIP, (req, res) => {
    try {
        console.log('Received paste request:', req.body);
        const { title, content, syntax } = req.body;
        const id = generateId();
        const paste = {
            id,
            title: title || 'Untitled Paste',
            content,
            syntax: syntax || 'none',
            timestamp: new Date(),
            ip: req.ip,
            status: 'active'
        };
        pastes.set(id, paste);
        console.log('Created paste:', paste);
        res.json({ id });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create paste' });
    }
});

// Get paste by ID
app.get('/api/paste/:id', (req, res) => {
    const paste = pastes.get(req.params.id);
    if (!paste || paste.status === 'deleted') {
        return res.status(404).json({ error: 'Paste not found' });
    }
    res.json(paste);
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    // In production, use environment variables and proper password hashing
    if (username === process.env.ADMIN_USERNAME && 
        await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Admin routes
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    try {
        const totalPastes = pastes.size;
        const bannedIPsCount = bannedIPs.size;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayPastes = Array.from(pastes.values()).filter(
            paste => paste.timestamp >= today
        ).length;
        
        res.json({ 
            totalPastes, 
            bannedIPs: bannedIPsCount, 
            todayPastes 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get pastes for admin
app.get('/api/admin/pastes', authenticateAdmin, (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status;

        let filteredPastes = Array.from(pastes.values());

        if (search) {
            const searchLower = search.toLowerCase();
            filteredPastes = filteredPastes.filter(paste => 
                paste.title.toLowerCase().includes(searchLower) ||
                paste.content.toLowerCase().includes(searchLower)
            );
        }

        if (status && status !== 'all') {
            filteredPastes = filteredPastes.filter(paste => 
                paste.status === status
            );
        }

        const total = filteredPastes.length;
        const pastesList = filteredPastes
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice((page - 1) * limit, page * limit);

        res.json({ pastes: pastesList, total });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pastes' });
    }
});

// Delete paste
app.delete('/api/admin/pastes/:id', authenticateAdmin, (req, res) => {
    try {
        const paste = pastes.get(req.params.id);
        if (paste) {
            paste.status = 'deleted';
            pastes.set(req.params.id, paste);
        }
        res.json({ message: 'Paste deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete paste' });
    }
});

// Ban IP
app.post('/api/admin/ban', authenticateAdmin, (req, res) => {
    try {
        const { ip } = req.body;
        bannedIPs.add(ip);
        res.json({ message: 'IP banned successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to ban IP' });
    }
});

// Unban IP
app.delete('/api/admin/ban/:ip', authenticateAdmin, (req, res) => {
    try {
        bannedIPs.delete(req.params.ip);
        res.json({ message: 'IP unbanned successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to unban IP' });
    }
});

// Get banned IPs
app.get('/api/admin/banned-ips', authenticateAdmin, (req, res) => {
    try {
        const bannedIPsList = Array.from(bannedIPs).map(ip => ({
            ip,
            timestamp: new Date()
        }));
        res.json(bannedIPsList);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch banned IPs' });
    }
});

// Serve paste view page
app.get('/p/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'paste.html'));
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle SPA routing
app.get('*', (req, res) => {
    if (req.path.startsWith('/p/')) {
        res.sendFile(path.join(__dirname, 'public', 'paste.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Start server
const PORT = process.env.PORT || 8000;
