// Histórico de novidades mostrado no app após cada atualização (modal
// "O que há de novo"). Adicione uma entrada nova no TOPO a cada versão
// que tiver mudanças relevantes pro usuário — o app mostra só as entradas
// mais novas que a última vista (guardado no AsyncStorage).
export const CHANGELOG = [
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
