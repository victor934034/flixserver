const { authMiddleware } = require('./auth');
const { supabase } = require('../services/supabase');

async function adminMiddleware(req, res, next) {
  authMiddleware(req, res, async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, is_admin')
        .eq('id', req.user.id)
        .single();

      if (error || !data?.is_admin) {
        return res.status(403).json({ error: 'Acesso negado: apenas administradores' });
      }

      next();
    } catch (err) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
  });
}

module.exports = { adminMiddleware };
