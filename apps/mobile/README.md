# Cliente Flutter — Mobile e Desktop

Estrutura inicial em Flutter com Material 3 e um protótipo adaptativo de consulta aos indicadores e alertas prioritários. Em telas móveis usa navegação inferior; em desktop usa navegação lateral.

```bash
cd apps/mobile
flutter run
flutter run -d windows
```

Plataformas configuradas: Android, iOS, Web e Windows. O produto final utilizará Android/iOS como Mobile e Windows como Desktop; a compilação Web do Flutter existe para testes, mas o cliente Web oficial do projeto é o Next.js.

Os dados são demonstrativos. Nas próximas sprints, telas, cliente HTTP, autenticação e estados serão separados por funcionalidade.

Para gerar o executável Windows, a máquina precisa do Visual Studio com a carga **Desktop development with C++**, MSVC, CMake Tools e Windows SDK. Para Android, também são necessários os command-line tools do SDK e a aceitação das licenças.
