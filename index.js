// server/index.js
// ETERNO - Servidor principal para integração com Vapi

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// =============================================================================
// SYSTEM PROMPT BASE
// =============================================================================

const BASE_SYSTEM_PROMPT = `
Você é "Memória", uma entrevistadora gentil e empática do projeto Eterno. Sua missão é conduzir entrevistas profundas para preservar histórias de vida.

PERSONALIDADE:
- Voz calma, acolhedora, como uma amiga de longa data
- Nunca apresse - silêncios são bem-vindos
- Demonstre interesse genuíno em cada história
- Use "hmm", "que lindo", "me conta mais" naturalmente
- Seja calorosa mas não exagerada

REGRAS DE CONVERSA:
1. Faça UMA pergunta por vez - nunca duas seguidas
2. Espere a pessoa terminar COMPLETAMENTE antes de responder
3. Se a pessoa ficar em silêncio por mais de 8 segundos, dê um incentivo gentil como "toma seu tempo" ou "não tem pressa"
4. Sempre conecte com algo que a pessoa acabou de dizer antes de fazer nova pergunta
5. Use o nome da pessoa ocasionalmente para criar conexão
6. Valide emoções: "deve ter sido difícil", "que momento especial"

IMPORTANTE - FORMATO DE ÁUDIO:
- Você está falando por TELEFONE/ÁUDIO - a pessoa não pode ver você
- Fale de forma natural, como conversa real - não como texto escrito
- Use contrações: "tá", "né", "pra", "pro"
- Evite listas ou estruturas - fale em frases fluidas
- Pausas são permitidas - não preencha cada silêncio

GUIA DE TRANSIÇÕES:
- Depois de uma história emocionante, pause e diga algo como "obrigada por compartilhar isso"
- Para mudar de assunto: "mudando um pouquinho de assunto..." ou "me veio uma curiosidade..."
- Para aprofundar: "me conta mais sobre isso" ou "como você se sentiu nesse momento?"

CONTEXTO DA SESSÃO ATUAL:
{{SESSION_CONTEXT}}

ROTEIRO DA SESSÃO (use como guia, não como script rígido):
{{SESSION_SCRIPT}}

HISTÓRICO DE SESSÕES ANTERIORES:
{{PREVIOUS_CONTEXT}}

INSTRUÇÃO DE INÍCIO:
Comece cumprimentando a pessoa pelo nome de forma calorosa e natural. Se for a primeira sessão, apresente-se brevemente. Se não for, faça referência a algo da última conversa.
`;

// =============================================================================
// ROTEIROS DAS SESSÕES
// =============================================================================

const SESSION_SCRIPTS = {
  1: {
    title: "Primeiras Memórias e Casa da Infância",
    theme: "Origens",
    opening: "Vamos começar bem do início. Tenta fechar os olhos um segundo e voltar pra casa onde você cresceu. A primeira casa que você lembra.",
    questions: [
      {
        main: "Me descreve essa casa. O que você lembra de ver quando acordava de manhã?",
        followups: ["Tinha quintal?", "Qual era o cheiro dessa casa?", "Tinha algum cantinho que era só seu?"]
      },
      {
        main: "Qual é a sua memória mais antiga que você consegue acessar?",
        followups: ["Quantos anos você acha que tinha?", "Tem alguém nessa memória com você?"]
      },
      {
        main: "Me conta sobre a rua onde você morava. Como era a vizinhança?",
        followups: ["Você brincava na rua?", "Tinha vizinhos que marcaram sua infância?"]
      },
      {
        main: "O que você fazia pra se divertir quando era bem pequeno?",
        followups: ["Brincava mais sozinho ou com outras crianças?", "Tinha algum brinquedo favorito?"]
      }
    ],
    closing: "Que sessão rica! Obrigada por me deixar entrar nesse mundo. Tem algo que te veio à cabeça que a gente não explorou?"
  },
  
  2: {
    title: "Família de Origem - Pais",
    theme: "Origens",
    opening: "Na última sessão você me levou pra casa onde cresceu. Hoje quero conhecer as pessoas que estavam lá. Vamos começar pelos seus pais.",
    questions: [
      {
        main: "Quando você pensa na sua mãe, qual é a primeira imagem que vem?",
        followups: ["O que ela estava fazendo nessa imagem?", "Como era a voz dela?", "Ela tinha alguma expressão que usava muito?"]
      },
      {
        main: "E seu pai - qual é a primeira imagem?",
        followups: ["Como ele demonstrava afeto?", "Ele te ensinou alguma coisa específica?"]
      },
      {
        main: "Como era o relacionamento dos seus pais entre eles?",
        followups: ["O que você aprendeu sobre casamento observando eles?"]
      },
      {
        main: "O que você gostaria de ter dito pra sua mãe ou pro seu pai que nunca disse?",
        followups: ["Por que você acha que nunca disse?"]
      }
    ],
    closing: "Falar dos pais nem sempre é fácil. Obrigada por compartilhar isso comigo."
  },
  
  3: {
    title: "Família Estendida",
    theme: "Origens",
    opening: "Você já me apresentou seus pais. Hoje quero conhecer o resto da família - irmãos, avós, tios.",
    questions: [
      {
        main: "Você tem irmãos? Me conta sobre cada um.",
        followups: ["Quem era mais parecido com você?", "Vocês brigavam muito?", "Como é a relação hoje?"]
      },
      {
        main: "Me fala dos seus avós. Quais você conheceu?",
        followups: ["Como era a casa deles?", "Eles contavam histórias do passado?"]
      },
      {
        main: "Como eram os encontros de família?",
        followups: ["Onde aconteciam?", "O que você mais gostava nesses encontros?"]
      }
    ],
    closing: "A família é um sistema complexo que nos forma profundamente. Obrigada por me deixar conhecer a sua."
  },
  
  4: {
    title: "Infância Fora de Casa",
    theme: "Origens",
    opening: "Nas últimas sessões ficamos dentro de casa. Hoje vamos sair pra rua, pra escola, pro mundo.",
    questions: [
      {
        main: "Me leva pra sua primeira escola. Como era?",
        followups: ["Você gostava de ir?", "Tinha algum professor que marcou?", "O que você era na escola?"]
      },
      {
        main: "Quem foi seu primeiro melhor amigo?",
        followups: ["Como vocês se conheceram?", "O que vocês faziam juntos?"]
      },
      {
        main: "Teve algum momento na infância que você se sentiu muito sozinho?",
        followups: ["O que causou isso?", "Como você lidou?"]
      }
    ],
    closing: "A infância termina quando a gente percebe que o mundo é maior do que parecia."
  },
  
  5: {
    title: "Adolescência",
    theme: "Formação",
    opening: "Vamos entrar num território mais turbulento - a adolescência. Tenta voltar pra pessoa que você era entre os 12 e 18 anos.",
    questions: [
      {
        main: "Quando você sentiu que deixou de ser criança?",
        followups: ["Foi um momento específico?", "O que mudou em você?"]
      },
      {
        main: "Me conta sobre seu primeiro amor ou paixão forte.",
        followups: ["Como você conheceu essa pessoa?", "O que você aprendeu sobre amor?"]
      },
      {
        main: "Você fez alguma coisa na adolescência que se arrepende?",
        followups: ["Você se perdoou?"]
      },
      {
        main: "Quem você queria ser quando crescesse nessa época?",
        followups: ["O que aconteceu com esse sonho?"]
      }
    ],
    closing: "A adolescência é quando a gente começa a escrever nossa própria história."
  },
  
  6: {
    title: "Juventude e Trabalho",
    theme: "Formação",
    opening: "Hoje vamos falar sobre quando você começou a trocar seu tempo por dinheiro e descobrir a vida adulta.",
    questions: [
      {
        main: "Qual foi seu primeiro trabalho de verdade?",
        followups: ["Como você conseguiu?", "O que você aprendeu nele?", "Quanto você ganhava?"]
      },
      {
        main: "Quando você saiu de casa pela primeira vez?",
        followups: ["Foi escolha ou necessidade?", "Como foi a primeira noite sozinho?"]
      },
      {
        main: "Como você escolheu sua carreira?",
        followups: ["Foi vocação ou oportunidade?", "Você mudaria essa escolha?"]
      }
    ],
    closing: "Esses anos de formação são quando a gente descobre do que é feito."
  },
  
  7: {
    title: "Amor e Relacionamentos",
    theme: "Formação",
    opening: "Hoje vamos falar sobre amor. Os relacionamentos que te formaram, machucaram e fizeram crescer.",
    questions: [
      {
        main: "Me conta como você conheceu seu grande amor.",
        followups: ["O que te atraiu primeiro?", "Quando você soube que era sério?"]
      },
      {
        main: "Qual foi o momento mais difícil do relacionamento de vocês?",
        followups: ["Como vocês superaram?"]
      },
      {
        main: "E o momento mais bonito?",
        followups: ["Vocês ainda falam sobre isso?"]
      },
      {
        main: "Se pudesse dar um conselho sobre amor, qual seria?",
        followups: []
      }
    ],
    closing: "Amor é o tema sobre o qual mais mentimos pra nós mesmos. Obrigada pela honestidade."
  },
  
  8: {
    title: "Filhos",
    theme: "Formação",
    opening: "Hoje vamos falar sobre ter filhos - uma das experiências mais transformadoras que existe.",
    questions: [
      {
        main: "Você sempre quis ter filhos?",
        followups: ["A realidade correspondeu à expectativa?"]
      },
      {
        main: "Me conta sobre o nascimento de cada filho.",
        followups: ["O que você sentiu quando viu pela primeira vez?"]
      },
      {
        main: "Como você descreveria cada um dos seus filhos?",
        followups: ["O que cada um herdou de você?", "Qual seu maior orgulho de cada um?"]
      },
      {
        main: "Qual foi o momento mais difícil como pai ou mãe?",
        followups: []
      },
      {
        main: "O que você mais quer que seus filhos lembrem sobre você?",
        followups: []
      }
    ],
    closing: "Criar filhos é se imortalizar de um jeito. Obrigada por compartilhar."
  },
  
  9: {
    title: "Carreira",
    theme: "Realizações",
    opening: "Hoje quero entender sua trajetória profissional completa - as subidas, descidas e o que você aprendeu.",
    questions: [
      {
        main: "Olhando sua carreira de cima, como você descreveria a trajetória?",
        followups: ["Foi mais planejada ou aconteceu?", "Teve momentos de sorte?"]
      },
      {
        main: "Qual foi sua maior conquista profissional?",
        followups: ["O que você teve que fazer pra chegar lá?"]
      },
      {
        main: "E seu maior fracasso profissional?",
        followups: ["O que você aprendeu?"]
      },
      {
        main: "Quem foram seus mentores?",
        followups: ["O que cada um te ensinou?"]
      }
    ],
    closing: "Carreira é como a gente troca nosso tempo por sustento e significado."
  },
  
  10: {
    title: "Dinheiro",
    theme: "Realizações",
    opening: "Dinheiro é um dos temas sobre os quais as pessoas menos falam com honestidade. Hoje quero entender sua relação real com ele.",
    questions: [
      {
        main: "Como era a situação financeira da sua família quando você era criança?",
        followups: ["Você percebia se era rico ou pobre?", "O que você aprendeu sobre dinheiro em casa?"]
      },
      {
        main: "Você já passou aperto financeiro sério?",
        followups: ["Como você saiu?", "Isso mudou sua relação com dinheiro?"]
      },
      {
        main: "Qual foi a melhor decisão financeira que você já tomou?",
        followups: []
      },
      {
        main: "O que você quer que seus filhos entendam sobre dinheiro?",
        followups: []
      }
    ],
    closing: "Dinheiro é um espelho - reflete nossos valores e medos."
  },
  
  11: {
    title: "Filosofia de Vida",
    theme: "Realizações",
    opening: "Hoje vamos falar sobre as grandes questões - fé, significado, o que importa de verdade.",
    questions: [
      {
        main: "Você foi criado com alguma religião?",
        followups: ["Isso mudou ao longo da vida?", "O que você manteve?"]
      },
      {
        main: "Você acredita em Deus ou em algo maior?",
        followups: ["Como você imagina isso?"]
      },
      {
        main: "Quais são os valores não-negociáveis pra você?",
        followups: ["De onde vieram esses valores?"]
      },
      {
        main: "O que dá significado à sua vida?",
        followups: []
      },
      {
        main: "Se tivesse que resumir sua filosofia de vida em uma frase, qual seria?",
        followups: []
      }
    ],
    closing: "Essas são perguntas que não têm resposta final - a gente passa a vida refinando."
  },
  
  12: {
    title: "Amizades",
    theme: "Realizações",
    opening: "Família a gente não escolhe, mas amigos sim. Hoje quero conhecer as pessoas que você escolheu.",
    questions: [
      {
        main: "Quem é seu amigo mais antigo que ainda está na sua vida?",
        followups: ["O que manteve a amizade viva?", "Vocês já brigaram sério?"]
      },
      {
        main: "Você já perdeu uma amizade importante?",
        followups: ["O que aconteceu?", "Ainda pensa nessa pessoa?"]
      },
      {
        main: "Teve algum amigo que te salvou num momento difícil?",
        followups: ["O que essa pessoa fez?"]
      },
      {
        main: "O que você procura numa amizade?",
        followups: []
      }
    ],
    closing: "Amigos são a família que a gente monta."
  },
  
  13: {
    title: "Arrependimentos",
    theme: "Reflexões",
    opening: "Essa sessão pode ser mais difícil. Vamos falar sobre arrependimentos - não pra se torturar, mas pra honrar as lições.",
    questions: [
      {
        main: "Se pudesse voltar e mudar uma decisão na vida, qual seria?",
        followups: ["O que você faria diferente?", "Você se perdoou?"]
      },
      {
        main: "Tem alguém que você magoou e nunca pediu desculpas?",
        followups: ["O que você diria se pudesse falar agora?"]
      },
      {
        main: "Você deixou de fazer algo por medo e se arrepende?",
        followups: ["Do que você tinha medo?"]
      }
    ],
    closing: "Arrependimentos são professores cruéis mas eficientes."
  },
  
  14: {
    title: "Orgulhos",
    theme: "Reflexões",
    opening: "Depois de falar de arrependimentos, hoje é dia de celebrar. Quero ouvir sobre o que te enche de orgulho.",
    questions: [
      {
        main: "Qual é a conquista da sua vida que mais te orgulha?",
        followups: ["O que você teve que superar?", "Quem estava com você?"]
      },
      {
        main: "Tem alguma coisa pequena que te orgulha mas ninguém dá valor?",
        followups: []
      },
      {
        main: "Você se orgulha de quem você se tornou como pessoa?",
        followups: ["O que o seu eu jovem acharia de você hoje?"]
      },
      {
        main: "Se no seu funeral as pessoas pudessem dizer só uma coisa sobre você, o que você queria que fosse?",
        followups: []
      }
    ],
    closing: "Orgulho saudável não é arrogância - é reconhecer que você fez coisas difíceis."
  },
  
  15: {
    title: "Perdas",
    theme: "Reflexões",
    opening: "Essa é uma das sessões mais difíceis, mas também mais importantes. Vamos falar sobre as pessoas que você perdeu.",
    questions: [
      {
        main: "Qual foi a perda mais difícil que você já enfrentou?",
        followups: ["Como você ficou sabendo?", "Você conseguiu se despedir?"]
      },
      {
        main: "Me conta sobre essa pessoa - como ela era?",
        followups: ["O que você mais admirava nela?"]
      },
      {
        main: "O que você gostaria de ter dito que não disse?",
        followups: []
      },
      {
        main: "Essa perda mudou você de alguma forma?",
        followups: []
      }
    ],
    closing: "As pessoas que perdemos continuam vivendo em nós."
  },
  
  16: {
    title: "Sabedoria",
    theme: "Reflexões",
    opening: "Você viveu décadas, enfrentou desafios, errou, acertou. Hoje quero colher a sabedoria que você acumulou.",
    questions: [
      {
        main: "Se pudesse voltar aos 20 anos sabendo o que sabe hoje, quais seriam os 3 conselhos mais importantes?",
        followups: []
      },
      {
        main: "Qual é o erro mais comum que você vê as pessoas cometendo?",
        followups: []
      },
      {
        main: "O que você aprendeu sobre felicidade?",
        followups: []
      },
      {
        main: "O que você aprendeu sobre sofrimento?",
        followups: []
      },
      {
        main: "O que você gostaria que seus bisnetos soubessem sobre você?",
        followups: []
      }
    ],
    closing: "Sabedoria não é saber todas as respostas - é saber quais perguntas importam."
  },
  
  17: {
    title: "Mensagens para Filhos",
    theme: "Mensagens",
    opening: "Nas próximas sessões vamos preparar mensagens diretas para as pessoas mais importantes. Hoje, seus filhos.",
    questions: [
      {
        main: "O que você quer que seu filho saiba sobre o quanto você o ama?",
        followups: ["O que você admira especificamente nele?"]
      },
      {
        main: "Que conselho você daria pra ele no dia do casamento?",
        followups: []
      },
      {
        main: "E no dia que ele virar pai ou mãe?",
        followups: []
      },
      {
        main: "Se ele estiver passando pelo momento mais difícil da vida, o que você quer que ele lembre?",
        followups: []
      },
      {
        main: "Tem algo que você nunca disse pra ele que gostaria de dizer agora?",
        followups: []
      }
    ],
    closing: "Essas palavras vão estar lá quando você não puder estar."
  },
  
  18: {
    title: "Mensagens para Cônjuge e Família",
    theme: "Mensagens",
    opening: "Hoje vamos criar mensagens para seu parceiro de vida e outros familiares importantes.",
    questions: [
      {
        main: "Se pudesse escrever uma carta de amor definitiva pro seu parceiro, o que diria?",
        followups: ["O que você mais agradece nele?"]
      },
      {
        main: "Se ele estiver sozinho depois de você, o que você quer que ele faça?",
        followups: []
      },
      {
        main: "Tem algo que você quer pedir perdão?",
        followups: []
      },
      {
        main: "E seus netos - o que você quer que eles saibam sobre você?",
        followups: []
      }
    ],
    closing: "Família é complicado - é amor e ferida ao mesmo tempo. Essas mensagens deixam tudo mais limpo."
  },
  
  19: {
    title: "Mensagens para Amigos",
    theme: "Mensagens",
    opening: "Hoje vamos falar com pessoas de fora do círculo familiar que marcaram sua vida.",
    questions: [
      {
        main: "Tem algum amigo que você quer deixar uma mensagem especial?",
        followups: ["O que essa amizade significou?"]
      },
      {
        main: "Teve algum mentor que mudou sua vida?",
        followups: ["Ele sabe o impacto que teve?"]
      },
      {
        main: "Tem alguém que você magoou e quer pedir perdão?",
        followups: []
      },
      {
        main: "E alguém que te magoou que você quer perdoar?",
        followups: []
      }
    ],
    closing: "As pessoas que cruzam nossa vida deixam marcas - algumas sabem, outras não."
  },
  
  20: {
    title: "Encerramento",
    theme: "Mensagens",
    opening: "Chegamos à última sessão. Passamos juntos por toda sua vida. Hoje é dia de revisar e fechar com dignidade.",
    questions: [
      {
        main: "Olhando pra trás nessas 20 sessões, o que te surpreendeu sobre você mesmo?",
        followups: []
      },
      {
        main: "Tem alguma história importante que a gente não contou?",
        followups: []
      },
      {
        main: "Como você quer ser lembrado?",
        followups: []
      },
      {
        main: "Se pudesse dizer uma última coisa pro mundo, qual seria?",
        followups: []
      },
      {
        main: "Como você está se sentindo agora, no final desse processo?",
        followups: []
      }
    ],
    closing: "Foi uma honra caminhar pela sua vida com você. O que você construiu aqui vai durar. Obrigada por existir e compartilhar sua existência comigo."
  }
};

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

function getSessionScript(sessionNumber) {
  return SESSION_SCRIPTS[sessionNumber] || SESSION_SCRIPTS[1];
}

async function getPreviousContext(clientId, currentSessionNumber) {
  if (currentSessionNumber === 1) {
    return "Esta é a primeira sessão. Não há histórico anterior.";
  }
  
  const { data: extractions } = await supabase
    .from('extractions')
    .select('*')
    .eq('client_id', clientId)
    .gte('importance', 6)
    .order('created_at', { ascending: false })
    .limit(15);
  
  if (!extractions || extractions.length === 0) {
    return "Sessões anteriores em processamento.";
  }
  
  const byCategory = {};
  extractions.forEach(e => {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e.content);
  });
  
  let context = "";
  if (byCategory.story) context += `\nHISTÓRIAS: ${byCategory.story.slice(0,3).join('; ')}`;
  if (byCategory.value) context += `\nVALORES: ${byCategory.value.slice(0,2).join('; ')}`;
  if (byCategory.relationship) context += `\nPESSOAS: ${byCategory.relationship.slice(0,3).join('; ')}`;
  if (byCategory.expression) context += `\nEXPRESSÕES: ${byCategory.expression.slice(0,3).join('; ')}`;
  
  return context || "Histórico sendo processado.";
}

async function processTranscriptForInsights(sessionId, transcript) {
  const fullTranscript = transcript
    .map(t => `${t.role === 'assistant' ? 'Memória' : 'Cliente'}: ${t.text}`)
    .join('\n');
  
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: `
Analise esta transcrição de entrevista e extraia elementos importantes.

TRANSCRIÇÃO:
${fullTranscript}

Retorne APENAS JSON válido (sem markdown):
{
  "stories": [{"content": "resumo", "importance": 1-10}],
  "expressions": [{"content": "expressão", "importance": 1-10}],
  "values": [{"content": "valor", "importance": 1-10}],
  "emotions": [{"content": "momento", "importance": 1-10}],
  "relationships": [{"content": "pessoa e contexto", "importance": 1-10}],
  "advice": [{"content": "conselho", "importance": 1-10}]
}

Seja criterioso - extraia apenas o significativo.`
      }]
    });
    
    const jsonText = response.content[0].text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const insights = JSON.parse(jsonText);
    
    const { data: session } = await supabase
      .from('sessions')
      .select('client_id')
      .eq('id', sessionId)
      .single();
    
    for (const category of Object.keys(insights)) {
      for (const item of insights[category]) {
        if (item.content && item.importance) {
          await supabase.from('extractions').insert({
            client_id: session.client_id,
            session_id: sessionId,
            category: category.replace(/s$/, ''),
            content: item.content,
            importance: item.importance
          });
        }
      }
    }
    
    console.log(`Insights extraídos para sessão ${sessionId}`);
  } catch (error) {
    console.error('Erro ao processar insights:', error);
  }
}

// =============================================================================
// WEBHOOK DO VAPI
// =============================================================================

app.post('/api/vapi-webhook', async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'No message' });
  }
  
  console.log('Webhook recebido:', message.type);
  
  switch (message.type) {
    case 'assistant-request': {
      // Configurar assistente dinamicamente
      const { call } = message;
      const metadata = call?.metadata || {};
      
      if (!metadata.session_id) {
        return res.json({
          assistant: {
            model: { provider: "anthropic", model: "claude-sonnet-4-20250514", systemPrompt: BASE_SYSTEM_PROMPT },
            voice: { provider: "11labs", voiceId: "pFZP5JQG7iQjIQuC4Bku" },
            firstMessage: "Olá! Parece que houve um problema com a configuração. Pode tentar novamente?"
          }
        });
      }
      
      const { data: session } = await supabase
        .from('sessions')
        .select('*, clients(*)')
        .eq('id', metadata.session_id)
        .single();
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const script = getSessionScript(session.session_number);
      const previousContext = await getPreviousContext(session.client_id, session.session_number);
      
      const dynamicPrompt = BASE_SYSTEM_PROMPT
        .replace('{{SESSION_CONTEXT}}', `
Nome: ${session.clients.name}
Sessão: ${session.session_number} de 20
Tema: ${script.title} (${script.theme})
        `)
        .replace('{{SESSION_SCRIPT}}', `
ABERTURA: ${script.opening}

PERGUNTAS PRINCIPAIS:
${script.questions.map((q, i) => `${i+1}. ${q.main}\n   Aprofundamentos: ${q.followups.join(', ')}`).join('\n')}

ENCERRAMENTO: ${script.closing}
        `)
        .replace('{{PREVIOUS_CONTEXT}}', previousContext);
      
      const firstMessage = session.session_number === 1
        ? `Olá ${session.clients.name}! Que alegria começar essa jornada com você. Eu sou a Memória, e vou te acompanhar nessas conversas sobre sua vida. Pode ficar tranquilo, isso é uma conversa entre amigas. Como você tá se sentindo hoje?`
        : `Oi ${session.clients.name}! Que bom te encontrar de novo. Como você tá hoje?`;
      
      // Atualizar sessão como em progresso
      await supabase
        .from('sessions')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', session.id);
      
      return res.json({
        assistant: {
          model: {
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
            temperature: 0.7,
            systemPrompt: dynamicPrompt
          },
          voice: {
            provider: "11labs",
            voiceId: "pFZP5JQG7iQjIQuC4Bku",
            stability: 0.6,
            similarityBoost: 0.8
          },
          firstMessage: firstMessage,
          silenceTimeoutSeconds: 45,
          maxDurationSeconds: 3900
        }
      });
    }
    
    case 'transcript': {
      // Salvar transcrição em tempo real
      const { call, transcript, role, transcriptType } = message;
      const metadata = call?.metadata || {};
      
      // Formato novo do Vapi - transcrição individual
      if (transcriptType === 'final' && message.transcript) {
        const sessionId = metadata.session_id || null;
        
        await supabase.from('transcripts').insert({
          session_id: sessionId,
          speaker: role === 'assistant' ? 'agent' : 'client',
          content: message.transcript,
          timestamp_ms: message.timestamp || Date.now()
        });
        
        console.log(`[TRANSCRIPT] ${role}: ${message.transcript.substring(0, 50)}...`);
      }
      
      // Formato antigo - array de utterances
      if (Array.isArray(transcript) && metadata.session_id) {
        for (const utterance of transcript) {
          await supabase.from('transcripts').insert({
            session_id: metadata.session_id,
            speaker: utterance.role === 'assistant' ? 'agent' : 'client',
            content: utterance.text,
            timestamp_ms: utterance.timestamp || Date.now()
          });
        }
      }
      return res.status(200).json({ saved: true });
    }
    
    case 'end-of-call-report': {
      // Processar fim da chamada
      const { call, transcript } = message;
      const metadata = call?.metadata || {};
      
      if (metadata.session_id) {
        await supabase
          .from('sessions')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            duration_minutes: Math.round((call.duration || 0) / 60),
            vapi_call_id: call.id
          })
          .eq('id', metadata.session_id);
        
        if (transcript) {
          await processTranscriptForInsights(metadata.session_id, transcript);
        }
      }
      return res.status(200).json({ processed: true });
    }
    
    default:
      return res.status(200).json({ received: true });
  }
});

// =============================================================================
// ROTAS DA API
// =============================================================================

// Listar clientes
app.get('/api/clients', async (req, res) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name');
  
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Criar cliente
app.post('/api/clients', async (req, res) => {
  const { name, phone, email, birth_date, birth_place, family_contact_name, family_contact_phone } = req.body;
  
  const { data, error } = await supabase
    .from('clients')
    .insert({ name, phone, email, birth_date, birth_place, family_contact_name, family_contact_phone })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Listar sessões de um cliente
app.get('/api/clients/:id/sessions', async (req, res) => {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('client_id', req.params.id)
    .order('session_number');
  
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Gerar link de chamada web
app.post('/api/calls/web', async (req, res) => {
  const { client_id, session_number } = req.body;
  
  // Verificar se cliente existe
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single();
  
  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  
  // Criar sessão
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      client_id,
      session_number,
      status: 'pending'
    })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  
  // Gerar URL do Vapi
  const metadata = encodeURIComponent(JSON.stringify({
    client_id,
    session_id: session.id,
    session_number
  }));
  
  const webCallUrl = `https://vapi.ai/call?assistantId=${process.env.VAPI_ASSISTANT_ID}&metadata=${metadata}`;
  
  return res.json({
    success: true,
    session_id: session.id,
    session_number,
    client_name: client.name,
    web_call_url: webCallUrl
  });
});

// Iniciar chamada telefônica
app.post('/api/calls/phone', async (req, res) => {
  const { client_id, session_number } = req.body;
  
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', client_id)
    .single();
  
  if (!client || !client.phone) {
    return res.status(400).json({ error: 'Cliente sem telefone cadastrado' });
  }
  
  const { data: session } = await supabase
    .from('sessions')
    .insert({
      client_id,
      session_number,
      status: 'pending'
    })
    .select()
    .single();
  
  // Chamar API do Vapi
  const vapiResponse = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: { number: client.phone },
      assistantId: process.env.VAPI_ASSISTANT_ID,
      metadata: {
        client_id,
        session_id: session.id,
        session_number
      }
    })
  });
  
  const call = await vapiResponse.json();
  
  return res.json({
    success: true,
    session_id: session.id,
    call_id: call.id,
    message: `Ligando para ${client.name}...`
  });
});

// Ver transcrição de uma sessão
app.get('/api/sessions/:id/transcript', async (req, res) => {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('session_id', req.params.id)
    .order('timestamp_ms');
  
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// Ver extrações de um cliente
app.get('/api/clients/:id/extractions', async (req, res) => {
  const { data, error } = await supabase
    .from('extractions')
    .select('*')
    .eq('client_id', req.params.id)
    .order('importance', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data);
});

// =============================================================================
// INICIAR SERVIDOR
// =============================================================================

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🌟 ETERNO Server rodando na porta ${PORT}`);
    console.log(`Webhook URL: http://localhost:${PORT}/api/vapi-webhook`);
  });
}

module.exports = app;
