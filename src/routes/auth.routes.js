const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Simple in-memory user store (in production, use a proper database)
const users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@debtcollection.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    role: 'admin',
    isActive: true,
    createdAt: new Date(),
    lastLogin: null
  },
  {
    id: 2,
    username: 'collector',
    email: 'collector@debtcollection.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    role: 'collector',
    isActive: true,
    createdAt: new Date(),
    lastLogin: null
  }
];

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check user role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Login endpoint
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = users.find(u => u.username === username && u.isActive);
    if (!user) {
      logger.warn(`Failed login attempt for username: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn(`Failed login attempt for username: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
      { expiresIn: '7d' }
    );

    logger.info(`User ${username} logged in successfully`);

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key', (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      const user = users.find(u => u.id === decoded.id && u.isActive);
      if (!user) {
        return res.status(403).json({ error: 'User not found' });
      }

      // Generate new access token
      const newToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token: newToken
      });
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, (req, res) => {
  try {
    // In a real application, you would invalidate the token
    // For now, we'll just log the logout
    logger.info(`User ${req.user.username} logged out`);
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update email if provided
    if (email && email !== user.email) {
      // Check if email is already taken
      const emailExists = users.find(u => u.email === email && u.id !== user.id);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      user.email = email;
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required to change password' });
      }

      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidCurrentPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
    }

    logger.info(`User ${user.username} updated profile`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/users', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let filteredUsers = users.filter(user => 
      user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );

    const total = filteredUsers.length;
    const paginatedUsers = filteredUsers
      .slice(offset, offset + parseInt(limit))
      .map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));

    res.json({
      users: paginatedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Users fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user (admin only)
router.post('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { username, email, password, role = 'collector' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if username or email already exists
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: users.length + 1,
      username,
      email,
      password: hashedPassword,
      role,
      isActive: true,
      createdAt: new Date(),
      lastLogin: null
    };

    users.push(newUser);

    logger.info(`New user created: ${username} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    logger.error('User creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, isActive, password } = req.body;

    const user = users.find(u => u.id === parseInt(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields if provided
    if (email && email !== user.email) {
      const emailExists = users.find(u => u.email === email && u.id !== user.id);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      user.email = email;
    }

    if (role) {
      user.role = role;
    }

    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    logger.info(`User ${user.username} updated by ${req.user.username}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    logger.error('User update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const userIndex = users.findIndex(u => u.id === parseInt(id));
    
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[userIndex];
    
    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    users.splice(userIndex, 1);

    logger.info(`User ${user.username} deleted by ${req.user.username}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('User deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token endpoint (for frontend to check if token is still valid)
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Export middleware functions for use in other routes
module.exports = {
  router,
  authenticateToken,
  requireRole
};