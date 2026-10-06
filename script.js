// ===== CONFIGURAÇÕES DA LOJA (edite aqui) =====
const CONFIG = {
  // Os botões "Comprar" apontam para o link de pagamento escrito no index.html
  produto: "Baby Ocean - Tapete de Água Inflável",
  preco: 80.0,
  // Coloque as fotos na pasta "images" com estes nomes.
  // Enquanto a foto não existir, aparece a ilustração do produto.
  fotos: [
    "images/produto-1.webp",
    "images/produto-2.jpg",
    "images/produto-3.jpg",
    "images/produto-4.jpg",
    "images/produto-5.jpg",
  ],
  // Dia das Crianças (horário de Brasília)
  dataEvento: "2026-10-12T00:00:00-03:00",
};

const FALLBACK = "images/ilustracao-tapete.svg";
const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ===== Galeria =====
const mainImage = document.getElementById("mainImage");
const thumbs = document.getElementById("thumbs");

function useFallback(img) {
  img.onerror = null;
  img.src = FALLBACK;
}

mainImage.onerror = () => useFallback(mainImage);
if (mainImage.complete && mainImage.naturalWidth === 0) useFallback(mainImage);

CONFIG.fotos.forEach((src, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "thumb" + (i === 0 ? " is-active" : "");
  btn.setAttribute("aria-label", `Ver foto ${i + 1}`);

  const img = document.createElement("img");
  img.src = src;
  img.alt = `${CONFIG.produto} - foto ${i + 1}`;
  img.loading = "lazy";
  // Esconde a miniatura se a foto ainda não foi adicionada (menos a primeira)
  img.onerror = () => {
    if (i === 0) return useFallback(img);
    btn.remove();
    // Com uma foto só, a miniatura não precisa aparecer
    thumbs.hidden = thumbs.children.length <= 1;
  };

  btn.appendChild(img);
  btn.addEventListener("click", () => {
    mainImage.onerror = () => useFallback(mainImage);
    mainImage.src = src;
    thumbs.querySelectorAll(".thumb").forEach((t) => t.classList.remove("is-active"));
    btn.classList.add("is-active");
  });
  thumbs.appendChild(btn);
});

// ===== Contagem regressiva =====
const alvo = new Date(CONFIG.dataEvento).getTime();
const countdown = document.getElementById("countdown");
const pad = (n) => String(n).padStart(2, "0");

function tick() {
  const diff = alvo - Date.now();
  if (diff <= 0) {
    countdown.hidden = true;
    return false;
  }
  const s = Math.floor(diff / 1000);
  document.getElementById("cd-dias").textContent = Math.floor(s / 86400);
  document.getElementById("cd-horas").textContent = pad(Math.floor((s % 86400) / 3600));
  document.getElementById("cd-min").textContent = pad(Math.floor((s % 3600) / 60));
  document.getElementById("cd-seg").textContent = pad(s % 60);
  return true;
}

if (tick()) {
  const timer = setInterval(() => {
    if (!tick()) clearInterval(timer);
  }, 1000);
}

// ===== Preço e ano =====
document.getElementById("priceNow").textContent = brl(CONFIG.preco);
document.getElementById("year").textContent = new Date().getFullYear();
