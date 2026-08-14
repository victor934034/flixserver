import Link from 'next/link';
import Navbar from '../../components/Navbar';
import styles from './page.module.css';

export const metadata = {
  title: 'Política de Privacidade | Flixhome',
  description: 'Como o Flixhome coleta, usa e protege seus dados pessoais.',
};

const ATUALIZADO_EM = '14 de agosto de 2026';

export default function PoliticaPrivacidadePage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Política de Privacidade</h1>
          <p className={styles.updated}>Última atualização: {ATUALIZADO_EM}</p>
        </div>

        <div className={styles.content}>
          <p>
            Esta Política de Privacidade explica como o <strong>Flixhome</strong> ("nós", "nosso" ou "plataforma")
            coleta, usa, compartilha e protege as informações dos usuários ("você") ao utilizar nosso site, aplicativo
            móvel e aplicativos de TV. Tratamos seus dados em conformidade com a Lei Geral de Proteção de Dados
            (LGPD — Lei nº 13.709/2018).
          </p>

          <h2>1. Quais dados coletamos</h2>
          <p>Coletamos os seguintes tipos de informação:</p>
          <ul>
            <li><strong>Dados de cadastro:</strong> nome, e-mail e senha (armazenada de forma criptografada) ao criar uma conta.</li>
            <li><strong>Perfis:</strong> nome e avatar de cada perfil criado dentro da sua conta, incluindo se é um perfil infantil.</li>
            <li><strong>Atividade de uso:</strong> histórico de reprodução (o que você assiste e em qual ponto parou), sua lista de favoritos, avaliações (likes/dislikes) e sugestões de conteúdo enviadas por você.</li>
            <li><strong>Dados de assinatura e pagamento:</strong> plano contratado, status e data de expiração. Pagamentos são processados por um provedor externo (Mercado Pago) — <strong>não armazenamos dados do seu cartão de crédito</strong>.</li>
            <li><strong>Notificações:</strong> token de identificação do dispositivo, usado apenas para enviar notificações push (ex: avisos de novo conteúdo ou expiração de assinatura).</li>
            <li><strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo e navegador — usados para segurança, prevenção de abuso e limite de sessões simultâneas.</li>
            <li><strong>IPTV (quando aplicável):</strong> dados de acesso e pedidos relacionados ao serviço de IPTV, se você contratar esse serviço.</li>
          </ul>

          <h2>2. Como usamos seus dados</h2>
          <ul>
            <li>Fornecer e manter o funcionamento do serviço (login, reprodução de conteúdo, sincronização de progresso entre dispositivos);</li>
            <li>Personalizar recomendações e continuar de onde você parou;</li>
            <li>Processar pagamentos e gerenciar sua assinatura;</li>
            <li>Enviar notificações relevantes (novo conteúdo, avisos de vencimento);</li>
            <li>Prevenir fraude, uso indevido da conta e proteger a segurança da plataforma;</li>
            <li>Cumprir obrigações legais.</li>
          </ul>

          <h2>3. Com quem compartilhamos seus dados</h2>
          <p>
            Não vendemos seus dados pessoais. Compartilhamos informações apenas com prestadores de serviço que nos
            ajudam a operar a plataforma, nos limites necessários para cada função:
          </p>
          <ul>
            <li><strong>Supabase</strong> — banco de dados e autenticação de conta;</li>
            <li><strong>Backblaze B2 e Cloudflare</strong> — armazenamento e entrega (CDN) dos arquivos de vídeo;</li>
            <li><strong>TMDB (The Movie Database)</strong> — fonte de metadados públicos de filmes e séries (sinopses, capas);</li>
            <li><strong>Mercado Pago</strong> — processamento de pagamentos e assinaturas;</li>
            <li><strong>Expo / serviços de push notification</strong> — envio de notificações ao seu dispositivo;</li>
            <li><strong>WhatsApp Business</strong> — comunicações administrativas relacionadas a pedidos (ex: IPTV), quando aplicável.</li>
          </ul>
          <p>
            Podemos também divulgar dados quando exigido por lei, ordem judicial ou para proteger direitos, segurança
            ou propriedade do Flixhome e de seus usuários.
          </p>

          <h2>4. Cookies e armazenamento local</h2>
          <p>
            Usamos armazenamento local do navegador/aplicativo (localStorage no site, AsyncStorage no app) para manter
            você conectado (token de sessão) e lembrar preferências como perfil ativo. Não utilizamos cookies de
            rastreamento de terceiros para publicidade.
          </p>

          <h2>5. Perfis infantis</h2>
          <p>
            Perfis marcados como infantis têm acesso restrito por controle parental, definido pelo titular da conta.
            Não coletamos intencionalmente dados pessoais adicionais de crianças além do nome do perfil (que pode ser
            um apelido, sem necessidade de dado real) e do histórico de reprodução associado a esse perfil.
          </p>

          <h2>6. Seus direitos (LGPD)</h2>
          <p>Você pode, a qualquer momento, solicitar:</p>
          <ul>
            <li>Confirmação de que tratamos seus dados e acesso a eles;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
            <li>Portabilidade dos seus dados a outro fornecedor de serviço;</li>
            <li>Eliminação dos dados tratados com base no seu consentimento;</li>
            <li>Revogação do consentimento e informação sobre com quem compartilhamos seus dados.</li>
          </ul>
          <p>
            Você também pode excluir sua conta e perfis diretamente pelo aplicativo/site, ou entrando em contato
            conosco pelo canal abaixo.
          </p>

          <h2>7. Retenção de dados</h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa ou pelo tempo necessário para cumprir finalidades
            legais, contratuais ou de segurança. Ao excluir sua conta, removemos ou anonimizamos os dados pessoais
            associados, exceto quando a retenção for exigida por lei (ex: registros fiscais de pagamento).
          </p>

          <h2>8. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo senhas armazenadas com
            hash, comunicação criptografada (HTTPS), limitação de taxa de requisições e controle de acesso por
            autenticação. Nenhum sistema é 100% imune a falhas, mas trabalhamos continuamente para reduzir riscos.
          </p>

          <h2>9. Alterações nesta política</h2>
          <p>
            Podemos atualizar esta Política de Privacidade periodicamente. A data da última atualização é exibida no
            topo desta página. Mudanças significativas serão comunicadas por aviso na plataforma.
          </p>

          <h2>10. Contato</h2>
          <p>
            Dúvidas sobre esta política ou sobre o tratamento dos seus dados podem ser enviadas para{' '}
            <a href="mailto:contato@flixhome.com.br">contato@flixhome.com.br</a>.
          </p>

          <p className={styles.backLink}>
            <Link href="/">← Voltar para o início</Link>
          </p>
        </div>
      </main>
    </>
  );
}
