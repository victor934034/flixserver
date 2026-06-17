# Deploy no EasePanel

## Estrutura no EasePanel

Você vai criar 2 apps no EasePanel:
- `flixhome-api` → backend Node.js na porta 3001
- `flixhome-web` → frontend Next.js na porta 3000

---

## Passo 1 — Supabase

1. Acesse o SQL Editor do seu projeto Supabase
2. Execute o arquivo `supabase/schema.sql` completo
3. Vá em Authentication → Settings e habilite Email/Password
4. Copie: Project URL, anon key e service_role key

---

## Passo 2 — Deploy da API

No EasePanel, crie um novo app:

- **Tipo**: Docker (ou Git se você subir o código no GitHub)
- **Nome**: `flixhome-api`
- **Dockerfile**: `./backend/Dockerfile`
- **Porta**: 3001
- **Domínio**: api.seudominio.com (configure no EasePanel)

**Variáveis de ambiente** (cole no campo Environment Variables):

```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
SUPABASE_ANON_KEY=eyJhbGci...
TMDB_API_KEY=sua_chave_tmdb
BACKBLAZE_KEY_ID=005633c192802b5...
BACKBLAZE_APP_KEY=sua_app_key_backblaze
BACKBLAZE_BUCKET_ID=b6b3735cb1a9926890b20b15
BACKBLAZE_BUCKET_NAME=Flixhome
CDN_BASE_URL=https://cineflix.victorlima0978.workers.dev
JWT_SECRET=coloque_string_aleatoria_longa_aqui
FRONTEND_URL=https://seudominio.com
```

---

## Passo 3 — Deploy do Frontend

No EasePanel, crie outro app:

- **Nome**: `flixhome-web`
- **Dockerfile**: `./frontend/Dockerfile`
- **Porta**: 3000
- **Domínio**: seudominio.com

**Build Arguments** (necessário porque Next.js embute no build):

```
NEXT_PUBLIC_API_URL=https://api.seudominio.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_CDN_URL=https://cineflix.victorlima0978.workers.dev
```

> ⚠️ As variáveis `NEXT_PUBLIC_*` precisam estar em **Build Args**, não em Environment — o Next.js as embute durante o build.

---

## Passo 4 — Primeiro Admin

Após subir, crie um usuário pelo site e depois execute no SQL Editor do Supabase:

```sql
UPDATE users SET is_admin = true WHERE email = 'seu@email.com';
```

---

## Passo 5 — Testar

1. `https://api.seudominio.com/api/health` → deve retornar `{"status":"ok"}`
2. `https://seudominio.com` → home do site
3. `https://seudominio.com/admin` → painel admin

---

## Usando o Docker Compose localmente (desenvolvimento)

```bash
# Na raiz do projeto
cp .env.example .env
# Preencha o .env com suas chaves

docker compose up --build
# API: http://localhost:3001
# Site: http://localhost:3000
```

---

## Usando o Bot TMDB pelo terminal

```bash
cd backend
npm install
cp .env.example .env  # preencha as variáveis

# Importar arquivos diretamente:
node tmdb-bot.js \
  "https://cineflix.victorlima0978.workers.dev/Avengers.Endgame.2019.1080p.mkv" \
  "https://cineflix.victorlima0978.workers.dev/Breaking.Bad.S01E01.mkv"
```

Ou use a interface do Admin em `/admin/importar`.
