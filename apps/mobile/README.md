# Cliente Flutter — Mobile e Desktop

Cliente Flutter adaptativo conectado à mesma API usada pelo Next.js. Em telas
móveis usa navegação inferior; em desktop usa navegação lateral. A entrega atual
inclui dashboard, indicadores, previsão por horizonte, classificação ABC,
catálogo com busca/filtro, central de alertas e estados de carregamento, vazio e
erro.

## Autenticação

O app exige login antes de consultar o estoque. A aba **Conta** mostra o usuário
real, permite trocar a senha e sair. Cadastro, recuperação e redefinição de senha
usam os mesmos endpoints e regras da API web; não existe senha padrão.

**Manter conectado** salva somente o token e sua validade usando
`flutter_secure_storage`, separado por servidor. Sem essa opção, a sessão fica
somente na memória. Na abertura e ao voltar do segundo plano, `/auth/me` valida
a sessão. Um 401 ou a expiração local remove o acesso às telas privadas. Falha de
rede na restauração mostra uma tela de tentativa novamente, sem liberar o painel.
Logout exige confirmação da API; se a rede falhar, o app informa o erro para
que o usuário tente novamente. Não se confirma revogação que não aconteceu.

Na recuperação, solicite o e-mail e selecione **Já tenho o link de recuperação**.
Cole o link completo e informe a nova senha. A URL colada nunca é acessada: o app
extrai apenas o token e o envia ao servidor já configurado. Abertura automática
por App Links/Universal Links depende do domínio publicado e não foi configurada.
No ambiente local, a mensagem fica em `.local/mail` na raiz do repositório.

Para um celular físico na mesma rede:

```powershell
# Na raiz do projeto:
npm run db:start
npm run dev:api
# Em apps/mobile (substitua pelo IP do computador):
flutter run --dart-define=API_BASE_URL=http://192.168.0.10:3333
flutter build apk --debug --dart-define=API_BASE_URL=http://192.168.0.10:3333
```

O APK padrão usa o endereço do emulador Android; para instalar no celular físico,
compile com o IP acessível. HTTP é permitido apenas no desenvolvimento Android.
Builds release exigem explicitamente `API_BASE_URL=https://...`.
O backup Android foi desabilitado e o Keychain iOS foi configurado para uso no
próprio dispositivo desbloqueado. A integração nativa precisa ser validada em
aparelhos reais, especialmente o iOS que exige macOS/Xcode para compilar.

Validações:

```powershell
flutter analyze
flutter test
flutter build apk --debug
```

Os testes cobrem sessão, armazenamento (adaptador simulado), HTTP, falhas,
expiração, login/logout, formulários, carregamento e layouts com texto ampliado.

```bash
cd apps/mobile
flutter run
flutter run -d windows
```

O endereço padrão da API é `http://10.0.2.2:3333` no emulador Android e
`http://127.0.0.1:3333` nos demais alvos. Para um aparelho físico ou ambiente
remoto, informe um endereço acessível pelo dispositivo:

```bash
flutter run --dart-define=API_BASE_URL=https://api.exemplo.com
```

Plataformas nativas: Android, iOS e Windows. A autenticação usa cookies via cliente
HTTP nativo; o alvo Flutter Web não oferece este fluxo, pois navegadores não
permitem ler `Set-Cookie` nem escrever `Cookie` pelo JavaScript. O cliente Web
oficial é o Next.js, que mantém cookies HttpOnly no navegador.

O código está separado em configuração, tema, domínio, acesso a dados e
apresentação. Os testes de widget usam repositório falso; os testes do repositório
HTTP validam a conversão do contrato da API.

Para gerar o executável Windows, a máquina precisa do Visual Studio com a carga **Desktop development with C++**, MSVC, CMake Tools e Windows SDK. Para Android, também são necessários os command-line tools do SDK e a aceitação das licenças.
