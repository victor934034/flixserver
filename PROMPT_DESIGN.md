# PROMPT PARA O CODE DESIGN — FlixHome (telas novas e refeitas)

Cole tudo abaixo no Code Design. Entregue **uma versão por plataforma** (Mobile 390×844, Web 1440×900 + 390 responsivo, TV 1920×1080 com foco D‑pad) para cada tela.

---

## Contexto do produto
FlixHome é um app de streaming (filmes, séries, IPTV ao vivo) em português do Brasil. Existe em 3 plataformas que precisam ter **as mesmas funcionalidades e a mesma identidade**: App mobile (React Native/Expo), Web (Next.js) e TV (Tizen/webOS/Android TV).

**Identidade atual (manter e elevar):** tema escuro cinematográfico, fundo `#0A0A0A`/`#141414`, superfícies `#1F1F1F`, cor de marca vermelho `#E50914`, texto `#E5E5E5`, secundário `#888`, aviso âmbar `#FBBF24`, sucesso verde `#22C55E`. Logo em texto “FLIXHOME” com letter‑spacing largo. Cantos 12–16px, sombras suaves, microanimações discretas (200–300ms). Tipografia sem serifa, títulos pesados (800–900).

**Regras globais**
- Mobile: alvos de toque ≥ 44px, respeitar safe area, funcionar em 360px de largura.
- Web: layout responsivo (desktop/tablet/mobile), foco visível por teclado.
- TV: tudo navegável por D‑pad; estado de foco forte (borda branca 3px + escala 1.06); fonte mínima 24px; nada de depender de mouse/toque; digitação pesada deve ser evitada (usar QR code para continuar no celular).
- Entregar estados: carregando (skeleton), vazio, erro, sucesso, desabilitado.

---

## 1. TELA DE PLANOS / ASSINATURA (refazer — “bem bonita”)
Substitui a tela atual de “Escolha seu plano”.
- Cabeçalho com título forte e subtítulo de benefícios (sem anúncios, vários perfis, qualidade até 4K, telas simultâneas).
- Abas/segmentado: **Filmes & Séries** | **IPTV ao vivo**.
- **Cards de plano**: nome, preço grande, preço antigo riscado quando há promoção, selo (“Mais popular”, “Melhor custo‑benefício”), lista de benefícios com ícones de check, nº de telas simultâneas, duração. O plano destacado tem borda/gradiente vermelho e leve glow. Seleção clara (radio visual).
- **Banner de TESTE GRÁTIS** (aparece só se o admin ativou e o usuário ainda não usou): “Teste grátis por X dias” com botão primário “Começar teste grátis”; sem exigir cartão. Variante compacta para colocar no topo da Home.
- Estado de assinatura ativa: mostrar plano atual, data de expiração, “dias restantes” (barra de progresso) e botão “Renovar”. Estado “teste grátis ativo” com contagem regressiva e CTA “Assinar agora”. Estado “expirado”.
- Rodapé: selos de segurança (“Pagamento seguro”, PIX/Cartão/Boleto), link de ajuda.
- TV: cards em fileira horizontal com foco; botão “Pagar pelo celular” que abre o QR code (ver tela 2).

## 2. PÁGINA DE PAGAMENTO PRÓPRIA (nova — checkout)
Fluxo em passos, sem sair do app (no web é a rota `/pagamento`). Processador: Asaas (PIX, cartão de crédito, boleto).
1. **Resumo do pedido** (cartão lateral no web / topo no mobile): plano, duração, preço, desconto, total. Edição de plano.
2. **Dados do pagador:** CPF/CNPJ (com máscara e validação), celular (opcional). Nome/e‑mail já vêm da conta (mostrar só leitura).
3. **Forma de pagamento** (3 opções grandes e selecionáveis): **PIX** (com tag “Aprovação na hora”), **Cartão de crédito**, **Boleto**.
   - **Cartão:** campos número (máscara + bandeira detectada), nome impresso, validade MM/AA, CVV, CEP, nº do endereço. Pré‑visualização do cartão animada (vira ao focar no CVV).
   - **Boleto:** explicar prazo de compensação (1–3 dias úteis).
4. **Tela PIX aguardando pagamento:** QR code grande, botão “Copiar código PIX” com feedback “Copiado!”, contador de expiração, passo a passo (1‑2‑3), indicador “Aguardando confirmação…” com pulso — a tela detecta o pagamento sozinha (polling) e avança.
5. **Tela de boleto gerado:** linha digitável com botão copiar, botão “Abrir boleto (PDF)”, vencimento.
6. **Sucesso** (animação de check/confete discreta): plano ativado, validade, botão “Começar a assistir”. **Pendente** e **Falha** (cartão recusado com motivo e botão “Tentar outra forma”).
- Barra de progresso de passos no topo; botão primário fixo no rodapé (mobile); microcopy de segurança (“Dados criptografados”).
- **TV:** tela com QR code grande “Escaneie com o celular para pagar” + código curto; ao confirmar, a TV atualiza sozinha para a tela de sucesso.
- Variante “Apoie o FlixHome” (valor livre com chips de R$ 10 / 20 / 50 / outro) usando o mesmo fluxo.

## 3. ASSISTIR JUNTOS (nova funcionalidade — sincronizado, com chat e voz)
Objetivo: duas ou mais pessoas assistem o mesmo filme/episódio **em tempo real, sem atraso**; play/pause/seek/troca de áudio/legenda são espelhados para todos; chat de texto e chat de voz dentro da própria sessão.
Telas e componentes:
- **Botão “Assistir juntos”** na página de detalhes do filme/série e no player (ícone de duas pessoas).
- **Criar sessão (bottom sheet no mobile / modal no web / painel lateral na TV):** dois caminhos —
  a) **Compartilhar link** (copiar, WhatsApp, mais opções) com um código curto da sala;
  b) **Chamar um amigo direto pelo app** (busca por nome/e‑mail ou lista de amigos recentes → envia convite com notificação).
  Opções do anfitrião: “Todos controlam play/pause” vs “Só eu controlo”.
- **Convite recebido** (notificação + tela cheia): avatar de quem convidou, título e capa do conteúdo, botões “Entrar” / “Agora não”.
- **Lobby/sala de espera** (opcional, curto): avatares dos participantes, status “Aguardando…”, botão “Começar”.
- **Player em sessão:** 
  - chip de status no topo: “Sincronizado • 2 assistindo” (verde) / “Ressincronizando…” (âmbar);
  - faixa de **avatares dos participantes** com indicador de quem está falando (anel pulsante);
  - **toasts de eventos** (“Ana pausou”, “Pedro trocou o áudio para Inglês”, “Ana entrou”);
  - **painel de chat**: no mobile é uma gaveta que sobe da base (com mensagens flutuantes translúcidas por cima do vídeo quando a gaveta está fechada, somem em 5s); no web é coluna lateral recolhível; na TV é painel lateral com mensagens em leitura + respostas rápidas por emoji/frases (digitação opcional via celular).
  - **controles de voz:** botão de microfone (ligado/mudo/sem permissão), botão de volume das vozes, indicador de quem fala; estado “permitir microfone”.
  - botão **Sair da sessão** / **Encerrar para todos** (anfitrião) com confirmação.
- Estados: reconectando, participante saiu, sala cheia, link expirado/inválido, conteúdo indisponível para o convidado (sem plano → CTA para teste grátis/assinar).
- **Tela “Entrar pelo link”** (web e app abrindo de deep link): mostra capa, quem convidou, quantos já estão, botão “Entrar na sessão”; se não logado, vai para login e volta.

## 4. WEB — PARIDADE COMPLETA COM O APP
A versão web precisa de todas as telas que o app mobile tem. Desenhar/ajustar (desktop + responsivo):
Login/cadastro **com código de e‑mail (OTP de 6 dígitos)**, esqueci a senha, seleção de perfil, Home (hero + fileiras + “Recém lançados”), Filmes, Séries, Busca (com filtros), Detalhes de filme e série (elenco, episódios por temporada, sugestões), Player (legendas, áudio, qualidade, próximo episódio, Cast), Minha lista, Histórico/Continuar assistindo, Cronologias (coleções), Downloads/Offline (explicar que no web é “Salvar na lista”), IPTV (categorias, canais, player ao vivo), Notificações, Controle parental, Perfil/Conta, Autorizar TV, Ajuda (artigos) e **Chat de suporte**, Sugestão de título, Assistir juntos, Planos e Pagamento.
Layout web: barra de navegação superior fixa (logo, Início/Filmes/Séries/IPTV/Minha lista, busca, notificações, avatar com menu), rodapé com links. Grid responsivo de capas 2→6 colunas.
- **Aviso de navegador (já existe, estilizar):** faixa/toast âmbar “Alguns conteúdos não funcionam no Chrome — todos funcionam no Microsoft Edge”, com botão “Entendi” e link “Abrir no Edge”.

## 5. CÓDIGO POR E‑MAIL — AVISO DE SPAM (ajuste nas telas de OTP)
Nas telas “Verifique seu e‑mail”, “Criar conta” e “Esqueci minha senha”, incluir um **callout âmbar** abaixo do texto: “📬 Não chegou? Olhe também a caixa de **spam / lixo eletrônico**.” + botão “Reenviar código” com contagem regressiva. Desenhar para mobile, web e TV (na TV o login é por QR/código de pareamento).

## 6. FILTROS DE DATA DE LANÇAMENTO E “RECÉM LANÇADOS” (novo)
- **Fileira “Recém lançados”** na Home (e página própria): ordenada pela **data real de lançamento** do filme/série, com selo “NOVO” e a data (“Lançado em 12 nov 2026”).
- **Painel de filtros** (bottom sheet no mobile, painel lateral/dropdown no web, tela lateral na TV) na Busca, Filmes e Séries: **Ano de lançamento** (de/até), atalhos “Últimos 30 dias / 6 meses / Este ano / Anos 2010s / 2000s…”, gênero, nota mínima, ordenar por (Mais recentes, Mais antigos, Melhor avaliados, A‑Z). Chips ativos removíveis no topo da lista e botão “Limpar filtros”.

## 7. ADMIN (painel web) — NOVAS TELAS/ÁREAS
1. **Teste grátis (Configurações):** card com interruptor “Teste grátis ativo”, campo “Duração (dias)”, interruptor “Conceder automaticamente no cadastro”, texto de ajuda e botão Salvar; mini‑métricas (testes ativos, convertidos em assinatura).
2. **Orquestrador de assinaturas e pagamentos:** tabela com filtros (status: Pendente/Pago/Vencido/Estornado; tipo: Plano/IPTV/Apoio; período; busca por e‑mail), colunas (usuário, plano, valor, forma, status com badge colorido, data), ação “Ressincronizar com Asaas”, abertura do detalhe (linha do tempo do pagamento), cards de resumo no topo (receita do mês, pagantes ativos, em teste, pendentes, vencendo em 7 dias). Aba IPTV: fila de pedidos aguardando ativação com botão “Ativar” e campos de usuário/senha do servidor. Aba Planos: editor de planos (nome, preço, promoção, duração, telas simultâneas, selo, ativo).
3. **Filtros de conteúdo (Filmes/Séries):** chips/abas para ver rapidamente **Em destaque**, **No banner**, **Recém adicionados**, **Sem capa**, **Sem vídeo**, **Sem legenda**, **Ocultos**; contagem em cada chip; busca; ordenação; ação em massa (destacar/remover destaque, colocar/tirar do banner). Badge visível nas linhas (⭐ Destaque, 🖼 Banner).
4. **Gerenciador de banners da Home:** lista arrastável (drag‑and‑drop) com prévia ao vivo de como o banner aparece no app/TV; mudanças valem sem o usuário precisar fechar o app.

## 8. TV — ADAPTAÇÕES
Para cada tela acima, entregar a versão TV com foco D‑pad: Planos, Pagamento por QR, Assistir juntos (convite aceito pelo controle, painel de participantes e chat em leitura/respostas rápidas, microfone por botão do controle), Filtros por data, Recém lançados, tela de teste grátis, aviso de spam no login por código.

---

## Entregáveis
- Para cada tela: Mobile, Web (desktop + responsivo) e TV, com **todos os estados**.
- Tokens (cores, espaçamentos, raios, sombras, tipografia) e componentes reutilizáveis (card de plano, seletor de pagamento, chip de status, avatar de participante com anel de fala, bolha de chat, painel de filtros, badge de status).
- Anotar interações/animações importantes (transições de passo no checkout, pulso de espera do PIX, anel de fala, toasts de sincronização).
