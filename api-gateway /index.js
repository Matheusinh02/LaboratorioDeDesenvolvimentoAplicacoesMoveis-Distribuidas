import express from 'express';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import { ServiceRegistry } from '../shared/serviceRegistry.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_KEY = process.env.JWT_SECRET || 'dev-secret';
const serviceRegistry = new ServiceRegistry();

app.use(express.json());
app.use(morgan('dev'));

// Circuit breaker
const circuitStatus = {}; // serviceName -> {failCount, openUntil}
const MAX_FAILURES = 3;
const OPEN_DURATION_MS = 30_000;

function circuitOpen(serviceName){
  const c = circuitStatus[serviceName];
  return c && c.openUntil && c.openUntil > Date.now();
}
function logFailure(serviceName){
  const c = circuitStatus[serviceName] || { failCount:0, openUntil:0 };
  c.failCount += 1;
  if (c.failCount >= MAX_FAILURES){
    c.openUntil = Date.now() + OPEN_DURATION_MS;
  }
  circuitStatus[serviceName] = c;
}
function logSuccess(serviceName){
  circuitStatus[serviceName] = { failCount:0, openUntil:0 };
}

async function forwardRequest(serviceName, req, res, rewritePath = ''){
  if (circuitOpen(serviceName)) return res.status(503).json({ error:`Circuit open for ${serviceName}` });
  const svc = serviceRegistry.discover(serviceName);
  if (!svc) return res.status(503).json({ error:`Service ${serviceName} unavailable` });
  const targetUrl = `http://${svc.host}:${svc.port}${rewritePath}`;
  try {
    const options = {
      method: req.method,
      headers: { ...req.headers, host: undefined },
      body: ['GET','HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
    };
    options.headers['content-type'] = 'application/json';
    const resp = await fetch(targetUrl, options);
    logSuccess(serviceName);
    const text = await resp.text();
    res.status(resp.status);
    try { res.json(JSON.parse(text)); } catch { res.send(text); }
  } catch(e) {
    logFailure(serviceName);
    res.status(502).json({ error:`Failed to forward to ${serviceName}`, details: e.message });
  }
}

function authenticate(req,res,next){
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error:'Token missing' });
  try { req.user = jwt.verify(auth.slice(7), JWT_KEY); return next(); }
  catch { return res.status(401).json({ error:'Invalid token' }); }
}

// Proxy routes
app.use('/api/auth', (req,res)=> forwardRequest('auth-service', req, res, req.originalUrl.replace('/api','')));
app.use('/api/users', authenticate, (req,res)=> forwardRequest('account-service', req, res, req.originalUrl.replace('/api','')));
app.use('/api/items', (req,res)=> forwardRequest('product-service', req, res, req.originalUrl.replace('/api','')));
app.use('/api/lists', authenticate, (req,res)=> forwardRequest('collection-service', req, res, req.originalUrl.replace('/api','')));

// Aggregated endpoint
app.get('/api/dashboard', authenticate, async (req,res)=>{
  try {
    const collectionSvc = serviceRegistry.discover('collection-service');
    const productSvc = serviceRegistry.discover('product-service');
    if (!collectionSvc || !productSvc) return res.status(503).json({ error:'Services unavailable' });
    const [collectionsResp, categoriesResp] = await Promise.all([
      fetch(`http://${collectionSvc.host}:${collectionSvc.port}/lists`, { headers:{ authorization: req.headers.authorization }}),
      fetch(`http://${productSvc.host}:${productSvc.port}/categories`)
    ]);
    const collections = await collectionsResp.json();
    const categories = await categoriesResp.json();
    res.json({
      userId: req.user.id,
      totalCollections: (collections.lists||[]).length,
      categories: categories.categories||[],
      lastUpdate: Date.now()
    });
  } catch(e){ res.status(500).json({ error:'Dashboard error', details: e.message }); }
});

app.get('/api/search', async (req,res)=>{
  try{
    const productSvc = serviceRegistry.discover('product-service');
    const collectionSvc = serviceRegistry.discover('collection-service');
    if (!productSvc) return res.status(503).json({ error:'Product service unavailable' });
    const q = encodeURIComponent(req.query.q || '');
    const [productsR, collectionsR] = await Promise.all([
      fetch(`http://${productSvc.host}:${productSvc.port}/search?q=${q}`),
      req.headers.authorization && collectionSvc ? fetch(`http://${collectionSvc.host}:${collectionSvc.port}/lists`, { headers:{ authorization: req.headers.authorization }}) : Promise.resolve({ ok:true, json: async()=>({ lists: []}) })
    ]);
    const products = await productsR.json();
    const collections = await collectionsR.json();
    res.json({ items: products.items||[], lists: collections.lists||[] });
  } catch(e){ res.status(500).json({ error:'Global search failed', details: e.message }); }
});

app.get('/health', async (req,res)=>{
  const services = serviceRegistry.list();
  const statuses = await Promise.all(services.map(async s=>{
    try{
      const r = await fetch(`http://${s.host}:${s.port}${s.healthPath||'/health'}`);
      return { ...s, ok: r.ok };
    } catch { return { ...s, ok:false }; }
  }));
  res.json({ gateway:'ok', services: statuses });
});

app.get('/registry', (req,res)=> res.json({ services: serviceRegistry.list() }));

app.listen(PORT, ()=>{ console.log(`🌐 API Gateway running on port ${PORT}`); });
