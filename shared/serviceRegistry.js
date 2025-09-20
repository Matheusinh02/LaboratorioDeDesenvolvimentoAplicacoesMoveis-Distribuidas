import fs from 'fs';
import path from 'path';

const DEFAULT_REGISTRY_FILE = process.env.SERVICE_REGISTRY_FILE || path.join(process.cwd(), 'registry.services.json');
const PING_INTERVAL = 30_000;

function currentTime(){ return Date.now(); }

export class Registry {
  constructor(filePath = DEFAULT_REGISTRY_FILE){
    this.filePath = filePath;
    this.ensureFileExists();
    this.records = this.load();
  }

  ensureFileExists(){
    const folder = path.dirname(this.filePath);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, JSON.stringify({ services: {} }, null, 2));
  }

  load(){
    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
  }

  save(obj){
    fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
  }

  addService(serviceName, host, port, healthPath='/health'){
    const data = this.load();
    const serviceKey = `${serviceName}-${host}:${port}`;
    data.services[serviceKey] = { serviceName, host, port, healthPath, lastPing: currentTime() };
    this.save(data);
    return serviceKey;
  }

  ping(serviceKey){
    const data = this.load();
    if(data.services[serviceKey]){
      data.services[serviceKey].lastPing = currentTime();
      this.save(data);
    }
  }

  removeService(serviceKey){
    const data = this.load();
    delete data.services[serviceKey];
    this.save(data);
  }

  getAll(){
    return Object.values(this.load().services);
  }

  find(serviceName){
    const list = this.getAll().filter(s => s.serviceName === serviceName);
    // round-robin simples: menor lastPing primeiro
    list.sort((a,b)=> (a.lastPing||0) - (b.lastPing||0));
    return list[0] || null;
  }
}

export function registerService({ name, host='localhost', port, healthPath='/health' }){
  const registry = new Registry();
  const key = registry.addService(name, host, port, healthPath);
  
  const interval = setInterval(() => {
    try { registry.ping(key); } catch {}
  }, PING_INTERVAL);

  const cleanup = () => { 
    try { clearInterval(interval); registry.removeService(key); } catch {} 
  };

  process.on('SIGINT', cleanup);
  process.on('exit', cleanup);

  return registry;
}
