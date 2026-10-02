-- PIN opcional por perfil (ex: proteger um perfil adulto com senha numérica
-- ao selecioná-lo). Opt-in — perfil sem PIN continua abrindo direto.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin VARCHAR(10);
