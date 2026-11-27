// Histórico de novidades mostrado no app após cada atualização (modal
// "O que há de novo"). Adicione uma entrada nova no TOPO a cada versão
// que tiver mudanças relevantes pro usuário — o app mostra só as entradas
// mais novas que a última vista (guardado no AsyncStorage).
// REGRA: toda publicação com mudança para o usuário ganha entrada nova aqui.
export const CHANGELOG = [
  {
    version: '1.3.0',
    items: [
      'Corrigido: dezenas de filmes que não davam play no Dublado ou no Legendado.',
      '👋 Passo a passo novo: veja em um minuto como usar o FlixHome.',
      'Para abrir: aba Perfil → “Como usar o FlixHome”.',
    ],
  },
  {
    version: '1.2.1',
    items: [
      'Corrigido: o “Pular abertura” e o “Próximo episódio” não ficam mais em cima da linha do tempo.',
      'Corrigido: episódio já assistido recomeça do início, em vez de abrir no final.',
      'O episódio não pula mais sozinho nos créditos, só quando termina.',
    ],
  },
  {
    version: '1.2.0',
    items: [
      '⏭️ “Pular abertura” e “Próximo episódio” aparecem na hora certa nas séries.',
      '✓ Marque um título como já assistido: ele ganha um selo e sai das recomendações.',
      '🎲 Surpreenda-me: escolha um gênero e a gente sorteia um filme.',
      '🏆 Top 10 da semana na tela inicial.',
      '🎉 Aviso quando um título que você pediu entra no catálogo.',
      'Continuar assistindo: não curtiu? Toque no ✕ do título para tirar da lista.',
      'Assistir juntos corrigido: a sala volta a conectar.',
      'No Assistir juntos agora dá para escolher: criar uma sala ou entrar com um código.',
      'Novo botão para avaliar o app (Perfil → Avaliar o app).',
      'IPTV: canais que não abriam agora têm um caminho alternativo, e dá para transmitir para a TV pelo Chromecast.',
    ],
  },
  {
    version: '1.1.0',
    items: [
      'Nova área de IPTV: canais ao vivo por categoria, favoritos e troca rápida de canal no player.',
      'Assistir juntos ganhou convite, sala de espera, avatares e chat para combinar a sessão com os amigos.',
      'Novas telas de planos, teste grátis, pagamento e Minha Assinatura.',
      'Agora você pode apoiar o FlixHome diretamente pelo app.',
      'Filtros de filmes e séries ficaram mais completos para encontrar exatamente o que assistir.',
      'Player de TV ao vivo mais estável, sem voltar para a tela de carregamento a cada oscilação.',
    ],
  },
  {
    version: '1.0.9',
    items: [
      'Novo chat ao vivo com o suporte (Perfil → Falar com o suporte): mande mensagens, fotos, vídeos e arquivos.',
      'Botão do grupo no Telegram no Perfil.',
      'Séries com nome das temporadas (ex.: One Piece mostra "Saga East Blue", "Arco Alabasta"...).',
      'Sem internet: agora dá pra abrir o app e assistir os downloads direto, sem travar na escolha de perfil.',
      'Minha Lista: os títulos ficam lado a lado em grade, ocupando melhor a tela.',
      'Corrigido: remover da Minha Lista não apagava de verdade (o título voltava e o coração continuava vermelho).',
      'O app agora recebe correções automaticamente, sem precisar baixar uma versão nova na loja.',
    ],
  },
  {
    version: '1.0.8',
    items: [
      'Corrigido de vez o erro 404 ao reproduzir alguns vídeos (causa raiz era um bug na ferramenta de limpeza do catálogo).',
      'PIN opcional pra proteger um perfil (ex: o adulto) — configurável na edição do perfil.',
      'Botão de compartilhar filme/série.',
      'Nova tela de Ajuda/FAQ (Perfil → Ajuda).',
      'Sugerir conteúdo agora busca certo (antes quase nunca achava o título pra selecionar).',
      'Recomendados pra você ficou mais preciso, cruzando com títulos parecidos de verdade (não só mesmo gênero).',
      'Categoria da busca agora é um dropdown em vez de fileira de botões.',
      'Cronologias podem ter contagem regressiva pra um evento (ex: estreia de um filme).',
      'Removido o link direto do vídeo de dentro do player — mais segurança, sem vazar URL do armazenamento.',
    ],
  },
  {
    version: '1.0.7',
    items: [
      'Busca muito melhor: "homem aranha" acha "Homem-Aranha", "hercules" acha "Hércules" — ignora acento e hífen (em todos os apps). Agora também dá pra buscar por voz.',
      'Nova fileira "Recomendados pra você" na Home, baseada no que você já assistiu.',
      'Aviso por notificação quando sai episódio novo de uma série da sua Minha Lista.',
      'Detalhes: o botão vira "Continuar assistindo" (e "Continuar T2 E05" nas séries) quando você já começou.',
      'Player: "Próximo episódio" e "Ep. anterior" mais confiáveis (funcionam em qualquer entrada, pulam episódios sem vídeo), lista de episódios abre já no que você está vendo.',
      'Chromecast redesenhado: barra de progresso e tempo da TV, volume, mudo, legendas, trocar áudio/episódio e parar transmissão, tudo pelo celular.',
      'Picture-in-Picture: continue assistindo com o app minimizado. Trailer na tela de detalhes.',
      'Downloads: baixar temporada inteira em fila, baixar o próximo episódio sozinho (Wi-Fi) e apagar depois de assistir (opcional, em Perfil).',
    ],
  },
  {
    version: '1.0.6',
    items: [
      'Login: botão de mostrar/ocultar senha pra conferir o que foi digitado.',
      'Corrigido: o botão "Próximo episódio" não aparecia ao continuar assistindo direto da Home.',
      'Corrigido: pôsteres, capas e fotos de perfil agora ficam salvos no aparelho — não somem mais quando a internet cai.',
      'Sem internet: o app te leva direto para os Downloads em vez de travar em telas em branco.',
      'Popup de transmissão (Chromecast) com ícone mais visível.',
    ],
  },
];
