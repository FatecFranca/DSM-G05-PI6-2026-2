# Pipeline de dados e mineração

Pipeline reproduzível para a base **Online Retail II**, da UCI Machine Learning
Repository. A fonte possui licença CC BY 4.0 e pode ser usada inclusive em
contexto profissional, desde que a atribuição seja preservada.

```powershell
py -m venv .venv
npm run ml:setup
npm run data:setup
```

O arquivo bruto, os dados processados e os modelos ficam em diretórios ignorados
pelo Git. O banco recebe a linhagem, o hash, as regras de qualidade, as tabelas
operacionais e os resultados versionados dos modelos.

Fonte: Daqing Chen, *Online Retail II*, UCI Machine Learning Repository,
DOI `10.24432/C5CG6D`.
