import express from 'express';
import morgan from 'morgan';
import path from 'path';
import JsonDatabase from '../../shared/JsonDatabase.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { autoRegister } from '../../shared/serviceRegistry.js';

const app = express();
const PORT = process.env.PORT || 3002;
const JWT_KEY = process.env.JWT_SECRET || 'dev-secret';
const productDB = new JsonDatabase(path.join(process.cwd(), 'services', 'product-service', 'data', 'products.json'));

app.use(express.json());
app.use(morgan('dev'));

// Autenticação
function authenticate(req,res,next){
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if(!token) return res.status(401).json({ error:'Token ausente' });
  try{ req.user = jwt.verify(token, JWT_KEY); next(); } catch { return res.status(401).json({ error:'Token inválido' }); }
}

// Health check
app.get('/health',(req,res)=> res.json({ status:'ok', service:'product-service' }));

// Listagem de produtos
app.get('/products', (req,res)=>{
  const { category, name } = req.query;
  let data = productDB.read().filter(x=> x.active);
  if (category) data = data.filter(x => x.category.toLowerCase() === String(category).toLowerCase());
  if (name) data = data.filter(x => x.name.toLowerCase().includes(String(name).toLowerCase()));
  res.json({ products: data });
});

// Obter produto por ID
app.get('/products/:id', (req,res)=>{
  const product = productDB.findById(req.params.id);
  if(!product || !product.active) return res.status(404).json({ error:'Produto não encontrado' });
  res.json({ product });
});

// Criar produto
app.post('/products', authenticate, (req,res)=>{
  const { name, category, brand, unit, averagePrice, barcode, description, active=true } = req.body;
  if(!name || !category || !unit) return res.status(400).json({ error:'Campos obrigatórios: name, category, unit' });
  const newProduct = {
    id: uuidv4(),
    name,
    category,
    brand: brand||'',
    unit,
    averagePrice: Number(averagePrice||0),
    barcode: barcode||'',
    description: description||'',
    active: !!active,
    createdAt: Date.now()
  };
  productDB.upsert(newProduct);
  res.status(201).json({ product: newProduct });
});

// Atualizar produto
app.put('/products/:id', authenticate, (req,res)=>{
  const product = productDB.findById(req.params.id);
  if(!product) return res.status(404).json({ error:'Produto não encontrado' });
  const updates = req.body;
  Object.assign(product, updates, { averagePrice: updates.averagePrice != null ? Number(updates.averagePrice) : product.averagePrice });
  productDB.upsert(product);
  res.json({ product });
});

// Listagem de categorias
app.get('/categories', (req,res)=>{
  const categoriesSet = new Set(productDB.read().filter(x=>x.active).map(x=>x.category));
  res.json({ categories: Array.from(categoriesSet).sort() });
});

// Busca por produtos
app.get('/search', (req,res)=>{
  const query = String(req.query.q||'').toLowerCase();
  const data = productDB.read().filter(x=> x.active && (x.name.toLowerCase().includes(query) || x.brand.toLowerCase().includes(query)));
  res.json({ products: data });
});

// Inicialização do serviço
app.listen(PORT, ()=>{
  autoRegister({ name:'product-service', port: PORT });
  console.log(`✅ Product Service rodando na porta ${PORT}`);
});
