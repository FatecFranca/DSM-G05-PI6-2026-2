# Interface Mobile e Desktop — Flutter

Implementada na mesma branch `feature/dashboard-ux`, compartilhando a paleta
azul-cobalto/azul-marinho, o ícone existente e os princípios visuais do web.

## Entrega

- Temas claro, escuro e automático em dashboard, produtos, alertas e autenticação.
- Seletor de tema no cabeçalho. A preferência é salva no dispositivo;
  falha de armazenamento mantém a escolha na sessão e apresenta uma mensagem.
- Navegação inferior no celular e lateral a partir de 900 px; transição suave
  sem descartar o estado das abas. O sino abre os alertas também no desktop.
- Dashboard com projeções de 7/30/90 dias, curva ABC e indicadores contextualizados.
- Moeda do estoque recebida da API; sem apresentar vendas UCI em reais.
- Avisos sobre base histórica e saldos simulados; não é exibido nível de serviço
  como se fosse uma medição confiável da base.
- Tela Dados com licença, período, contagens de qualidade e SHA-256 expansível.
- Detalhes do produto em painel inferior, com nome completo e valores consultados.
- Skeletons, atualização por gesto, retry e tratamento de respostas atrasadas.
- Temas, troca de abas, skeletons e gráfico respeitam movimento reduzido.

Produtos continuam sendo de **consulta** no aplicativo nativo. Cadastro/importação
e movimentações administrativas permanecem no web; esta entrega visual não
implementa esses formulários no Flutter. Não foram alteradas as regras de login,
os modelos de IA ou as credenciais existentes.

## Executar

Prepare os serviços conforme [Primeira execução](11-primeira-execucao.md).
Na raiz, inicie PostgreSQL e API:

```powershell
npm run db:start
npm run dev:api
```

Em outro terminal, para Windows:

```powershell
npm run desktop
```

Para Android, conecte um aparelho com depuração USB autorizada ou inicie um
emulador no Android Studio. Depois:

```powershell
cd apps/mobile
flutter devices
flutter run -d <id-do-dispositivo>
```

Em modo debug, o emulador Android usa `http://10.0.2.2:3333`. Em aparelho físico,
configure o endereço do computador na mesma rede:

```powershell
flutter run -d <id-do-aparelho> --dart-define=API_BASE_URL=http://<IP-do-computador>:3333
```

Alternativa com aparelho USB: execute `adb reverse tcp:3333 tcp:3333` e use
`--dart-define=API_BASE_URL=http://127.0.0.1:3333`.
Não coloque senhas de banco ou SMTP no aplicativo. Produção exige URL HTTPS.

## Validação

Dentro de `apps/mobile`:

```powershell
flutter analyze
flutter test
flutter build apk --debug
```

O APK de desenvolvimento é gerado em `build/app/outputs/flutter-apk/app-debug.apk`.
Ele não é uma distribuição de produção. Sem URL explícita, usa o endereço de
emulador descrito acima.

Testes cobrem autenticação existente, contrato do repositório, persistência e
concorrência do tema, navegação e layouts em 320, 390 e 1200 px. Em 320 px,
o texto é ampliado em 30% e o movimento reduzido é ativado.

Renderizações opcionais com dados de teste ficam em `build/ux-previews`, fora
do Git. Ajuste o caminho do SDK no comando:

```powershell
flutter test test/dashboard_ux_test.dart --dart-define=CAPTURE_UX=true --dart-define=PREVIEW_FONT_DIR=C:/flutter/bin/cache/artifacts/material_fonts
```

Essas imagens verificam widgets renderizados, não substituem o teste no aparelho
de rede, teclado, áreas seguras e armazenamento seguro nativo.
