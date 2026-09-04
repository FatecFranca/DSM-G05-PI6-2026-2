# ADR-001 — Plataforma desktop

- **Status:** aceita
- **Data:** 2026-09-03
- **Revisão:** 2026-09-03, após confirmação dos objetivos acadêmicos
- **Contexto:** a disciplina-chave exige desenvolvimento para Dispositivo Móvel, Web e Desktop. O projeto já utiliza Flutter no cliente móvel e precisa entregar uma aplicação desktop demonstrável.

## Decisão proposta

Usar **Flutter Desktop para Windows**, compartilhando domínio, cliente HTTP, design system e testes com Android/iOS. As telas serão adaptativas: navegação inferior em celular e `NavigationRail`/painéis mais densos em desktop. O Next.js permanece como cliente Web independente.

## Motivos

- atende explicitamente a plataforma desktop com artefato nativo;
- reaproveita conhecimento, componentes e regras do aplicativo móvel;
- Flutter possui suporte oficial para compilar aplicativos Windows, macOS e Linux;
- mantém somente duas bases de interface: Next.js para Web e Flutter para Mobile/Desktop;
- a API independente aplica as mesmas regras e contratos em todos os clientes.

## Gatilhos para reconsiderar

Reavaliar Tauri, Electron ou outra tecnologia apenas se surgir uma integração nativa incompatível com o ecossistema Flutter, ou se a equipe não conseguir atender requisitos de distribuição e atualização do ambiente-alvo.

## Consequências

O diretório `apps/mobile` passa a representar o cliente Flutter multiplataforma e inclui o runner Windows. O grupo precisa testar tamanhos de janela, teclado, mouse, tabela densa e empacotamento, em vez de considerar que o layout móvel é suficiente no desktop.

O custo é aceitar um nome de pasta historicamente voltado ao mobile. Uma renomeação para `apps/client` poderá ocorrer em um PR isolado quando não quebrar scripts e documentação.

## Referência

- [Suporte oficial do Flutter para aplicações desktop](https://docs.flutter.dev/platform-integration/desktop)
