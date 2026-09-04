# Estratégia de testes e TDD

## 1. Objetivo

Desenvolver regras de negócio e integrações com ciclos curtos de feedback, evitando que estoque, classificação, previsão ou mensageria produzam resultados silenciosamente incorretos.

## 2. Ciclo obrigatório

Toda regra nova segue **Vermelho → Verde → Refatorar**:

1. **Vermelho:** escrever um teste pequeno que descreve o comportamento e falha pelo motivo esperado;
2. **Verde:** implementar a solução mínima para o teste passar;
3. **Refatorar:** melhorar nomes, estrutura e duplicações mantendo toda a suíte verde;
4. integrar somente após lint, testes e revisão.

Um teste criado depois da implementação pode aumentar cobertura, mas não comprova TDD. Pull requests de regras devem registrar no histórico commits ou descrição que permitam acompanhar o ciclo.

## 3. Pirâmide de testes

| Camada | Escopo no projeto | Ferramentas planejadas | Frequência |
| --- | --- | --- | --- |
| Unidade | estoque disponível, ABC/XYZ, reposição, transformação e validação | Node Test Runner/Vitest; `flutter_test`; Pytest | a cada alteração |
| Componente | cards, filtros, estados e widgets adaptativos | React Testing Library; `flutter_test` | a cada pull request |
| Integração | API + PostgreSQL; publisher/subscriber + emulador Pub/Sub; pipeline + Storage | Testcontainers/emuladores e Pytest | a cada pull request |
| Contrato | OpenAPI dos clientes e Protobuf dos eventos | validação de esquema e testes de compatibilidade | a cada contrato alterado |
| Ponta a ponta | login, produto, previsão e risco em Web/Mobile/Desktop | Playwright e Flutter integration tests | antes de merge/release |
| Dados/ML | qualidade, ausência de vazamento, baseline e reprodutibilidade | Pytest, backtesting temporal e relatório de métricas | a cada dataset/modelo |

## 4. Casos prioritários

### Domínio de estoque

- estoque disponível desconta a quantidade reservada;
- devoluções e cancelamentos não aumentam demanda válida;
- sugestão nunca é negativa;
- risco considera demanda durante lead time e estoque de segurança;
- arredondamento respeita unidade e lote de compra.

### Classificação e previsão

- soma das classes ABC inclui todos os produtos elegíveis;
- produto no limiar recebe sempre a mesma classe;
- XYZ trata média zero sem divisão inválida;
- atributos em uma data não usam observações futuras;
- WAPE e MAE usam apenas o período de teste;
- promoção de modelo falha quando não supera a baseline definida.

### Sistemas distribuídos

- reentregar o mesmo `message_id` não repete o efeito;
- falha antes do commit não confirma a mensagem;
- falha após o limite envia para DLQ;
- evento da outbox só recebe `published_at` após publicação confirmada;
- versão incompatível de esquema é rejeitada de forma observável;
- `correlation_id` permanece igual da requisição ao último job.

## 5. Testes por plataforma

Uma jornada contratual comum será repetida nos três clientes:

1. consultar lista de produtos;
2. abrir um produto;
3. visualizar estoque e data de atualização;
4. consultar previsão;
5. identificar risco e recomendação.

A API é a fonte do comportamento. Clientes validam apresentação, acessibilidade, navegação, estados de carregamento, vazio e erro, sem duplicar regras de negócio.

## 6. Dados de teste

- fixtures sintéticas pequenas e legíveis ficam no repositório;
- nenhum teste utiliza dado pessoal ou token do Bling;
- relógio e geradores aleatórios são controlados por seed;
- integração usa banco e broker isolados por execução;
- snapshots reais, se autorizados, permanecem fora do Git e são anonimizados;
- datasets de ML recebem versão e hash para reprodução.

## 7. Critério de pronto

Uma história só está pronta quando:

- critérios de aceite possuem testes automatizados adequados;
- lint e testes de unidade/integração afetados passam;
- contrato OpenAPI/Protobuf permanece compatível ou possui migração;
- falhas, logs e métricas relevantes foram considerados;
- documentação muda junto com decisões ou contratos;
- revisão por outro integrante foi concluída.

## 8. Situação atual e próximos testes

| Área | Situação da sprint inicial | Próximo passo |
| --- | --- | --- |
| API | 5 testes de rota com `Fastify.inject` | extrair regras de domínio e testar repositórios PostgreSQL |
| Flutter | teste de renderização e navegação | testar layout móvel/desktop e cliente HTTP |
| Web | lint e build de produção | testes de componente e fluxo de busca/exportação |
| PostgreSQL | restrições no schema | subir banco efêmero e testar migração/índices |
| Mensageria | contratos Protobuf e padrões definidos | emulador Pub/Sub, idempotência, retry e DLQ |
| Mineração | critérios e métricas definidos | testes de qualidade, baseline e vazamento temporal |
