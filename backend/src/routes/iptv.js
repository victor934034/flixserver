const router = require('express').Router();
const { supabase } = require('../services/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /iptv/me — retorna credenciais XC do usuário logado (somente se ativo)
router.get('/me', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iptv_credentials')
      .select('server_url, xc_username, xc_password, active')
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Sem credenciais IPTV vinculadas a esta conta' });
    }
    if (!data.active) {
      return res.status(403).json({ error: 'Assinatura IPTV inativa' });
    }

    res.json({
      server_url: data.server_url,
      xc_username: data.xc_username,
      xc_password: data.xc_password,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
