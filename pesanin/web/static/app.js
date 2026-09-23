// Sedikit JavaScript untuk dashboard Pesanin (tanpa build step).

function tampilkanToast(pesan, aksi) {
  const el = document.getElementById("toast");
  el.textContent = pesan;
  if (aksi) {
    const tombol = document.createElement("button");
    tombol.textContent = aksi.label;
    tombol.className = "ml-3 font-semibold text-orange-300 underline";
    tombol.onclick = aksi.fungsi;
    el.appendChild(tombol);
  }
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), aksi ? 6000 : 2500);
}
