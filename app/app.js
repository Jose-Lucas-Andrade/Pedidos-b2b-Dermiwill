const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const ORDER_RECIPIENT_EMAIL = "representacrm@gmail.com";
// Central WhatsApp number in international format without + or spaces (BR: 55)
// Configured to send all WhatsApp orders to: (21) 98416-7915 -> international: 5521984167915
const ORDER_RECIPIENT_WHATSAPP = "5521984167915";

const state = {
  products: [],
  filtered: [],
  cart: new Map(),
  filter: "all",
  query: "",
};

const els = {
  grid: document.querySelector("#productGrid"),
  template: document.querySelector("#productTemplate"),
  emptyState: document.querySelector("#emptyState"),
  search: document.querySelector("#searchInput"),
  resultCount: document.querySelector("#resultCount"),
  cartCount: document.querySelector("#cartCount"),
  cartItems: document.querySelector("#cartItems"),
  totalUnits: document.querySelector("#totalUnits"),
  totalBoxes: document.querySelector("#totalBoxes"),
  totalValue: document.querySelector("#totalValue"),
  representative: document.querySelector("#representative"),
  previewOrder: document.querySelector("#previewOrder"),
  emailOrder: document.querySelector("#emailOrder"),
  copyOrder: document.querySelector("#copyOrder"),
  whatsappOrder: document.querySelector("#whatsappOrder"),
  printOrder: document.querySelector("#printOrder"),
  promoCount: document.querySelector("#promoCount"),
  regularCount: document.querySelector("#regularCount"),
  mobileCartBar: document.querySelector("#mobileCartBar"),
  mobileCartText: document.querySelector("#mobileCartText"),
  mobileCartTotal: document.querySelector("#mobileCartTotal"),
  orderPanel: document.querySelector("#orderPanel"),
};

const customerFields = ["storeName", "storeDoc", "storeZip", "storeAddress", "contactName", "contactEmail", "contactPhone", "notes"]
  .reduce((acc, id) => ({ ...acc, [id]: document.querySelector(`#${id}`) }), {});

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function applyFilters() {
  const query = normalize(state.query);
  state.filtered = state.products.filter((product) => {
    const tableOk = state.filter === "all" || product.tableKind === state.filter;
    const queryOk = !query || normalize(`${product.code} ${product.description} ${product.delivery}`).includes(query);
    return tableOk && queryOk;
  });
  renderProducts();
}

function productQty(productId) {
  return state.cart.get(productId)?.qty || 0;
}

function setProductQty(product, qty) {
  if (qty <= 0) {
    state.cart.delete(product.id);
  } else {
    state.cart.set(product.id, { product, qty });
  }
  renderCart();
  updateVisibleQty(product.id);
}

function updateVisibleQty(productId) {
  document.querySelectorAll(`[data-product-id="${productId}"] output`).forEach((out) => {
    out.value = productQty(productId);
    out.textContent = productQty(productId);
  });
}

function renderProducts() {
  els.grid.textContent = "";
  const fragment = document.createDocumentFragment();
  els.emptyState.hidden = state.filtered.length > 0;

  state.filtered.forEach((product) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.productId = product.id;

    const img = node.querySelector("img");
    const photo = node.querySelector(".photo-wrap");
    if (product.image) {
      img.src = encodeURI(product.image);
      img.alt = product.description;
    } else {
      photo.classList.add("missing");
    }

    const badge = node.querySelector(".badge");
    badge.textContent = product.tableKind === "promo" ? "Promo" : "Vigente";
    badge.classList.toggle("promo", product.tableKind === "promo");

    node.querySelector(".code").textContent = `Código ${product.code}`;
    node.querySelector(".box-chip").textContent = `CX ${product.boxQty}`;
    node.querySelector("h3").textContent = product.description;
    node.querySelector(".price").textContent = BRL.format(product.price);
    node.querySelector(".box").textContent = `${product.boxQty} un.`;
    node.querySelector(".ipi").textContent = `${product.ipi.toFixed(2)}%`;
    node.querySelector(".delivery").textContent = product.delivery;
    node.querySelector("output").textContent = productQty(product.id);

    node.querySelector(".minus").addEventListener("click", () => {
      setProductQty(product, productQty(product.id) - product.boxQty);
    });
    node.querySelector(".plus").addEventListener("click", () => {
      setProductQty(product, productQty(product.id) + product.boxQty);
    });

    fragment.appendChild(node);
  });

  els.grid.appendChild(fragment);
  els.resultCount.textContent = `${state.filtered.length} produtos`;
}

function cartRows() {
  return Array.from(state.cart.values()).sort((a, b) => {
    return a.product.tableKind.localeCompare(b.product.tableKind) || Number(a.product.code) - Number(b.product.code);
  });
}

function renderCart() {
  const rows = cartRows();
  els.cartItems.textContent = "";
  els.cartItems.classList.toggle("empty", rows.length === 0);

  if (!rows.length) {
    els.cartItems.textContent = "Nenhum item adicionado.";
  } else {
    rows.forEach(({ product, qty }) => {
      const line = document.createElement("div");
      line.className = "cart-line";
      line.innerHTML = `
        <div>
          <strong>${product.code} - ${product.description}</strong>
          <span>${qty} un. | ${qty / product.boxQty} cx | ${BRL.format(qty * product.price)}</span>
        </div>
        <button type="button" title="Remover item">x</button>
      `;
      line.querySelector("button").addEventListener("click", () => setProductQty(product, 0));
      els.cartItems.appendChild(line);
    });
  }

  const totalUnits = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalBoxes = rows.reduce((sum, row) => sum + row.qty / row.product.boxQty, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.qty * row.product.price, 0);

  els.totalUnits.textContent = totalUnits;
  els.totalBoxes.textContent = totalBoxes;
  els.totalValue.textContent = BRL.format(totalValue);
  els.cartCount.textContent = `${rows.length} itens no pedido`;
  els.mobileCartText.textContent = `${rows.length} ${rows.length === 1 ? "item" : "itens"}`;
  els.mobileCartTotal.textContent = BRL.format(totalValue);
  els.mobileCartBar.classList.toggle("has-items", rows.length > 0);
}

function buildOrderText() {
  const rows = cartRows();
  const totalValue = rows.reduce((sum, row) => sum + row.qty * row.product.price, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalBoxes = rows.reduce((sum, row) => sum + row.qty / row.product.boxQty, 0);

  const lines = [
    "Pedido B2B Dermiwil BabyGo",
    "",
    `Loja: ${customerFields.storeName.value || "-"}`,
    `CNPJ: ${customerFields.storeDoc.value || "-"}`,
    `CEP: ${customerFields.storeZip.value || "-"}`,
    `Endereço: ${customerFields.storeAddress.value || "-"}`,
    `Contato: ${customerFields.contactName.value || "-"}`,
    `Email: ${customerFields.contactEmail.value || "-"}`,
    `Telefone: ${customerFields.contactPhone.value || "-"}`,
    `Representante: ${els.representative.value || "-"}`,
    "",
    "Itens:",
    ...rows.map(({ product, qty }) => {
      const boxes = qty / product.boxQty;
      return `${product.code} | ${product.description} | ${product.tableLabel} | ${qty} un. (${boxes} cx de ${product.boxQty}) | ${BRL.format(product.price)} | ${BRL.format(qty * product.price)}`;
    }),
    "",
    `Total de unidades: ${totalUnits}`,
    `Total de caixas: ${totalBoxes}`,
    `Total do pedido: ${BRL.format(totalValue)}`,
    "",
    `Observações: ${customerFields.notes.value || "-"}`,
  ];

  return lines.join("\n");
}

function validateOrder() {
  if (!state.cart.size) return "Adicione pelo menos um item ao pedido.";
  if (!els.representative.value) return "Selecione o representante que atendeu.";
  if (!customerFields.storeName.value.trim()) return "Informe o nome da loja.";
  return "";
}

function generateEmail() {
  const error = validateOrder();
  if (error) {
    alert(error);
    return;
  }

  const subject = `Pedido B2B - ${customerFields.storeName.value}`;
  const body = buildOrderText();
  const to = ORDER_RECIPIENT_EMAIL;
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function sendWhatsApp() {
  const error = validateOrder();
  if (error) {
    alert(error);
    return;
  }

  const body = buildOrderText();
  const encoded = encodeURIComponent(body);
  let url;
  if (ORDER_RECIPIENT_WHATSAPP) {
    // open chat with specific number
    url = `https://wa.me/${ORDER_RECIPIENT_WHATSAPP}?text=${encoded}`;
  } else {
    // generic share (user chooses contact)
    url = `https://wa.me/?text=${encoded}`;
  }

  window.open(url, "_blank");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openPhotoOrder() {
  const error = validateOrder();
  if (error) {
    alert(error);
    return;
  }

  const rows = cartRows();
  const totalValue = rows.reduce((sum, row) => sum + row.qty * row.product.price, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.qty, 0);
  const totalBoxes = rows.reduce((sum, row) => sum + row.qty / row.product.boxQty, 0);

  const itemRows = rows.map(({ product, qty }) => {
    const imageUrl = product.image ? new URL(product.image, window.location.href).href : "";
    const image = imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(product.description)}">` : "<span>Sem imagem</span>";
    return `
      <tr>
        <td class="photo">${image}</td>
        <td>
          <strong>${escapeHtml(product.code)}</strong><br>
          ${escapeHtml(product.description)}<br>
          <small>${escapeHtml(product.tableLabel)} | Entrega: ${escapeHtml(product.delivery)} | IPI: ${product.ipi.toFixed(2)}%</small>
        </td>
        <td>${product.boxQty}</td>
        <td>${qty}</td>
        <td>${qty / product.boxQty}</td>
        <td>${BRL.format(product.price)}</td>
        <td>${BRL.format(qty * product.price)}</td>
      </tr>
    `;
  }).join("");

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Pedido B2B Dermiwil BabyGo</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #17202a; }
          header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #d9dee6; padding-bottom: 16px; margin-bottom: 18px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #d9dee6; padding: 8px; text-align: left; vertical-align: middle; font-size: 12px; }
          th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
          small { color: #647386; }
          .photo { width: 74px; }
          .photo img { width: 64px; height: 64px; object-fit: contain; }
          .totals { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .totals div { background: #f1f5f9; padding: 12px; }
          .actions { margin: 18px 0; }
          button { min-height: 38px; border: 1px solid #0f766e; background: #0f766e; color: white; border-radius: 6px; font-weight: 700; cursor: pointer; }
          @media print { .actions { display: none; } body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>Pedido B2B Dermiwil BabyGo</h1>
            <p><strong>Loja:</strong> ${escapeHtml(customerFields.storeName.value || "-")}</p>
            <p><strong>CNPJ:</strong> ${escapeHtml(customerFields.storeDoc.value || "-")}</p>
            <p><strong>CEP:</strong> ${escapeHtml(customerFields.storeZip.value || "-")}</p>
            <p><strong>Endereço:</strong> ${escapeHtml(customerFields.storeAddress.value || "-")}</p>
            <p><strong>Contato:</strong> ${escapeHtml(customerFields.contactName.value || "-")} | ${escapeHtml(customerFields.contactPhone.value || "-")}</p>
            <p><strong>Email:</strong> ${escapeHtml(customerFields.contactEmail.value || "-")}</p>
          </div>
          <div>
            <p><strong>Representante:</strong> ${escapeHtml(els.representative.value || "-")}</p>
            <p><strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </header>
        <div class="actions"><button onclick="window.print()">Imprimir ou salvar PDF</button></div>
        <table>
          <thead>
            <tr>
              <th>Foto</th>
              <th>Produto</th>
              <th>CX</th>
              <th>Un.</th>
              <th>Caixas</th>
              <th>Preço</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <section class="totals">
          <div><strong>${totalUnits}</strong><br>unidades</div>
          <div><strong>${totalBoxes}</strong><br>caixas</div>
          <div><strong>${BRL.format(totalValue)}</strong><br>total</div>
        </section>
        <p><strong>Observações:</strong> ${escapeHtml(customerFields.notes.value || "-")}</p>
      </body>
    </html>
  `;

  const orderWindow = window.open("", "_blank");
  if (!orderWindow) {
    alert("Permita pop-ups para abrir o pedido com fotos.");
    return;
  }
  orderWindow.document.write(html);
  orderWindow.document.close();
}

async function copyOrder() {
  const error = validateOrder();
  if (error) {
    alert(error);
    return;
  }
  await navigator.clipboard.writeText(buildOrderText());
  alert("Resumo do pedido copiado.");
}

async function init() {
  const response = await fetch("data/products.json");
  state.products = await response.json();
  els.promoCount.textContent = state.products.filter((product) => product.tableKind === "promo").length;
  els.regularCount.textContent = state.products.filter((product) => product.tableKind === "vigente").length;
  state.filtered = state.products;
  applyFilters();
  renderCart();
}

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  applyFilters();
});

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    applyFilters();
  });
});

els.previewOrder.addEventListener("click", openPhotoOrder);
els.emailOrder.addEventListener("click", generateEmail);
els.whatsappOrder.addEventListener("click", sendWhatsApp);
els.copyOrder.addEventListener("click", copyOrder);
els.printOrder.addEventListener("click", () => window.print());
els.mobileCartBar.addEventListener("click", () => {
  els.orderPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

init().catch((error) => {
  console.error(error);
  els.grid.textContent = "Não foi possível carregar os produtos.";
});
