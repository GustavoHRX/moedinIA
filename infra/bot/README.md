# Colocar o bot do Moedin.IA no ar sem depender do Mac

Hoje o assistente do WhatsApp só existe enquanto o seu MacBook está ligado com o
Docker rodando. Quem fecha o notebook desliga o bot. Este diretório resolve isso.

O painel continua na Vercel e o banco no Supabase. O que muda de casa são
**quatro containers**: n8n, Evolution API, Redis e o Postgres da Evolution.
Juntos consomem cerca de 1 GB de memória e quase nada de CPU.

---

## 1. O servidor

**Caminho escolhido (10/09/2026): Oracle Cloud, camada gratuita.** Veja a seção
1b logo abaixo, que tem os detalhes só dela. Se a Oracle travar no cadastro ou
na falta de capacidade, os planos B estão no fim desta seção.

O que a máquina precisa ter, em qualquer provedor: **2 vCPU, 4 GB de RAM
(6 GB na Oracle, pelo motivo explicado em 1b), 40 GB de disco, Ubuntu 24.04**.

Planos B, em ordem:

- **VPS paga.** Hostinger (paga com Pix, tudo em português) por volta de 40
  reais por mês; Hetzner sai por uns 30, mas exige cartão internacional.
- **Um computador velho ligado em casa.** De graça. Como o bot não precisa de
  nenhuma porta aberta, não há redirecionamento de porta, IP fixo nem DDNS para
  configurar — só ligar na tomada e no wi-fi.
- **O próprio Mac sem dormir.** Zero migração. Serve até a entrega do TCC.

**Criar a conta é com você.** Eu não crio contas nem uso cartão.

## 1b. Se for pela Oracle Cloud (a opção gratuita)

A camada *Always Free* da Oracle dá uma máquina ARM que roda o Moedin e ainda
sobra. É de graça para sempre, não é teste de 12 meses. Três detalhes dela que
não existem em provedor pago:

**Escolha o tamanho com cuidado: 2 OCPU e 6 GB, não os 24 GB.**
Parece contra-intuitivo pedir menos de graça, mas a Oracle recupera máquinas
*Always Free* ociosas. O critério é ficar, por sete dias, abaixo de 20% de CPU,
de rede **e** de memória ao mesmo tempo. Um bot de WhatsApp vive ocioso em CPU,
então a memória é o que te salva: com 6 GB, o consumo de ~1,5 GB fica em torno
de 25% e você sai da mira. Com 24 GB, ficaria em 6% e a máquina viraria
candidata a ser recolhida. (Contas convertidas para *Pay As You Go* não sofrem
recuperação e mantêm o free grátis, se preferir esse caminho.)

**A imagem é ARM.** Peça **Ubuntu 24.04 (aarch64)** na forma
`VM.Standard.A1.Flex`. Isso é bom: seu Mac também é ARM, então as imagens Docker
são exatamente as mesmas.

**Não precisa mexer no firewall.** As imagens da Oracle sobem com tudo fechado
menos o SSH, e é exatamente o que este projeto quer: o bot só faz conexões de
saída. Em provedor pago você teria que lembrar de fechar; aqui já vem fechado.

**O erro que trava todo mundo:** "Out of capacity" ao criar a máquina ARM. É
falta de estoque, não erro seu. Tente outro *Availability Domain*, tente em
outro horário, ou escolha a região de Vinhedo em vez de São Paulo. Latência não
importa para este bot.

**Guarde a chave SSH** que a Oracle manda baixar na hora da criação. Ela não é
mostrada de novo, e sem ela você não entra na máquina.

## 2. Instalar o Docker no servidor

Conectado por SSH, uma vez só:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Saia e entre de novo no SSH para o grupo valer. Confira com `docker ps`.

## 3. Empacotar aqui no Mac

Na raiz do projeto:

```bash
bash infra/bot/empacotar.sh
```

Ele para o n8n, copia o banco dele, exporta a base da Evolution, monta um `.env`
só com as chaves que o bot usa, religa o n8n e devolve um
`~/moedin-bot-AAAAMMDD-HHMM.tar.gz`.

Dois cuidados que o script toma sozinho, e que dariam trabalho se fossem
esquecidos:

- **Para o n8n antes de copiar.** O SQLite dele corrompe se for copiado enquanto
  está sendo escrito. Foi assim que o banco quebrou em 08/09/2026.
- **Exporta o Postgres com `pg_dump` em vez de copiar a pasta.** Pasta de dados
  do Postgres não é portátil entre arquiteturas nem sempre entre versões; um
  dump é. Vale mesmo indo de ARM para ARM, como Mac para Oracle.

## 4. Enviar e subir

```bash
scp ~/moedin-bot-*.tar.gz usuario@SEU_SERVIDOR:~/
ssh usuario@SEU_SERVIDOR
tar -xzf moedin-bot-*.tar.gz && cd moedin-bot && bash restaurar.sh
```

O `restaurar.sh` sobe o banco, restaura o dump, sobe Evolution e n8n e mostra o
estado da conexão do WhatsApp no fim.

**A sessão do WhatsApp vem junto no dump**, então na maioria das vezes não é
preciso ler o QR de novo. Se o status aparecer como `close` ou `connecting`, o
próprio script mostra o comando para gerar um QR novo.

## 5. Apontar o webhook (uma vez)

O último passo, que o script imprime pronto para colar: dizer à Evolution que os
eventos vão para o n8n. O endereço é `http://n8n:5678/webhook/moedin-agente`,
nome interno da rede do Docker. Não use `localhost` ali, porque de dentro do
container da Evolution `localhost` é ela mesma.

O caminho `moedin-agente` é fixo dos dois lados. Se mudar, nenhuma mensagem
chega e a Evolution bate num 404 em silêncio.

## 6. Testar

Mande "oi" para o número do assistente pelo celular. Depois "gastei 10 no café" e
confira se aparece no painel. Se responder, acabou: pode fechar o Mac.

Antes de dar por encerrado, **desligue os containers locais** para os dois não
disputarem a mesma sessão do WhatsApp:

```bash
docker compose stop n8n evolution evolution_db redis
```

Duas instâncias da Evolution com a mesma sessão brigam entre si e derrubam a
conexão.

---

## Depois que estiver no ar

**Nenhuma porta fica aberta para a internet**, de propósito. O bot não precisa:
a Evolution conecta para fora até o WhatsApp, o n8n conecta para fora até o
Supabase e a OpenAI, e a conversa entre os dois é interna. Isso dispensa
domínio, certificado e proxy reverso, e tira o editor do n8n do alcance de
qualquer varredura automática.

Para abrir o editor, faça um túnel a partir do seu computador:

```bash
ssh -L 5678:127.0.0.1:5678 usuario@SEU_SERVIDOR
```

E acesse `http://localhost:5678` no navegador, como se fosse local.

**Para atualizar um workflow depois:** edite pelo editor no túnel e clique em
*Publish*. Salvar sozinho não basta, porque o n8n 2.36 separa rascunho de versão
publicada, e o webhook continua executando a publicada.

**Manutenção:** o compose já liga a limpeza automática do histórico de execuções
(guarda duas semanas). Sem isso o SQLite cresce sem parar num servidor que fica
meses ligado.

## Segurança

- O pacote gerado carrega a service role do Supabase e a chave da OpenAI.
  Apague o `.tar.gz` do Mac e do servidor depois de usar.
- A `N8N_ENCRYPTION_KEY` precisa ser idêntica à daqui. Se mudar, as três
  credenciais salvas no n8n viram lixo ilegível e você refaz na mão.
- O `.env` no servidor fica com permissão 600.
- Vale trocar a chave da OpenAI quando o TCC for entregue, já que ela terá
  circulado entre duas máquinas.
