const { authMiddleware } = require('./auth');

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (!req.user?.is_admin) {
      return res.status(403).json({ error: 'Acesso negado: apenas administradores' });
    }
    next();
  });
}

module.exports = { adminMiddleware };
