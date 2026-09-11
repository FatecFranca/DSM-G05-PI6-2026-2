# Cliente Flutter — Mobile e Desktop

Cliente Flutter adaptativo conectado à mesma API usada pelo Next.js. Em telas
móveis usa navegação inferior; em desktop usa navegação lateral. A entrega atual
inclui dashboard, indicadores, previsão por horizonte, classificação ABC,
catálogo com busca/filtro, central de alertas e estados de carregamento, vazio e
erro.

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

Plataformas configuradas: Android, iOS, Web e Windows. O produto final utilizará Android/iOS como Mobile e Windows como Desktop; a compilação Web do Flutter existe para testes, mas o cliente Web oficial do projeto é o Next.js.

O código está separado em configuração, tema, domínio, acesso a dados e
apresentação. Os testes de widget usam repositório falso; os testes do repositório
HTTP validam a conversão do contrato da API.

Para gerar o executável Windows, a máquina precisa do Visual Studio com a carga **Desktop development with C++**, MSVC, CMake Tools e Windows SDK. Para Android, também são necessários os command-line tools do SDK e a aceitação das licenças.
