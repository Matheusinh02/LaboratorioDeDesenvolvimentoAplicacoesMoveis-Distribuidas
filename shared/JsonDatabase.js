import fs from 'fs';
import path from 'path';

export default class FileDB {
  constructor(fileLocation){
    this.fileLocation = fileLocation;
    this.ensureFileExists();
  }

  ensureFileExists(){
    const folder = path.dirname(this.fileLocation);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    if (!fs.existsSync(this.fileLocation)) fs.writeFileSync(this.fileLocation, JSON.stringify([], null, 2));
  }

  load(){
    return JSON.parse(fs.readFileSync(this.fileLocation, 'utf-8') || '[]');
  }

  save(data){
    fs.writeFileSync(this.fileLocation, JSON.stringify(data, null, 2));
  }

  getById(id){
    return this.load().find(item => item.id === id) || null;
  }

  upsertRecord(record, keyField='id'){
    const data = this.load();
    const index = data.findIndex(item => item[keyField] === record[keyField]);
    if(index >= 0){
      data[index] = record;
    } else {
      data.push(record);
    }
    this.save(data);
    return record;
  }

  deleteById(id){
    const data = this.load();
    const remaining = data.filter(item => item.id !== id);
    this.save(remaining);
    return data.length - remaining.length;
  }
}

