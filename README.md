# Sistema de Listas de Compras — Microsserviços (Node.js + Express + JSON)

Aplicação distribuída para **gerenciamento de listas de compras** usando **microsserviços**, **API Gateway**, **registro de serviços via arquivo**, **JWT** e **bancos JSON locais**.

## Estrutura do Sistema

**Serviços**
- **Usuários (porta 3001)** — autenticação JWT e gerenciamento de contas
- **Itens (porta 3002)** — catálogo de produtos (com 20 itens de exemplo)
- **Listas (porta 3003)** — CRUD de listas de compras, itens e resumo
- **Gateway (porta 3000)** — ponto de entrada único, roteamento, *circuit breaker* e verificação de saúde

**Registro de Serviços** (`services.registry.json`):
- Registro automático ao iniciar cada serviço
- *Heartbeats* a cada 30 segundos
- Descoberta de serviços por nome com round-robin simples

### Diagrama Simplificado
```text
Cliente → API Gateway:3000
          ├─ /api/auth/*  → Usuários:3001
          ├─ /api/users/* → Usuários:3001 (JWT)
          ├─ /api/items/* → Itens:3002
          └─ /api/lists/* → Listas:3003 (JWT)

Listas → consulta Itens para detalhes ao adicionar itens
