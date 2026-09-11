# Registro das fontes de dados

Os arquivos de dados e artefatos locais não são versionados. Este documento
registra origem, licença, finalidade e integridade para tornar os experimentos
reproduzíveis sem publicar os dados no Git.

## Fonte selecionada para desenvolvimento

| Campo | Valor |
| --- | --- |
| Nome | Retail Sales Data |
| Origem | https://www.kaggle.com/datasets/berkayalan/retail-sales-data |
| Publicador no Kaggle | Berkay Alan |
| Licença declarada | CC0 1.0 — domínio público, inclusive para uso comercial |
| Data de obtenção | 08/09/2026 |
| Local ignorado pelo Git | `data/raw/kaggle/retail-sales-data-cc0/` |
| Arquivo principal | `sales_daily.csv` |
| Observações | 19.454.838 |
| Período informado | 2017–2019 |
| SHA-256 do arquivo principal | `049021871734B9CF2382FEBD09D0397B667B65E367DAB8CCD2874E8165A5384E` |

Arquivos auxiliares:

- `product_hierarchy.csv` — SHA-256
  `BC1FCFBACA3950ECE7663311494EE8284EE2CEC7CE044F3438D58D89D6DFE29F`;
- `store_cities.csv` — SHA-256
  `0687DC36FBD263D1DD980511D29F444A3775D140069061184465CB3AC0137DDB`.

## Política de utilização

- preservar este registro de procedência mesmo quando atribuição não for
  juridicamente exigida;
- não versionar os CSVs, Parquet, credenciais, tokens ou artefatos dos modelos;
- não inferir que o publicador ou a empresa de origem endossa o produto;
- validar qualidade, representatividade e drift antes de qualquer decisão real;
- substituir ou complementar o treinamento com dados autorizados do Bling antes
  de promover um modelo para produção.

CC0 permite copiar, modificar e distribuir os dados, inclusive comercialmente,
mas não oferece garantia sobre qualidade, adequação, marcas, privacidade ou
outros direitos eventualmente aplicáveis.
