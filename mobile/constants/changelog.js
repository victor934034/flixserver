// Histórico de novidades mostrado no app após cada atualização (modal
// "O que há de novo"). Adicione uma entrada nova no TOPO a cada versão
// que tiver mudanças relevantes pro usuário — o app mostra só as entradas
// mais novas que a última vista (guardado no AsyncStorage).
export const CHANGELOG = [
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
