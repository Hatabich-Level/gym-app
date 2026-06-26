// ── Спортзал: сервер (Express + PostgreSQL) ──────────────────────────────────
const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');

const app  = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD   || 'admin123';
const TRAINER_PASSWORD = process.env.TRAINER_PASSWORD || 'trener123';
const SECRET           = process.env.SECRET || 'change-me-secret';

if (!process.env.DATABASE_URL) {
  console.error('❌ Немає DATABASE_URL. Додайте PostgreSQL базу даних.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — всі не-API маршрути → index.html
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Tokens ────────────────────────────────────────────────────────────────────
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = verify(token);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  next();
}

// ── DB init + seed ────────────────────────────────────────────────────────────
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members      (id TEXT PRIMARY KEY, data JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS abons        (id TEXT PRIMARY KEY, data JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS payments     (id TEXT PRIMARY KEY, data JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS manual_debts (id TEXT PRIMARY KEY, data JSONB NOT NULL);
  `);

}

// ── Auth API ──────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { role, password, name } = req.body || {};
  const ok = (role === 'admin'   && password === ADMIN_PASSWORD) ||
             (role === 'trainer' && password === TRAINER_PASSWORD);
  if (!ok) return res.status(401).json({ error: 'Невірний пароль' });
  const token = sign({ role, name: (name || '').slice(0, 40), exp: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  res.json({ token, role, name: name || '' });
});

// ── State ─────────────────────────────────────────────────────────────────────
app.get('/api/state', auth, async (req, res) => {
  const [m, a, p, md] = await Promise.all([
    pool.query('SELECT data FROM members'),
    pool.query('SELECT data FROM abons'),
    pool.query('SELECT data FROM payments'),
    pool.query('SELECT data FROM manual_debts'),
  ]);
  res.json({
    role: req.user.role,
    name: req.user.name || '',
    members:      m.rows.map(r => r.data),
    abons:        a.rows.map(r => r.data),
    payments:     p.rows.map(r => r.data),
    manualDebts:  md.rows.map(r => r.data),
  });
});

// ── Upsert helpers ────────────────────────────────────────────────────────────
async function upsert(table, items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query(
        `INSERT INTO ${table} (id, data) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET data = $2`,
        [String(item.id), item]
      );
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

// Клієнти: тренер і адмін можуть додавати/редагувати
app.post('/api/members/bulk', auth, async (req, res) => {
  const items = (req.body && req.body.items) || [];
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items required' });
  await upsert('members', items);
  res.json({ ok: true });
});

// Видалити декілька клієнтів — тільки адмін (має бути ДО /:id)
app.delete('/api/members/delete-many', auth, adminOnly, async (req, res) => {
  const ids = (req.body && req.body.ids) || [];
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of ids) {
      await client.query('DELETE FROM members WHERE id = $1', [id]);
      await client.query("DELETE FROM abons WHERE data->>'memberId' = $1", [id]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }

  res.json({ ok: true });
});

// Видалити одного клієнта — тільки адмін
app.delete('/api/members/:id', auth, adminOnly, async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM members WHERE id = $1', [id]);
  await pool.query("DELETE FROM abons WHERE data->>'memberId' = $1", [id]);
  res.json({ ok: true });
});

// Абонементи: відмітки, заморозка, нові абонементи
app.post('/api/abons/bulk', auth, async (req, res) => {
  const items = (req.body && req.body.items) || [];
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items required' });
  await upsert('abons', items);
  res.json({ ok: true });
});

// Платежі (включно з заняттями тренера). Тільки додавання.
app.post('/api/payments', auth, async (req, res) => {
  const p = req.body;
  if (!p || !p.id) return res.status(400).json({ error: 'bad payment' });
  if (p.amount === undefined || p.amount === null) return res.status(400).json({ error: 'amount required' });
  p.method = p.method === 'card' ? 'card' : 'cash';
  p.hallMethod = p.hallMethod === 'card' ? 'card' : 'cash';
  p.by = req.user.role + (req.user.name ? ':' + req.user.name : '');
  await upsert('payments', [p]);
  res.json({ ok: true });
});

// Скинути абонементи — тільки адмін
app.post('/api/abons/reset', auth, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM abons');
  res.json({ ok: true });
});

// Скинути касу — тільки адмін
app.post('/api/payments/reset', auth, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM payments');
  res.json({ ok: true });
});

// Скинути все — тільки адмін
app.post('/api/reset/all', auth, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM abons');
  await pool.query('DELETE FROM payments');
  await pool.query('DELETE FROM members');
  res.json({ ok: true });
});

// Видалення платежу — тільки адмін
app.delete('/api/payments/:id', auth, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Ручні борги ───────────────────────────────────────────────────────────────

// Створити або оновити боржника
app.post('/api/manual-debts', auth, async (req, res) => {
  const d = req.body;
  if (!d || !d.id || !d.name) return res.status(400).json({ error: 'Потрібно id і name' });
  d.createdBy = req.user.role + (req.user.name ? ':' + req.user.name : '');
  await upsert('manual_debts', [d]);
  res.json({ ok: true });
});

// Записати часткову/повну оплату боргу (зменшує remaining)
app.post('/api/manual-debts/:id/pay', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT data FROM manual_debts WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Не знайдено' });
  const d = rows[0].data;
  const amount = parseFloat(req.body.amount) || 0;
  const method = req.body.method === 'card' ? 'card' : 'cash';
  const note   = (req.body.note || '').slice(0, 200);
  if (amount <= 0) return res.status(400).json({ error: 'Сума має бути більше 0' });

  d.remaining = Math.max(0, (d.remaining || 0) - amount);
  d.payments  = d.payments || [];
  d.payments.push({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    amount, method, note,
    by: req.user.role + (req.user.name ? ':' + req.user.name : '')
  });

  await upsert('manual_debts', [d]);

  // також пишемо в payments для каси
  const p = {
    id: 'md_' + Date.now().toString(36) + Math.random().toString(36).slice(2),
    kind: 'manual_debt',
    manualDebtId: d.id,
    memberName: d.name,
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    amount, method,
    note: (note ? note + ' · ' : '') + 'борг: ' + d.name,
    by: req.user.role + (req.user.name ? ':' + req.user.name : '')
  };
  await upsert('payments', [p]);

  res.json({ ok: true, remaining: d.remaining });
});

// Видалити боржника — тільки адмін
app.delete('/api/manual-debts/:id', auth, adminOnly, async (req, res) => {
  await pool.query('DELETE FROM manual_debts WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ── Експорт в Excel (формат оригінального журналу) ─────────────────────────────

const MONTH_NAMES = ['Січ','Лют','Бер','Кві','Тра','Черв','Лип','Серп','Вер','Жов','Лис','Груд'];
const COL_SHIFT = 'FFFFC000'; // жовтогарячий — день, коли хтось був на зміні (адмін або тренер)

app.get('/api/export/:year/:month', auth, async (req, res) => {
  try {
    const year  = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10); // 1-12
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Невірний рік або місяць' });
    }

    const [m, a, p] = await Promise.all([
      pool.query('SELECT data FROM members'),
      pool.query('SELECT data FROM abons'),
      pool.query('SELECT data FROM payments'),
    ]);
    const members  = m.rows.map(r => r.data);
    const abons    = a.rows.map(r => r.data);
    const payments = p.rows.map(r => r.data);

    const daysInMonth = new Date(year, month, 0).getDate();
    const monthKey = year + '-' + String(month).padStart(2, '0');

    // мапа: memberId -> { day -> { time, amount } }
    const byMember = new Map();
    const getEntry = (memberId) => {
      if (!byMember.has(memberId)) byMember.set(memberId, {});
      return byMember.get(memberId);
    };

    // дні, коли була будь-яка активність (хтось — адмін чи тренер — був на зміні)
    const activeDays = new Set();

    // відвідування (час приходу)
    abons.forEach(ab => {
      if (!ab.memberId) return;
      (ab.visits || []).forEach(v => {
        if (!v.date || v.date.slice(0, 7) !== monthKey) return;
        const day = parseInt(v.date.slice(8, 10), 10);
        const entry = getEntry(ab.memberId);
        entry[day] = entry[day] || {};
        entry[day].time = (v.time || '').replace(':', ' ');
        activeDays.add(day);
      });
    });

    // оплати (сума за день)
    payments.forEach(p => {
      if (!p.memberId || !p.date || p.date.slice(0, 7) !== monthKey) return;
      const day = parseInt(p.date.slice(8, 10), 10);
      const entry = getEntry(p.memberId);
      entry[day] = entry[day] || {};
      entry[day].amount = (entry[day].amount || 0) + (p.amount || 0);
      activeDays.add(day);
    });

    // всі клієнти з бази, відсортовані по номеру
    const activeMembers = members.slice().sort((x, y) => (x.num || 0) - (y.num || 0));

    const wb = new ExcelJS.Workbook();
    const sheetName = MONTH_NAMES[month - 1];
    const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }] });

    const SUM_COL = 3 + daysInMonth * 2;

    // Рядок 1: назва місяця + місце для сум по днях
    ws.mergeCells(1, 1, 1, 2);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = sheetName + ' ' + year;
    titleCell.font = { name: 'Calibri', size: 13, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Рядок 2-3: заголовки
    ws.mergeCells(2, 1, 3, 1);
    ws.mergeCells(2, 2, 3, 2);
    const numHdr = ws.getCell(2, 1); numHdr.value = '№'; numHdr.font = { name: 'Calibri', bold: true }; numHdr.alignment = { horizontal: 'center', vertical: 'middle' };
    const nameHdr = ws.getCell(2, 2); nameHdr.value = 'ПІБ'; nameHdr.font = { name: 'Calibri', bold: true }; nameHdr.alignment = { horizontal: 'center', vertical: 'middle' };

    for (let d = 1; d <= daysInMonth; d++) {
      const colH = 3 + (d - 1) * 2;
      const colP = colH + 1;
      const onShift = activeDays.has(d);
      const bg = onShift ? COL_SHIFT : null;

      ws.mergeCells(2, colH, 2, colP);
      const dayHdr = ws.getCell(2, colH);
      dayHdr.value = d;
      dayHdr.font = { name: 'Calibri', bold: true };
      dayHdr.alignment = { horizontal: 'center', vertical: 'middle' };
      if (bg) dayHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };


      const timeHdr = ws.getCell(3, colH);
      timeHdr.value = 'час';
      timeHdr.font = { name: 'Calibri' };
      timeHdr.alignment = { horizontal: 'center', vertical: 'middle' };
      if (bg) timeHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };

      const payHdr = ws.getCell(3, colP);
      payHdr.value = 'опл/+';
      payHdr.font = { name: 'Calibri' };
      payHdr.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.getColumn(colH).width = 6;
      ws.getColumn(colP).width = 6;
    }

    ws.mergeCells(2, SUM_COL, 3, SUM_COL);
    const sumHdr = ws.getCell(2, SUM_COL);
    sumHdr.value = 'Сума';
    sumHdr.font = { name: 'Calibri', bold: true };
    sumHdr.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getColumn(1).width = 5.5;
    ws.getColumn(2).width = 27.5;
    ws.getColumn(SUM_COL).width = 8;

    // Рядки клієнтів
    const dayTotals = {};
    for (let d = 1; d <= daysInMonth; d++) dayTotals[d] = 0;

    activeMembers.forEach((mem, i) => {
      const row = 4 + i;
      const numCell = ws.getCell(row, 1);
      numCell.value = mem.num || (i + 1);
      numCell.font = { name: 'Calibri' };
      numCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const nameCell = ws.getCell(row, 2);
      nameCell.value = mem.name || '';
      nameCell.font = { name: 'Calibri' };
      nameCell.alignment = { horizontal: 'left', vertical: 'middle' };

      const entry = byMember.get(mem.id) || {};
      let clientTotal = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dayData = entry[d];
        if (!dayData) continue;
        const colH = 3 + (d - 1) * 2;
        const colP = colH + 1;
        const bg = activeDays.has(d) ? COL_SHIFT : null;

        if (dayData.time) {
          const timeCell = ws.getCell(row, colH);
          timeCell.value = dayData.time;
          timeCell.font = { name: 'Calibri' };
          timeCell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (bg) timeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        }

        if (dayData.amount) {
          const amtCell = ws.getCell(row, colP);
          amtCell.value = dayData.amount;
          amtCell.font = { name: 'Calibri' };
          amtCell.alignment = { horizontal: 'center', vertical: 'middle' };
          clientTotal += dayData.amount;
          dayTotals[d] += dayData.amount;
        }
      }

      if (clientTotal > 0) {
        const sumCell = ws.getCell(row, SUM_COL);
        sumCell.value = clientTotal;
        sumCell.font = { name: 'Calibri', bold: true };
        sumCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Рядок 1: суми по днях + загальна сума місяця
    let totalMonth = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const colP = 3 + (d - 1) * 2 + 1;
      const cell = ws.getCell(1, colP);
      cell.value = dayTotals[d] || 0;
      cell.font = { name: 'Calibri' };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      totalMonth += dayTotals[d];
    }
    const totalCell = ws.getCell(1, SUM_COL);
    totalCell.value = totalMonth;
    totalCell.font = { name: 'Calibri', bold: true };
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Окремий аркуш "Касса" — готівка/картка/всього ──────────────────────────
    const monthPayments = payments.filter(p => p.date && p.date.slice(0, 7) === monthKey);
    const cashTotal = monthPayments.filter(p => p.method !== 'card').reduce((s, p) => s + (p.amount || 0), 0);
    const cardTotal = monthPayments.filter(p => p.method === 'card').reduce((s, p) => s + (p.amount || 0), 0);

    const wsCash = wb.addWorksheet('Касса ' + sheetName);
    wsCash.getColumn(1).width = 30;
    wsCash.getColumn(2).width = 18;

    const cashRows = [
      ['Готівка', cashTotal],
      ['Картка', cardTotal],
      ['Загальна сума', cashTotal + cardTotal],
    ];
    wsCash.addRow(['Підсумки за ' + sheetName + ' ' + year]).font = { bold: true, size: 13 };
    wsCash.addRow([]);
    cashRows.forEach(r => {
      const row = wsCash.addRow(r);
      row.getCell(1).font = { name: 'Calibri', bold: true };
      row.getCell(2).font = { name: 'Calibri' };
      row.getCell(2).alignment = { horizontal: 'right' };
    });

    wsCash.addRow([]);
    wsCash.addRow(['Деталі платежів']).font = { bold: true };
    const hdrRow = wsCash.addRow(['Дата', 'ПІБ', 'Сума', 'Спосіб', 'Тип', 'Хто записав']);
    hdrRow.font = { bold: true };

    monthPayments
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .forEach(p => {
        const mem = members.find(x => x.id === p.memberId);
        wsCash.addRow([
          p.date, p.memberName || (mem ? mem.name : '?'), p.amount,
          p.method === 'card' ? 'Картка' : 'Готівка',
          p.kind === 'session' ? 'Заняття' : (p.kind === 'manual_debt' ? 'Борг' : 'Абонемент'),
          p.by || ''
        ]);
      });

    const fileName = sheetName + '_' + year + '.xlsx';
    const fileNameEncoded = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', "attachment; filename=\"export.xlsx\"; filename*=UTF-8''" + fileNameEncoded);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('Export error:', e);
    res.status(500).json({ error: 'Помилка експорту: ' + e.message });
  }
});

app.get('/healthz', (req, res) => res.send('ok'));

initDb()
  .then(() => app.listen(PORT, () => console.log('🏋️ Сервер запущено на порту ' + PORT)))
  .catch(e => { console.error('DB init error:', e); process.exit(1); });
