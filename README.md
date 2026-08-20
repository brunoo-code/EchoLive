# EchoLive

EchoLive e um aplicativo web para salas privadas de voz, video, compartilhamento de tela e conversa temporaria em `# geral`.

## Requisitos

- Node.js LTS
- npm

## Instalacao

Na raiz do projeto:

```bash
npm install
```

Opcionalmente, crie `server/.env` a partir de `server/.env.example` para ajustar porta, origem do cliente, banco de dados, limite da sala ou servidores ICE.

## Contas e PostgreSQL

O EchoLive pode ser usado sem cadastro como visitante. Para habilitar contas persistentes, configure uma instancia PostgreSQL e a variavel `DATABASE_URL` no servidor. As contas usam UUID, nome de usuario exclusivo sem diferenciar maiusculas de minusculas, nome de exibicao e senha armazenada com hash bcrypt. A sessao usa um cookie HttpOnly de 14 dias; a senha nunca vai para o navegador.

O `username` e a identidade publica unica da conta. Ele aceita de 3 a 24 caracteres ASCII entre letras, numeros e `_`, sem espacos. O valor normalizado em lowercase e protegido por `UNIQUE` no PostgreSQL; `displayName` nao possui `UNIQUE` e pode se repetir entre contas.

Com o servidor parado, aplique as migrações a partir da raiz:

```bash
cd server
npm install
npm run db:migrate
```

Sem `DATABASE_URL`, o servidor inicia normalmente, as salas temporarias continuam funcionando e as rotas de conta respondem que a autenticacao esta indisponivel. O projeto nao usa SQLite como fallback.

No Render, crie um PostgreSQL, copie a `DATABASE_URL` para as variaveis do Web Service e execute `npm run db:migrate` uma vez usando o mesmo ambiente. Depois mantenha `npm run build` como Build Command e `npm start` como Start Command.

As rotas de conta sao `GET /api/auth/me`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` e `PATCH /api/users/me`. Esta etapa nao inclui recuperacao de senha, email, amigos, mensagens diretas, servidores persistentes ou canais persistentes.

## Desenvolvimento

Para iniciar frontend e backend juntos:

```bash
npm run dev
```

Tambem e possivel rodar separadamente:

```bash
cd server
npm install
npm run dev
```

```bash
cd client
npm install
npm run dev
```

## Acesso

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

## Salas personalizadas

Na home, informe um codigo de 3 a 16 caracteres usando letras, numeros, `-` ou `_`. O codigo e normalizado para maiusculas e aparece na URL, por exemplo `http://localhost:5173/room/666`. O nome visual da sala e opcional e tem limite de 32 caracteres; quando omitido, a interface usa `Sala <codigo>`.

O backend rejeita codigos duplicados e nao cria uma sala automaticamente quando alguem tenta entrar em um codigo inexistente.

Exemplos neutros:

- Nome da sala: `Minha sala` | Codigo: `SALA01`
- Nome da sala: `Reuniao` | Codigo: `REUNIAO`
- Nome da sala: `Estudos` | Codigo: `ESTUDOS`

## Teste com duas abas

1. Abra http://localhost:5173 em uma aba normal.
2. Digite um nickname e clique em `Criar sala`.
3. Copie o convite na sidebar da sala.
4. Abra uma aba anonima ou outro navegador.
5. Cole o convite.
6. Digite outro nickname.
7. Teste microfone, camera, volume remoto, tela cheia e compartilhamento de tela.
8. Use `Alterar nick` para confirmar a atualizacao em tempo real.
9. Saia da sala e confirme que o participante desaparece da outra aba.
10. Alterne entre `# geral` e `Geral`; trocar de canal e apenas visual e nao encerra a call.
11. Envie texto no chat e confirme que a outra aba recebe a mensagem.
12. Anexe uma imagem ou video aceito e confirme o preview no chat.

## Teste em outro computador na mesma rede

Em `localhost`, cada computador aponta para ele mesmo. Para testar na rede local, rode o projeto em um computador e acesse pelo IP local dele no outro:

```text
http://192.168.1.20:5173
```

O backend tambem precisa estar acessivel nessa rede. Ajuste `CLIENT_ORIGIN` no servidor e `VITE_SERVER_URL` no cliente se for usar um host diferente de `localhost`.

## Limite de participantes

O limite padrao e 10 participantes por sala:

```env
MAX_PARTICIPANTS_PER_ROOM=10
```

Esse valor fica em `server/.env`. Se a variavel nao existir, o backend usa 10.

EchoLive usa WebRTC em arquitetura mesh. Isso e simples e bom para poucas pessoas, mas o custo cresce conforme mais participantes entram, porque cada navegador conversa diretamente com os outros. Para salas muito grandes no futuro, o ideal seria uma SFU. Esta versao nao implementa SFU.

## WebRTC

- Signaling: Socket.IO coordena entrada, saida, offers, answers e ICE candidates.
- STUN: ajuda os navegadores a descobrirem enderecos publicos.
- TURN: retransmite midia quando conexao direta nao funciona.
- ICE: escolhe o melhor caminho de conexao entre os participantes.

Socket.IO nao transporta audio, video ou tela. A midia passa por WebRTC.

## Internet, TURN e HTTPS

STUN sozinho nao garante conexao confiavel pela internet. Algumas redes, NATs e firewalls exigem TURN.

Configure TURN em `server/.env`:

```env
TURN_URL=turn:seu-servidor-turn:3478
TURN_USERNAME=
TURN_CREDENTIAL=
```

Nao coloque credenciais reais no codigo.

Fora de `localhost`, `getUserMedia` e `getDisplayMedia` normalmente exigem HTTPS. Uma implantacao publica deve usar HTTPS.

## Supressao de ruido

O audio usa recursos nativos do navegador quando disponiveis:

- `echoCancellation`
- `noiseSuppression`
- `autoGainControl`

Se algum navegador nao suportar uma constraint, a captura deve continuar funcionando com o melhor suporte disponivel.

Essa reducao usa recursos nativos do navegador e pode reduzir ruido de teclado, ventilador e ambiente, mas nao e uma solucao avancada como Krisp ou Discord. Mutar/desmutar apenas alterna `enabled` na track local e nao recria a captura de audio.

## Voz e dispositivos

- A presenca online e a presenca na voz sao listas separadas por sala.
- `Sair voz` encerra apenas a midia e as conexoes WebRTC; o usuario continua online e pode usar o chat.
- `Entrar voz` recria a captura e reconecta a voz sem duplicar o participante.
- O indicador de fala usa um analisador local do navegador e transmite somente um estado booleano.
- Microfone, saida de audio e camera podem ser escolhidos no menu de dispositivos; as preferencias ficam em `localStorage`. A saida usa `setSinkId` quando o navegador oferece suporte e cai no dispositivo padrao caso contrario.
- O avatar local aceita PNG, JPG ou WEBP de ate 1 MB e tambem fica somente no navegador.

## Chat e uploads temporarios

- Salas Rapidas permanecem reentraveis por 5 horas; depois desse prazo o backend expira a sala e novos acessos sao recusados.
- `# geral` e o canal de texto padrao da sala.
- Mensagens sao transmitidas por Socket.IO e ficam somente em memoria.
- Cada sala mantem no maximo 200 mensagens; ao ficar vazia, o historico e apagado.
- O chat aceita texto de ate 4.000 caracteres.
- Imagens aceitas: PNG, JPEG, WebP e GIF.
- Videos aceitos: MP4, WebM e MOV/QuickTime.
- Limites por tipo: imagens ate 15 MB, videos ate 50 MB e outros arquivos ate 25 MB.
- Uploads ficam localmente em `server/uploads` e sao servidos por `/uploads/...`.
- O backend gera nomes aleatorios; o nome original e usado apenas para exibicao.
- Salas, mensagens e uploads continuam temporarios; o PostgreSQL e usado apenas para contas e sessoes quando `DATABASE_URL` esta configurada.

## Scripts

```bash
npm run dev
npm run build
npm start
```

## Deploy em um unico servico

O backend Express serve `client/dist` quando essa pasta existe. Assim, o mesmo Web Service hospeda o frontend, a API, os uploads e o Socket.IO. Em desenvolvimento, o Vite continua em `5173` e o servidor em `3001`.

Configuracao para Render Web Service com a raiz do repositorio:

```text
Root Directory: (vazio)
Build Command: npm run build
Start Command: npm start
Environment Variables: nenhuma obrigatoria
```

O servidor usa `process.env.PORT` e escuta em `0.0.0.0`. O cliente usa o backend local em `localhost:3001` durante o Vite e o proprio dominio quando publicado. Links de sala usam `window.location.origin`, portanto continuam validos no dominio HTTPS do Render e ao atualizar `/room/<codigo>`.

Para publicar no GitHub a partir da raiz:

```bash
git init
git add .
git commit -m "Prepare EchoLive for Render"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

No Render, crie `New > Web Service`, conecte o repositorio, escolha o plano Free, deixe `Root Directory` vazio e use os comandos acima. O Render fornecera a URL HTTPS. O plano Free pode suspender o servico quando ocioso, e o primeiro acesso depois disso pode demorar.

## Limitacoes atuais

- Salas e mensagens ficam apenas em memoria; contas e sessoes podem ser persistentes no PostgreSQL.
- Mensagens sao temporarias; os uploads ficam no disco local e devem ser limpos manualmente em uma rotina futura.
- Sem `DATABASE_URL`, o modo visitante funciona sem contas, senhas ou banco configurado.
- Nicknames podem ser repetidos; o identificador real e `socket.id`.
- Compartilhamento de tela substitui temporariamente a camera enviada aos outros participantes.
- Audio do compartilhamento de tela nao e obrigatorio nesta versao.
- WebRTC mesh e indicado para salas pequenas; para muitas pessoas, considere SFU em etapa futura.

## Proximos passos sugeridos

- Avaliar canais persistentes, amigos e mensagens diretas em uma etapa futura.
