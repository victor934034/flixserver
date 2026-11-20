'use client';
import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import s from '../ui.module.css';

function Toggle({ on, onChange }) {
  return <button type="button" className={`${s.sw} ${on ? s.swOn : ''}`} onClick={() => onChange(!on)} aria-pressed={on} />;
}

export default function SegurancaPage() {
  const [cfg, setCfg] = useState({});
  const [days, setDays] = useState('7');
  const [maxIp, setMaxIp] = useState('1');
  const [msg, setMsg] = useState('');
  const [blocks, setBlocks] = useState([]);
  const [claims, setClaims] = useState([]);
  const [form, setForm] = useState({ kind: 'ip', value: '', scope: 'all', reason: '' });
  const [err, setErr] = useState('');

  async function loadAll() {
    const [st, bl, tr] = await Promise.all([
      api.get('/settings').then(r => r.data || {}).catch(() => ({})),
      api.get('/security/blocklist').then(r => r.data).catch(() => []),
      api.get('/security/trials').then(r => r.data).catch(() => []),
    ]);
    setCfg(st); setDays(st.trial_days || '7'); setMaxIp(st.trial_max_per_ip || '1');
    setBlocks(bl); setClaims(tr);
  }
  useEffect(() => { loadAll(); }, []);

  async function save(key, value) {
    setMsg('');
    try {
      await api.put(`/settings/${key}`, { value: String(value) });
      setCfg(c => ({ ...c, [key]: String(value) }));
      setMsg('Salvo!'); setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg('Erro: ' + (e.response?.data?.error || e.message)); }
  }
  const on = k => cfg[k] === 'true';

  async function addBlock(e) {
    e.preventDefault(); setErr('');
    try {
      const body = { kind: form.kind, scope: form.scope, reason: form.reason };
      if (form.kind === 'device') body.raw_device_id = form.value.trim(); else body.value = form.value.trim();
      await api.post('/security/blocklist', body);
      setForm({ ...form, value: '', reason: '' });
      loadAll();
    } catch (e2) { setErr(e2.response?.data?.error || 'Erro ao bloquear'); }
  }
  async function rmBlock(id) { await api.delete(`/security/blocklist/${id}`); loadAll(); }
  async function release(id) {
    if (!confirm('Liberar este aparelho/IP para um novo teste grátis?')) return;
    await api.delete(`/security/trials/${id}`); loadAll();
  }

  return (
    <div>
      <h1 className={s.h1}>Teste grátis e segurança</h1>

      <div className={s.panel}>
        <h2>Teste grátis {msg && <span className={s.msg}>{msg}</span>}</h2>
        <p className={s.hint}>Celular/TV: 1 teste por aparelho. PC/web: 1 teste por IP. VPN, proxy e Tor são bloqueados.</p>

        <div className={s.toggle}>
          <div>Teste grátis ativo<small>Quando desligado, o botão some dos apps e do site.</small></div>
          <Toggle on={on('trial_enabled')} onChange={v => save('trial_enabled', v)} />
        </div>
        <div className={s.toggle}>
          <div>Conceder automaticamente no cadastro<small>Conta nova já entra em teste (se passar nas regras anti-abuso).</small></div>
          <Toggle on={on('trial_auto_signup')} onChange={v => save('trial_auto_signup', v)} />
        </div>
        <div className={s.toggle}>
          <div>Bloquear VPN / proxy no teste<small>Recomendado.</small></div>
          <Toggle on={cfg.trial_block_vpn !== 'false'} onChange={v => save('trial_block_vpn', v)} />
        </div>
        <div className={s.row} style={{ marginTop: 12 }}>
          <label>Duração (dias) <input className={s.input} type="number" min="1" max="60" style={{ width: 90 }} value={days} onChange={e => setDays(e.target.value)} /></label>
          <button className={s.btn} onClick={() => save('trial_days', Math.max(1, parseInt(days) || 7))}>Salvar duração</button>
          <label>Testes por IP (PC) <input className={s.input} type="number" min="1" max="20" style={{ width: 90 }} value={maxIp} onChange={e => setMaxIp(e.target.value)} /></label>
          <button className={s.btn2} onClick={() => save('trial_max_per_ip', Math.max(1, parseInt(maxIp) || 1))}>Salvar</button>
        </div>
      </div>

      <div className={s.panel}>
        <h2>Bloqueios por IP / aparelho</h2>
        <p className={s.hint}>IP aceita faixa (ex.: 203.0.113.0/24). Para aparelho, cole o ID do aparelho (o sistema guarda só o hash). “Só teste” impede apenas o teste grátis; “Tudo” bloqueia o acesso ao site/app.</p>
        <form className={s.row} onSubmit={addBlock}>
          <select className={s.select} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
            <option value="ip">IP</option><option value="device">Aparelho</option>
          </select>
          <input className={s.input} style={{ minWidth: 220 }} placeholder={form.kind === 'ip' ? '203.0.113.10 ou 203.0.113.0/24' : 'ID do aparelho'} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} required />
          <select className={s.select} value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}>
            <option value="all">Tudo</option><option value="trial">Só teste grátis</option>
          </select>
          <input className={s.input} placeholder="Motivo (opcional)" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          <button className={s.btn}>Bloquear</button>
        </form>
        {err && <p className={s.err}>{err}</p>}
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Tipo</th><th>Valor</th><th>Escopo</th><th>Motivo</th><th>Desde</th><th></th></tr></thead>
            <tbody>
              {blocks.length === 0 ? <tr><td colSpan={6}>Nenhum bloqueio.</td></tr> : blocks.map(b => (
                <tr key={b.id}>
                  <td>{b.kind === 'ip' ? 'IP' : 'Aparelho'}</td>
                  <td className={s.mono}>{b.kind === 'device' ? b.value.slice(0, 16) + '…' : b.value}</td>
                  <td>{b.scope === 'all' ? 'Tudo' : 'Só teste'}</td>
                  <td>{b.reason || '—'}</td>
                  <td>{new Date(b.created_at).toLocaleDateString('pt-BR')}</td>
                  <td><button className={`${s.btn2} ${s.danger}`} onClick={() => rmBlock(b.id)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={s.panel}>
        <h2>Testes concedidos</h2>
        <p className={s.hint}>Os 200 mais recentes. “Bloquear IP” impede novos testes desse IP; “Liberar” devolve o direito a um novo teste (suporte).</p>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Data</th><th>Usuário</th><th>Plataforma</th><th>IP</th><th>Aparelho</th><th></th></tr></thead>
            <tbody>
              {claims.length === 0 ? <tr><td colSpan={6}>Nenhum teste concedido ainda.</td></tr> : claims.map(c => (
                <tr key={c.id}>
                  <td>{new Date(c.created_at).toLocaleString('pt-BR')}</td>
                  <td>{c.users?.name || '—'}<div className={s.mono}>{c.users?.email}</div></td>
                  <td>{c.platform}</td>
                  <td className={s.mono}>{c.ip || '—'}</td>
                  <td className={s.mono}>{c.device_hash ? c.device_hash.slice(0, 10) + '…' : '—'}</td>
                  <td>
                    {c.ip && <button className={s.btn2} onClick={() => { setForm({ kind: 'ip', value: c.ip, scope: 'trial', reason: 'abuso de teste' }); window.scrollTo({ top: 300, behavior: 'smooth' }); }}>Bloquear IP</button>} <button className={s.btn2} onClick={() => release(c.id)}>Liberar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
