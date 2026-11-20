# Prompt para o Design — telas de IPTV e Player (FlixHome)

> Objetivo: **ver se você consegue fazer melhor do que já está**. As telas abaixo já existem e funcionam; redesenhe-as
> mantendo todas as funções, mas com mais clareza, hierarquia e acabamento. Use **exatamente** os tokens e componentes
> do arquivo "FlixHome — Telas novas" (PDF + HTML): fundo `#0A0A0A` / `#141414` / `#1F1F1F`, marca `#E50914`,
> texto `#E5E5E5`, secundário `#888`, aviso `#FBBF24`, sucesso `#22C55E`, fonte Inter 400–900, raios 8/12/16/pílula,
> espaçamento base 4. **Não entregue código para copiar** — entregue as telas; eu implemento no código existente.

## Plataformas (entregar as 3 versões de cada tela)
- **Mobile** (360×800, retrato; player em paisagem 800×360)
- **TV** (1920×1080, controle remoto: foco = borda branca 3px + escala 1.06, 200ms ease-out; texto mínimo 24px)
- **Web** (desktop 1440×900)

---

## A) IPTV

### A1. Escolha de plano IPTV
Hoje: lista de cards simples. Quero: card de plano do design (selo "MAIS POPULAR", preço grande, "/mês", risco no preço antigo,
resumo "2 telas · canais ao vivo · 30 dias", radio à direita), com o botão fixo "Assinar agora" no rodapé.
Mostrar o que o IPTV inclui (canais ao vivo, filmes e séries, quantas telas) em 3 linhas curtas com ícones.

### A2. Status da assinatura IPTV (nova)
Estados: **sem IPTV**, **aguardando ativação** (pago, o admin ainda vai ligar — com linha do tempo "Pagamento confirmado →
Ativando → Pronto"), **ativo** (vence em X dias, telas em uso 1/2, usuário do servidor) e **vencido** (botão "Renovar").
Usar badges do design (Pendente / Pago / Vencido).

### A3. Lista de canais ao vivo
Hoje: lista com categorias. Quero: barra de categorias em chips (com "2020–2026 ×" como padrão de chip removível),
busca, grade de canais com logo, nome, "agora no ar" e favorito ★. Skeleton enquanto carrega e estado vazio amigável.
Na **TV**: categorias na lateral esquerda, canais em grade à direita, foco claro.

### A4. Player de canal ao vivo
Barra superior com nome do canal + "AO VIVO" (ponto vermelho pulsante), troca rápida de canal (↑/↓ na TV, deslizar no celular),
lista de canais em gaveta lateral, indicador de qualidade/rede e estado de erro com "Tentar outro servidor".

---

## B) Player (filmes e séries)

### B1. Controles do player
Hoje: barra inferior com tempo decorrido / tempo total. **Mudança já decidida**: o tempo da direita mostra o que **falta**
(`-1:23:45`) e diminui enquanto assiste. Redesenhe a barra: progresso com buffer, miniatura ao arrastar, botões
(−10s, play/pause, +10s, próximo episódio, áudio/legenda, velocidade, tela cheia/rotacionar), título e episódio no topo,
"Pular abertura" e "Próximo episódio" como botões flutuantes. Os controles somem sozinhos e voltam ao toque/qualquer tecla.

### B2. Painéis de áudio, legenda e episódios
Folhas (bottom sheet no celular, painel lateral na TV/web) com a versão do áudio (Dublado / Legendado / Cinema / 4K),
legendas (PT / EN / ES / Desligada) e lista de episódios com miniatura, duração e barra de progresso por episódio.

### B3. Assistir juntos dentro do player
Chip de status ("Sincronizado · 2 assistindo" / "Ressincronizando…"), toasts de sincronia ("Ana pausou") que entram de cima,
**avatares com anel de fala**, botão de microfone (mudo/falando) e gaveta de chat com bolhas do design. Nada disso pode
cobrir legendas nem os controles principais.

### B4. Estados
Carregando (skeleton + "Preparando…"), buffering (anel), erro de reprodução (mensagem + "Tentar de novo" + "Trocar versão"),
sem internet e "Continuar de onde parou?" (retomar x do início).

---

## Entrega
- Cada tela nas 3 plataformas, com estados (normal, foco/pressionado, vazio, carregando, erro).
- Anotar espaçamentos e tamanhos de fonte.
- Se algo do que está hoje for ruim, **proponha melhor** — mas liste o que mudou e por quê.
