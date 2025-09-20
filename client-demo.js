const BASE = 'http://localhost:3000/api';

async function request(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Erro ${res.status} em ${url}:`, data);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`Falha ao chamar ${url}:`, err);
    return null;
  }
}

async function main() {
  console.log('=== DEMO CLIENT ===');

  // 1) Registro
  const email = `aluno${Date.now()}@teste.com`;
  const reg = await request(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      username: email.split('@')[0],
      password: '123456',
      firstName: 'Aluno',
      lastName: 'Teste'
    })
  });
  if (!reg) return;
  console.log('Usuário registrado:', reg.user.email);

  const token = reg.token;
  const authH = { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2) Buscar itens (catálogo)
  const itens = await request(`${BASE}/items?category=Alimentos`);
  if (!itens) return;
  console.log('Itens alimentos encontrados:', itens.items.length);

  // 3) Criar lista
  const lista = await request(`${BASE}/lists`, {
    method: 'POST',
    headers: authH,
    body: JSON.stringify({ name: 'Mercado da semana', description: 'Compras' })
  });
  if (!lista) return;
  console.log('Lista criada com ID:', lista.list.id);

  // 4) Adicionar item à lista
  const firstItem = itens.items[0];
  if (!firstItem) {
    console.log('Nenhum item disponível para adicionar.');
  } else {
    const listaAtualizada = await request(`${BASE}/lists/${lista.list.id}/items`, {
      method: 'POST',
      headers: authH,
      body: JSON.stringify({ itemId: firstItem.id, quantity: 2 })
    });
    if (!listaAtualizada) return;
    console.log('Item adicionado à lista. Total items agora:', listaAtualizada.list.items.length);
  }

  // 5) Dashboard agregado
  const dash = await request(`${BASE}/dashboard`, { headers: authH });
  if (dash) console.log('Dashboard:', dash);

  // 6) Busca global
  const search = await request(`${BASE}/search?q=arroz`, { headers: authH });
  if (search) console.log('Busca global (itens encontrados):', search.items.length);
}

main().catch(e => console.error('Erro inesperado:', e));
