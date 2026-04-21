const jwt = require('jsonwebtoken');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createHttpError(401, 'Access denied. No token provided.'));
  }

  const token = authHeader.split(' ')[1];

  if (!process.env.JWT_SECRET) {
    return next(createHttpError(500, 'JWT_SECRET is not configured in environment variables.'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return next(createHttpError(401, 'Invalid or expired token.'));
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(createHttpError(403, 'Admin access required.'));
  }

  return next();
}

module.exports = {
  protect,
  adminOnly,
};
