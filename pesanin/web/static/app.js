// Sedikit JavaScript untuk dashboard Pesanin (tanpa build step).

function tampilkanToast(pesan, aksi) {
  const el = document.getElementById("toast");
  el.textContent = pesan;
  if (aksi) {
    const tombol = document.createElement("button");
    tombol.textContent = aksi.label;
    tombol.className = "ml-3 font-semibold text-orange-300 underline";
    tombol.onclick = () => {
      el.classList.add("hidden");
      aksi.fungsi();
    };
    el.appendChild(tombol);
  }
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), aksi ? 7000 : 2500);
}

async function salinTeks(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    // Cadangan untuk browser lama atau halaman non-HTTPS.
    const area = document.createElement("textarea");
    area.value = teks;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

async function ubahStatus(id, status) {
  const res = await fetch(`/api/prospek/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.pesan || "Gagal mengubah status");
  document.querySelectorAll(`[data-ubah-status="${id}"]`).forEach((el) => {
    el.value = data.status;
    el.dataset.status = data.status;
  });
  const label = document.querySelector(`[data-dihubungi="${id}"]`);
  if (label && data.terakhir_dihubungi) label.textContent = `Dihubungi ${data.terakhir_dihubungi}`;
  return data;
}

function statusSekarang(id) {
  const el = document.querySelector(`[data-ubah-status="${id}"]`) || document.querySelector("select[name=status]");
  return el ? el.value : null;
}

function tawarkanTandaiDm(id) {
  if (statusSekarang(id) !== "baru") return null;
  return {
    label: "Tandai Sudah DM",
    fungsi: async () => {
      try {
        await ubahStatus(id, "sudah_dm");
        const pilih = document.querySelector("select[name=status]");
        if (pilih && !document.querySelector(`[data-ubah-status="${id}"]`)) location.reload();
        else tampilkanToast("Status: Sudah DM");
      } catch (e) {
        tampilkanToast(e.message);
      }
    },
  };
}

document.addEventListener("change", async (ev) => {
  const el = ev.target.closest("[data-ubah-status]");
  if (!el) return;
  const sebelumnya = el.dataset.status;
  try {
    const data = await ubahStatus(el.dataset.ubahStatus, el.value);
    tampilkanToast(`Status: ${data.label}`);
  } catch (e) {
    el.value = sebelumnya;
    tampilkanToast(e.message);
  }
});

document.addEventListener("click", async (ev) => {
  const salin = ev.target.closest("[data-salin], [data-salin-dari]");
  if (salin) {
    const teks = salin.dataset.salinDari
      ? document.querySelector(salin.dataset.salinDari).value
      : salin.dataset.salin;
    if (!teks.trim()) return tampilkanToast("Draf DM masih kosong.");
    const ok = await salinTeks(teks);
    tampilkanToast(ok ? "Draf DM disalin. Tempel di DM Instagram." : "Gagal menyalin, salin manual.", ok && tawarkanTandaiDm(salin.dataset.id));
    return;
  }

  const wa = ev.target.closest("[data-wa-dari]");
  if (wa) {
    // Pakai isi draf terbaru (walau belum disimpan).
    const teks = document.querySelector(wa.dataset.waDari).value.trim();
    wa.href = `https://wa.me/${wa.dataset.wa}` + (teks ? `?text=${encodeURIComponent(teks)}` : "");
    return;
  }

  const hariIni = ev.target.closest("[data-isi-hari-ini]");
  if (hariIni) {
    const d = new Date();
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    document.querySelector(hariIni.dataset.isiHariIni).value = iso;
  }
});
