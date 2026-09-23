# Onde estão o Redis e as expressões regulares no Moedin.IA

Levantamento feito em 22/09/2026, lendo o código (não de memória). Os caminhos são relativos à raiz do
repositório. Serve de referência para manutenção e para a parte de técnicas empregadas do TCC.

---

## Parte 1 — Redis

**Um container só** (`redis:7-alpine`) atende a tudo. Não são vários Redis: são conjuntos de chave com
prefixos diferentes. Quem usa: o workflow do agente (9 nós) e a própria Evolution API, como cache dela
(`CACHE_REDIS_ENABLED=true` no `~/stack/docker-compose.yml` do servidor).

Todos os nós de Redis ficam em `n8n/workflow/moedin-agente-v2.json`.

| Chave | Nós | Operação | TTL | Para que serve |
|---|---|---|---|---|
| `moedin:buf:{numero}:{msg_id}` | Buffer: guardar mensagem | `set` | 120 s | guarda cada mensagem da rajada |
| `moedin:last:{numero}` | Buffer: marcar última / ler última | `set` / `get` | 120 s | diz qual foi a última mensagem; só ela segue adiante |
| (os dois acima) | Buffer: ler todas / limpar | `keys` / `delete` | — | junta a rajada numa chamada só e apaga as chaves |
| `moedin:rl:{numero}` | Contar mensagens 10 min | `incr` | 600 s | anti-spam: 20 mensagens por 10 minutos |
| `moedin:day:{numero}` | Contar mensagens do dia | `incr` | 86 400 s | anti-spam: 150 mensagens por dia |
| `moedin:onb:{numero}` | Contar tentativas de ativação | `incr` | 3 600 s | 5 tentativas de código por hora, contra força bruta no vínculo |
| `moedin:mem:{user_id}` | Memória da conversa | nó `memoryRedisChat` | 86 400 s | **memória do agente**: últimas 6 trocas, para entender "muda o último pra 40" |

### O que cada um significa na prática

1. **Agrupar mensagem (debounce).** Quem escreve em três linhas seguidas gera três webhooks. O buffer guarda as
   três, espera 3 segundos e só a última segue, levando o texto das três juntas. Sem isso seriam três chamadas de
   IA e três respostas.
2. **Memória da conversa.** É o que permite frases que dependem do que veio antes. A janela é curta (6 trocas) de
   propósito: memória grande aumenta o custo de cada mensagem.
3. **Anti-spam.** Os contadores rodam **antes** do modelo. Passou do limite, a mensagem não vira chamada de IA —
   é a proteção de custo da conta da OpenAI.
4. **Tentativas de ativação.** Limita quem fica chutando código de vínculo.

### Consequências de uma queda

O bot **não para** sem Redis, mas fica pior: responde mensagem por mensagem (sem agrupar), esquece o contexto
anterior e perde os limites de spam. Um `FLUSHALL` apaga junto a memória das conversas e o cache da Evolution —
se precisar limpar, apague só o prefixo em questão.

---

## Parte 2 — Expressões regulares

Aparecem em quatro papéis bem distintos. Nenhum é decorativo.

### 2.1 No bot — `n8n/workflow/moedin-agente-v2.json`

| Nó | Papel |
|---|---|
| `Rota rápida?` | **Roteamento determinístico.** Responde saudação, ajuda, link do painel, agradecimento e pedido de relatório em PDF **sem chamar a IA**. Também resolve o mês citado ("agosto", "mês passado", virada de ano). |
| `Normalizar payload` | Extrai o número do `remoteJid` (dígitos), identifica o tipo (texto/imagem/áudio/PDF) e descarta grupo, mensagem própria e de sistema. |
| `Interpretar documento` | **Sanitização**: tira caractere de controle e as sequências `[[` e `]]` do texto lido de PDF ou foto, e trunca os campos. |
| `Guarda de saída` | **Filtro de saída**: acha e remove link que não seja do Moedin.IA antes de enviar. |
| `Montar PDF` | Escapar texto, quebrar linha e mapear acento (WinAnsi) no gerador de PDF escrito à mão. |

Antes de comparar qualquer coisa, a rota rápida normaliza o texto: minúscula, sem acento, sem pontuação,
espaço colapsado. Por isso "Olá!!", "ola" e "OLÁ" caem na mesma regra.

**Regra de ouro da rota rápida:** na dúvida, manda para a IA. Ela desiste sozinha se a mensagem veio de
mídia, se passa de 120 caracteres, ou se tem número ou verbo de lançamento junto ("gastei no site" não é
pedido de painel). Ela erra para o lado caro, nunca para o lado errado.

### 2.2 No banco — `supabase/migrations/` (105 usos em 11 arquivos)

| Migration | Usos | Para quê |
|---|---|---|
| `031_whatsapp_categorias.sql` | 37 | normalizar nome de categoria (acento, maiúscula, plural) e escolher o ícone pela palavra: "ração" → `PawPrint`, "viagem" → `Plane` |
| `029_whatsapp_v4_features.sql` | 28 | interpretação de parcelamento, limites e datas |
| `015_phone_identity_hardening.sql` | 13 | **normalização de telefone**: DDD, nono dígito, formato E.164 |
| `005` e `006` | 11 | primeira versão da normalização de telefone e das consultas |
| `008`, `009`, `022`, `025`, `026`, `030` | 16 | consultas, vínculo do WhatsApp e edição de lançamento |

A normalização de telefone é o que garante que o mesmo WhatsApp não vire duas identidades no sistema.

### 2.3 No site — `apps/web/src/`

| Arquivo | Para quê |
|---|---|
| `lib/auth-validation.ts` | valida formato de e-mail antes de gastar requisição no Supabase |
| `lib/auth-errors.ts` | traduz ~12 mensagens de erro do Supabase para o português do produto |
| `lib/formatters.ts` | moeda: tira separador de milhar, aceita vírgula e ponto |
| `lib/whatsapp.ts` | monta o link `wa.me` só com os dígitos do número |
| `app/api/categories/ensure/route.ts` | normaliza nome de categoria (mesma regra do bot, para os dois combinarem) |
| `app/(app)/historico/page.tsx` | busca no histórico e escape de aspas na exportação CSV |
| `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx` | montagem de URL canônica e metadados |

### 2.4 Os quatro papéis, resumidos

1. **Economia de custo** — o roteador da rota rápida evita chamada de IA no que é previsível. Deu mais resultado
   do que trocar de modelo.
2. **Integridade de identidade** — normalização de telefone, para um número não virar duas contas.
3. **Segurança** — sanitização do conteúdo de arquivos e filtro de links na saída: as duas camadas
   determinísticas contra injeção de prompt (ver `n8n/AGENTE-V2.md`, seções 21 a 23).
4. **Validação de entrada** — primeira linha no site, que não substitui a validação do servidor.

**Limite honesto:** expressão regular não entende intenção. É por isso que ela só decide o que é inequívoco, e
todo o resto vai para o modelo.
