import express from 'express';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import JsonDatabase from '../../shared/JsonDatabase.js';
import { autoRegister } from '../../shared/serviceRegistry.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_KEY = process.env.JWT_SECRET || 'dev-secret';
const accountDB = new JsonDatabase(path.join(process.cwd(), 'data', 'accounts.json'));

app.use(express.json());
app.use(morgan('dev'));

// Remove senha do usuário antes de retornar
function sanitizeUser(user){
  const { password, ...rest } = user;
  return rest;
}

// Middleware de autenticação
function authenticate(req, res, next){
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if(!token) return res.status(401).json({ error:'Token ausente' });
  try{
    const decoded = jwt.verify(token, JWT_KEY);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error:'Token inválido' });
  }
}

// Health check
app.get('/health', (req,res) => res.json({ status:'ok', service:'account-service' }));

// Registro de usuário
app.post('/auth/signup', async (req,res)=>{
  try{
    const { email, username, password, firstName, lastName, settings={} } = req.body;
    if(!email || !username || !password) return res.status(400).json({ error:'Campos obrigatórios: email, username, password' });

    const users = accountDB.read();
    if(users.some(u => u.email === email)) return res.status(409).json({ error:'Email já cadastrado' });
    if(users.some(u => u.username === username)) return res.status(409).json({ error:'Username já cadastrado' });

    const hash = await bcrypt.hash(password, 10);
    const now = Date.now();
    const newUser = {
      id: uuidv4(),
      email,
      username,
      password: hash,
      firstName: firstName || '',
      lastName: lastName || '',
      settings: {
        defaultStore: settings.defaultStore || '',
        currency: settings.currency || 'BRL'
      },
      createdAt: now,
      updatedAt: now
    };

    accountDB.upsert(newUser);
    const token = jwt.sign({ id: newUser.id, email: newUser.email, username: newUser.username }, JWT_KEY, { expiresIn: '24h' });

    res.status(201).json({ user: sanitizeUser(newUser), token });
  } catch(e){
    res.status(500).json({ error:'Erro interno' });
  }
});

// Login de usuário
app.post('/auth/signin', async (req,res)=>{
  const { identifier, password } = req.body;
  if(!identifier || !password) return res.status(400).json({ error:'identifier e password são obrigatórios' });

  const users = accountDB.read();
  const user = users.find(u => u.email === identifier || u.username === identifier);
  if(!user) return res.status(401).json({ error:'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.password);
  if(!valid) return res.status(401).json({ error:'Credenciais inválidas' });

  const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_KEY, { expiresIn: '24h' });
  res.json({ user: sanitizeUser(user), token });
});

// Obter dados do usuário
app.get('/accounts/:id', authenticate, (req,res)=>{
  const user = accountDB.findById(req.params.id);
  if(!user) return res.status(404).json({ error:'Usuário não encontrado' });
  if(req.user.id !== user.id) return res.status(403).json({ error:'Acesso negado' });
  res.json({ user: sanitizeUser(user) });
});

// Atualizar usuário
app.put('/accounts/:id', authenticate, (req,res)=>{
  const user = accountDB.findById(req.params.id);
  if(!user) return res.status(404).json({ error:'Usuário não encontrado' });
  if(req.user.id !== user.id) return res.status(403).json({ error:'Acesso negado' });

  const { firstName, lastName, settings } = req.body;
  user.firstName = firstName ?? user.firstName;
  user.lastName = lastName ?? user.lastName;
  user.settings = { ...user.settings, ...(settings || {}) };
  user.updatedAt = Date.now();

  accountDB.upsert(user);
  res.json({ user: sanitizeUser(user) });
});

// Inicialização do serviço
app.listen(PORT, ()=>{
  autoRegister({ name:'account-service', port: PORT });
  console.log(`✅ Account Service rodando na porta ${PORT}`);
});

