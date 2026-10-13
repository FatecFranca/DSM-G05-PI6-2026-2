# Interface e identidade visual

## Escopo

Interface web em Next.js/JavaScript com componentes shadcn/Radix e Recharts.
As páginas autenticadas compartilham navegação, temas e menu da conta. O
layout responsivo atende navegadores em celulares. A adaptação nativa Flutter
está descrita em [Interface Mobile/Desktop](13-interface-flutter.md).

## Identidade

Mantido o ícone existente em `apps/web/src/app/icon.png`, combinado ao
wordmark “Estoque inteligente.”. Tipografia Geist e hierarquia discreta,
com foco em legibilidade de tabelas e valores numéricos.

| Token | Claro | Escuro |
| --- | --- | --- |
| Fundo | `#F6F7FB` | `#0C1220` |
| Superfície | `#FFFFFF` | `#131D2E` |
| Texto | `#172033` | `#EDF2FA` |
| Destaque | `#3157D5` | `#8BA8FF` |
| Texto secundário | `#667085` | `#A4AFC2` |
| Borda | `#E1E6EF` | `#29364B` |

Tokens e estilos compartilhados: `apps/web/src/app/workspace.css`.
Tema claro, escuro ou do sistema, persistido localmente como `estoque-theme`.
Alterações da preferência do sistema e de outras abas são acompanhadas.

## Navegação

- **Visão geral:** indicadores, gráfico de demanda, curva ABC, filtro das
  dez prioridades retornadas pela API e exportação CSV.
- **Produtos:** catálogo, busca, paginação e operações administrativas existentes.
- **Estoque:** saldos, depósitos, movimentações e transferências existentes.
- **Inteligência:** projeções de 7, 30 e 90 dias e interpretação da curva ABC.
- **Qualidade dos dados:** licença, período, critérios de tratamento, contagens,
  identificação SHA-256 e histórico de cargas.
- **Minha conta:** identificação e alteração de senha.

O menu móvel usa Dialog com gerenciamento de foco e fechamento por Escape.
As telas de autenticação recebem os mesmos temas, sem a navegação privada.

## Interações e acessibilidade

Transições suaves de página, feedback de hover/foco, skeletons, indicadores
de carregamento e botões desabilitados durante operações. A preferência
`prefers-reduced-motion` reduz animações. Há link para pular a navegação,
rótulos para botões de ícone e indicação da página/tema selecionados.
Tabelas largas rolam dentro do seu contêiner, sem expandir toda a página.

## Dados sem falsas promessas

As projeções começam após o último dia da base histórica, não na data atual.
Saldos iniciais e custos da demonstração são simulados. Os valores UCI são
exibidos em GBP. As contagens de qualidade podem se sobrepor. A cobertura
sem referência não deve ser interpretada como disponibilidade garantida.
Os modelos existentes são consumidos, não retreinados por esta interface.

CSV exportado tem escape de aspas, BOM UTF-8 e neutralização de fórmulas.
Datas ausentes ou inválidas são exibidas como “Não informado”.

## Execução e validação

Siga primeiro [Primeira execução](11-primeira-execucao.md).

```powershell
npm run db:start
npm run dev
```

Acesse `http://localhost:3000` com sua conta. A autorização de administrador
continua sendo exigida pelo backend para alterar produtos e estoque.

```powershell
npm run lint --workspace=@estoque-inteligente/web
npm run test --workspace=@estoque-inteligente/web
npm run build --workspace=@estoque-inteligente/web
```

Os testes unitários cobrem serialização segura de CSV e datas. O comando
raiz `npm test`, já usado pelo CI, também executa estes testes.
Para conferir visualmente: alternar temas, recarregar, abrir menu móvel,
navegar pelas áreas, alterar horizonte, filtrar produtos e expandir a
identificação da carga. Verificar estados de erro com a API indisponível.
