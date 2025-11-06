// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

/**
 * Normalize different JWT payload shapes into a consistent req.user
 * Supports:
 *  - {_id, role, email, name}
 *  - {id, role, ...}
 *  - {user: {_id/id/userId}, role?}
 *  - {sub: "..."} as fallback
 */
function normalizeJwtPayload(decoded) {
  const base = (decoded && typeof decoded.user === 'object') ? decoded.user : decoded;

  const _id =
      base?._id ||
      base?.id ||
      base?.userId ||
      decoded?.sub ||
      null;

  const role =
      base?.role ||
      decoded?.role ||
      null;

  const email = base?.email || decoded?.email || null;
  const name  = base?.name  || decoded?.name  || null;

  return { _id, role, email, name, ...base };
}

const protect = (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Not authorized: missing token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = normalizeJwtPayload(decoded);

    if (!user || !user._id) {
      // console.log('Decoded JWT without usable _id:', decoded);
      return res.status(401).json({ message: 'Not authorized: invalid token payload' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized: invalid token' });
  }
};

/**
 * Optional role gate (use on routes that require specific roles)
 * e.g., router.post('/', protect, requireRole('teacher'), handler)
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user?.role) {
    return res.status(403).json({ message: 'Forbidden: role missing' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient role' });
  }
  return next();
};

module.exports = { protect, requireRole };
