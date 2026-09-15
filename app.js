(function () {
  const CATEGORIAS = ["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Assinaturas","Outros"];
  const CORES = ["#2563eb","#059669","#7c3aed","#ea580c","#dc2626","#0891b2","#ca8a04","#64748b"];

  const fmtR = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let dados = load();
  let aba = "resumo";
  let modalTipo = null, modalItem = null;

  let hoje = new Date();
  let ano = dados.vista && dados.vista.ano !== undefined ? dados.vista.ano : hoje.getFullYear();
  let mes = dados.vista && dados.vista.mes !== undefined ? dados.vista.mes : hoje.getMonth();

  function load() {
    try {
      const raw = localStorage.getItem("controleGastos");
      const d = raw ? JSON.parse(raw) : { receitas: [], gastos: [], vista: {} };
      if (!d.cartao) d.cartao = [];
      return d;
    } catch (e) {
      return { receitas: [], gastos: [], cartao: [], vista: {} };
    }
  }

  function save() {
    localStorage.setItem("controleGastos", JSON.stringify(dados));
  }

  function chave() {
    const m = String(mes + 1).padStart(2, "0");
    return ano + "-" + m;
  }

  function nomeMes() {
    const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    return nomes[mes] + " de " + ano;
  }

  function el(id) { return document.getElementById(id); }

  function salvarMes() {
    dados.vista = { ano: ano, mes: mes };
    save();
  }

  function somarMeses(ym, n) {
    const [y, m] = ym.split("-").map(Number);
    const t = m - 1 + n;
    const ny = y + Math.floor(t / 12);
    const nm = ((t % 12) + 12) % 12 + 1;
    return ny + "-" + String(nm).padStart(2, "0");
  }

  function parcelasDoMes(k) {
    const lista = [];
    dados.cartao.forEach(c => {
      for (let i = 1; i <= c.parcelas; i++) {
        if (somarMeses(c.mesInicio, i - 1) !== k) continue;
        lista.push({
          id: "cart-" + c.id + "-" + i,
          cartaoId: c.id,
          _tipo: "cartao",
          descricao: c.descricao,
          valor: Math.round(c.valorTotal / c.parcelas * 100) / 100,
          categoria: c.categoria,
          cartao: true,
          parcela: i,
          totalParcelas: c.parcelas
        });
      }
    });
    return lista;
  }

  function atualizarUI() {
    el("monthLabel").textContent = nomeMes();
    const k = chave();
    const recs = dados.receitas.filter(r => r.mes === k);
    const gas = dados.gastos.filter(g => g.mes === k).concat(parcelasDoMes(k));
    const tr = recs.reduce((s, r) => s + r.valor, 0);
    const tg = gas.reduce((s, g) => s + g.valor, 0);

    el("totalReceitas").textContent = fmtR(tr);
    el("totalGastos").textContent = fmtR(tg);
    const saldoEl = el("saldo");
    saldoEl.textContent = fmtR(tr - tg);
    saldoEl.style.color = tr - tg >= 0 ? "var(--green)" : "var(--red)";

    if (el("cartaoMesInfo")) el("cartaoMesInfo").textContent = nomeMes();

    renderLista("listaReceitas", recs.map(r => Object.assign({ _tipo: "receita" }, r)));
    renderLista("listaGastos", gas.sort((a, b) => (b.data || "").localeCompare(a.data || "")));
    renderResumo(gas);
    renderCartao();
    renderEditar();
  }

  function renderLista(id, arr) {
    const box = el(id);
    if (arr.length === 0) {
      box.innerHTML = '<div class="empty">Nenhum lançamento neste mês.</div>';
      return;
    }
    box.innerHTML = "";
    arr.forEach(l => {
      const div = document.createElement("div");
      div.className = "item clickable";
      let meta = "";
      if (l.cartao) {
        meta = "Cartão" + (l.categoria ? " • " + l.categoria : "") + (l.totalParcelas > 1 ? " • " + l.parcela + "/" + l.totalParcelas : "");
      } else if (l._tipo === "receita") {
        meta = "";
      } else {
        meta = (l.data ? l.data.split("-").reverse().join("/") : "") + (l.categoria ? " • " + l.categoria : "");
      }
      const isRec = l._tipo === "receita";
      div.innerHTML =
        '<div class="info">' +
          '<div class="desc">' + escapeHTML(l.descricao) + '</div>' +
          (meta ? '<div class="meta">' + escapeHTML(meta) + '</div>' : "") +
        '</div>' +
        '<span class="valor ' + (isRec ? 'entrada' : 'saida') + '">' + (isRec ? "+" : "−") + " " + fmtR(l.valor) + '</span>';
      div.addEventListener("click", () => abrirModal(l._tipo, l.cartaoId || l.id));
      box.appendChild(div);
    });
  }

  function renderResumo(gas) {
    const box = el("resumoCategorias");
    const total = gas.reduce((s, g) => s + g.valor, 0);
    if (total === 0) {
      box.innerHTML = '<div class="empty">Nenhum gasto neste mês.</div>';
      return;
    }
    const porCat = {};
    gas.forEach(g => { porCat[g.categoria] = (porCat[g.categoria] || 0) + g.valor; });
    const sorted = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    box.innerHTML = "";
    sorted.forEach(([cat, val]) => {
      const pct = (val / total * 100).toFixed(1).replace(".", ",");
      const cor = CORES[CATEGORIAS.indexOf(cat)] || CORES[CORES.length - 1];
      const div = document.createElement("div");
      div.className = "cat-row";
      div.innerHTML =
        '<span class="name">' + escapeHTML(cat) + '</span>' +
        '<div class="cat-bar"><span style="width:' + pct.replace(",", ".") + '%;background:' + cor + '"></span></div>' +
        '<span class="val">' + fmtR(val) + '</span>' +
        '<span class="pct">' + pct + '%</span>';
      box.appendChild(div);
    });
  }

  function renderCartao() {
    const box = el("listaCartao");
    if (dados.cartao.length === 0) {
      box.innerHTML = '<div class="empty">Nenhuma compra no cartão.</div>';
      return;
    }
    box.innerHTML = "";
    dados.cartao.forEach(c => {
      const div = document.createElement("div");
      div.className = "item clickable";
      const parcela = fmtR(Math.round(c.valorTotal / c.parcelas * 100) / 100);
      const mesInicio = c.mesInicio.split("-").reverse().join("/");
      const meta = (c.parcelas > 1 ? c.parcelas + "x de " + parcela : fmtR(c.valorTotal)) +
                   " • Início: " + mesInicio +
                   (c.categoria ? " • " + c.categoria : "");
      div.innerHTML =
        '<div class="info">' +
          '<div class="desc">' + escapeHTML(c.descricao) + '</div>' +
          '<div class="meta">' + escapeHTML(meta) + '</div>' +
        '</div>' +
        '<span class="valor saida">' + fmtR(c.valorTotal) + '</span>';
      div.addEventListener("click", () => abrirModal("cartao", c.id));
      box.appendChild(div);
    });
  }

  function renderEditar() {
    const box = el("listaEditar");
    const filtro = el("filtroTipo").value;
    const k = chave();
    const itens = [];
    if (filtro === "todos" || filtro === "receitas") dados.receitas.filter(r => r.mes === k).forEach(r => itens.push(Object.assign({ _tipo: "receita" }, r)));
    if (filtro === "todos" || filtro === "gastos") dados.gastos.filter(g => g.mes === k).forEach(g => itens.push(Object.assign({ _tipo: "gasto" }, g)));
    if (filtro === "todos" || filtro === "cartao") dados.cartao.filter(c => c.mesInicio === k || parcelasDoMes(k).some(p => p.cartaoId === c.id)).forEach(c => itens.push({ _tipo: "cartao", id: c.id, descricao: c.descricao, valor: c.valorTotal, mes: c.mesInicio, categoria: c.categoria, parcelas: c.parcelas }));

    if (itens.length === 0) {
      box.innerHTML = '<div class="empty">Nenhum lançamento em ' + nomeMesCompleto(k) + '.</div>';
      return;
    }

    box.innerHTML = "";

    const header = document.createElement("div");
    header.className = "grupo-mes";
    header.textContent = nomeMesCompleto(k) + " • " + itens.length + " lançamento" + (itens.length > 1 ? "s" : "");
    box.appendChild(header);

    itens.sort((a, b) => (a._tipo === "receita") - (b._tipo === "receita"));

    itens.forEach(item => {
      const div = document.createElement("div");
      div.className = "item clickable";
      const badge = item._tipo === "receita" ? '<span class="tipo-badge rec">REC</span>' :
                    item._tipo === "gasto" ? '<span class="tipo-badge gas">GAS</span>' :
                    '<span class="tipo-badge car">CART</span>';
      const meta = badge + (item.categoria ? " • " + item.categoria : "") + (item.parcelas > 1 ? " • " + item.parcelas + "x" : "");
      const cls = item._tipo === "receita" ? "valor entrada" : "valor saida";
      const sinal = item._tipo === "receita" ? "+ " : "− ";
      div.innerHTML =
        '<div class="info">' +
          '<div class="desc">' + escapeHTML(item.descricao) + '</div>' +
          '<div class="meta">' + meta + '</div>' +
        '</div>' +
        '<span class="' + cls + '">' + sinal + fmtR(item.valor) + '</span>';
      div.addEventListener("click", () => abrirModal(item._tipo, item.id));
      box.appendChild(div);
    });
  }

  function nomeMesCompleto(ym) {
    const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const [y, m] = ym.split("-").map(Number);
    return nomes[m - 1] + " de " + y;
  }

  function abrirModal(tipo, id) {
    let item;
    if (tipo === "receita") item = dados.receitas.find(x => x.id === id);
    else if (tipo === "gasto") item = dados.gastos.find(x => x.id === id);
    else item = dados.cartao.find(x => x.id === id);
    if (!item) return;

    modalTipo = tipo;
    modalItem = item;

    el("modalTitulo").textContent = tipo === "receita" ? "Editar receita" : tipo === "gasto" ? "Editar gasto" : "Editar compra no cartão";
    el("mDesc").value = item.descricao;

    const extras = el("modalCamposExtras");
    extras.innerHTML = "";

    function campo(label, input) {
      extras.insertAdjacentHTML("beforeend", '<label>' + label + '</label>' + input);
    }

    function selectCategoria(valor) {
      return '<select id="mCategoria" required>' + CATEGORIAS.map(c =>
        '<option value="' + c + '"' + (c === valor ? " selected" : "") + '>' + c + '</option>'
      ).join("") + '</select>';
    }

    if (tipo === "receita") {
      campo("Valor (R$)", '<input type="number" id="mValor" min="0" step="0.01" value="' + item.valor + '" required>');
      campo("Mês", '<input type="month" id="mMes" value="' + item.mes + '" required>');
    } else if (tipo === "gasto") {
      campo("Valor (R$)", '<input type="number" id="mValor" min="0" step="0.01" value="' + item.valor + '" required>');
      campo("Categoria", selectCategoria(item.categoria));
      campo("Data", '<input type="date" id="mData" value="' + (item.data && item.data !== "undefined" ? item.data : "") + '">');
      campo("Mês", '<input type="month" id="mMes" value="' + item.mes + '" required>');
    } else {
      campo("Valor total (R$)", '<input type="number" id="mValor" min="0" step="0.01" value="' + item.valorTotal + '" required>');
      campo("Parcelas", '<input type="number" id="mParcelas" min="1" max="48" value="' + item.parcelas + '" required>');
      campo("Categoria", selectCategoria(item.categoria));
      campo("Mês da 1ª parcela", '<input type="month" id="mMes" value="' + item.mesInicio + '" required>');
    }

    el("modalOverlay").hidden = false;
  }

  function fecharModal() {
    el("modalOverlay").hidden = true;
    modalItem = null;
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }

  document.querySelectorAll(".side-item").forEach(tab => {
    tab.addEventListener("click", () => {
      aba = tab.dataset.tab;
      document.querySelectorAll(".side-item").forEach(t => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".aba").forEach(a => a.classList.toggle("hidden", a.id !== "aba-" + aba));
      fecharMenu();
    });
  });

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  function fecharMenu() {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }
  document.getElementById("menuToggle").addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
  });
  overlay.addEventListener("click", fecharMenu);

  el("filtroTipo").addEventListener("change", renderEditar);

  el("formReceita").addEventListener("submit", e => {
    e.preventDefault();
    const desc = el("recDesc").value;
    const val = parseFloat(el("recValor").value.replace(",", "."));
    if (isNaN(val) || val < 0 || !desc.trim()) return;
    dados.receitas.push({ id: Date.now() + Math.random(), mes: chave(), descricao: desc.trim(), valor: val });
    save();
    el("recDesc").value = ""; el("recValor").value = "";
    atualizarUI();
  });

  el("formGasto").addEventListener("submit", e => {
    e.preventDefault();
    const desc = el("gastoDesc").value;
    const val = parseFloat(el("gastoValor").value.replace(",", "."));
    if (isNaN(val) || val < 0 || !desc.trim()) return;
    const data = el("gastoData").value || "";
    dados.gastos.push({ id: Date.now() + Math.random(), mes: chave(), descricao: desc.trim(), valor: val, categoria: el("gastoCategoria").value, data: data });
    save();
    el("gastoDesc").value = ""; el("gastoValor").value = ""; el("gastoData").value = "";
    atualizarUI();
  });

  el("formCartao").addEventListener("submit", e => {
    e.preventDefault();
    const desc = el("cartaoDesc").value;
    const val = parseFloat(el("cartaoValor").value.replace(",", "."));
    const parcelas = Math.max(1, Math.floor(parseFloat(el("cartaoParcelas").value) || 1));
    if (isNaN(val) || val <= 0 || !desc.trim()) return;
    dados.cartao.push({
      id: Date.now() + Math.random(),
      descricao: desc.trim(),
      valorTotal: val,
      parcelas: parcelas,
      categoria: el("cartaoCategoria").value,
      mesInicio: chave()
    });
    save();
    el("cartaoDesc").value = ""; el("cartaoValor").value = ""; el("cartaoParcelas").value = "1";
    atualizarUI();
  });

  el("modalForm").addEventListener("submit", e => {
    e.preventDefault();
    if (!modalItem) return;
    modalItem.descricao = el("mDesc").value.trim();
    if (modalTipo === "receita") {
      const v = parseFloat(el("mValor").value.replace(",", "."));
      if (isNaN(v) || v < 0) return;
      modalItem.valor = v;
      modalItem.mes = el("mMes").value;
    } else if (modalTipo === "gasto") {
      const v = parseFloat(el("mValor").value.replace(",", "."));
      if (isNaN(v) || v < 0) return;
      modalItem.valor = v;
      modalItem.categoria = el("mCategoria").value;
      modalItem.data = el("mData").value || "";
      modalItem.mes = el("mMes").value;
    } else {
      const v = parseFloat(el("mValor").value.replace(",", "."));
      if (isNaN(v) || v <= 0) return;
      modalItem.valorTotal = v;
      modalItem.parcelas = Math.max(1, Math.floor(parseFloat(el("mParcelas").value) || 1));
      modalItem.categoria = el("mCategoria").value;
      modalItem.mesInicio = el("mMes").value;
    }
    save();
    fecharModal();
    atualizarUI();
  });

  el("mDeletar").addEventListener("click", () => {
    if (!modalItem) return;
    const msg = modalTipo === "cartao" ? "Excluir esta compra do cartão e todas as suas parcelas?" : "Excluir este lançamento?";
    if (!confirm(msg)) return;
    const lista = modalTipo === "receita" ? dados.receitas : modalTipo === "gasto" ? dados.gastos : dados.cartao;
    const i = lista.findIndex(x => x.id === modalItem.id);
    if (i >= 0) lista.splice(i, 1);
    save();
    fecharModal();
    atualizarUI();
  });

  el("mCancelar").addEventListener("click", fecharModal);
  el("modalOverlay").addEventListener("click", e => { if (e.target === el("modalOverlay")) fecharModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") fecharModal(); });

  el("prevMonth").addEventListener("click", () => { mes--; if (mes < 0) { mes = 11; ano--; } salvarMes(); atualizarUI(); });
  el("nextMonth").addEventListener("click", () => { mes++; if (mes > 11) { mes = 0; ano++; } salvarMes(); atualizarUI(); });

  atualizarUI();
})();