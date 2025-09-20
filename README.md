# Lista de Compras — Microsserviços (Node.js + Express + JSON)

Sistema distribuído para **gerenciamento de listas de compras** usando **microsserviços**, **API Gateway**, **registro de serviços via arquivo**, **JWT** e **bancos JSON locais**.

---

## Arquitetura

**Serviços:**
- **User Service (3001)** — autenticação JWT e gerenciamento de usuários
- **Item Service (3002)** — catálogo de produtos (20 itens de exemplo)
- **List Service (3003)** — CRUD de listas, itens e resumo
- **API Gateway (3000)** — ponto de entrada, roteamento, *circuit breaker* e health checks

**Service Registry (`services.registry.json`):**
- Registro automático ao iniciar cada serviço
- *Heartbeats* a cada 30 segundos
- Descoberta por nome com round-robin simples

### Diagrama Simplificado
```text
Cliente → API Gateway:3000
          ├─ /api/auth/*  → User Service:3001
          ├─ /api/users/* → User Service:3001 (JWT)
          ├─ /api/items/* → Item Service:3002
          └─ /api/lists/* → List Service:3003 (JWT)

List Service → consulta Item Service para detalhes ao adicionar itens

Requisitos

Node.js 18+

Nenhum banco externo, todos os dados ficam em arquivos JSON

Instalação
npm install

Execução

Serviços podem ser executados separadamente:

npm run start:user     # Usuários 3001
npm run start:item     # Itens 3002
npm run start:list     # Listas 3003
npm run start:gateway  # Gateway 3000


Ou tudo de uma vez:

npm run start:all


Opcional: defina JWT_SECRET para alterar o segredo JWT.

Endpoints
User Service (3001)

POST /auth/register — criar usuário

POST /auth/login — login via identifier (email/username) + password

GET /users/:id — JWT obrigatório (somente o próprio usuário)

PUT /users/:id — JWT obrigatório (atualiza perfil e preferências)

Exemplo de Usuário

{
  "id": "uuid",
  "email": "string",
  "username": "string",
  "password": "hash",
  "firstName": "string",
  "lastName": "string",
  "preferences": { "defaultStore": "string", "currency": "string" },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}

Item Service (3002)

GET /items?category=&name= — lista itens

GET /items/:id — retorna um item

POST /items — JWT obrigatório

PUT /items/:id — JWT obrigatório

GET /categories — lista categorias

GET /search?q= — busca por nome/marca

Seed inicial: 20 itens em Alimentos, Limpeza, Higiene, Bebidas, Padaria
Arquivo: services/item-service/data/items.json

Exemplo de Item

{
  "id": "uuid",
  "name": "string",
  "category": "string",
  "brand": "string",
  "unit": "string",
  "averagePrice": "number",
  "barcode": "string",
  "description": "string",
  "active": true,
  "createdAt": "timestamp"
}

List Service (3003) — JWT

POST /lists — criar lista

GET /lists — listar todas do usuário

GET /lists/:id — buscar lista

PUT /lists/:id — atualizar nome, descrição ou status

DELETE /lists/:id — remover lista

POST /lists/:id/items — adicionar item (consulta Item Service)

PUT /lists/:id/items/:itemId — atualizar item

DELETE /lists/:id/items/:itemId — remover item

GET /lists/:id/summary — resumo automático

Exemplo de Lista

{
  "id": "uuid",
  "userId": "string",
  "name": "string",
  "description": "string",
  "status": "active|completed|archived",
  "items": [
    {
      "itemId": "string",
      "itemName": "string",
      "quantity": "number",
      "unit": "string",
      "estimatedPrice": "number",
      "purchased": "boolean",
      "notes": "string",
      "addedAt": "timestamp"
    }
  ],
  "summary": {
    "totalItems": "number",
    "purchasedItems": "number",
    "estimatedTotal": "number"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}

API Gateway (3000)

/api/auth/* → User Service

/api/users/* → User Service

/api/items/* → Item Service

/api/lists/* → List Service

GET /api/dashboard — estatísticas do usuário

GET /api/search?q= — busca global

GET /health — status dos serviços

GET /registry — serviços registrados

Circuit Breaker: 3 falhas consecutivas abrem o circuito por 30s por serviço
Logs: todas as requisições registradas com morgan

Dados JSON

data/users.json — usuários

services/item-service/data/items.json — itens

data/lists.json — listas

Variáveis de Ambiente

JWT_SECRET — segredo do JWT (opcional)

SERVICE_REGISTRY_FILE — caminho do arquivo do registry (opcional)

Demonstração (client-demo.js)

Exemplo de fluxo:

Registrar usuário

Login (JWT)

Buscar itens por categoria

Criar lista

Adicionar item

Consultar dashboard e busca global

node client-demo.js


Se você quiser, posso **gerar também uma versão menor e enxuta**, ideal para colocar direto no GitHub sem poluir, com apenas instruções essenciais e endpoints resumidos.  

Quer que eu faça essa versão enxuta também?


O ChatGPT pode cometer erros. Considere verificar informações importantes.
