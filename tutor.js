(function () {
  const steps = [
    {
      title: "⏱ Panel Waktu Simulasi",
      body: `Waktu simulasi berjalan dari <strong>Senin hingga Minggu</strong> lalu berulang otomatis.
             <br><br>
             Gunakan tombol <strong>◀ -1 Jam</strong> / <strong>+1 Jam ▶</strong> untuk melompat maju atau mundur.
             <br><br>
             Tekan dan tahan ikon <strong>⏳</strong> untuk memperlambat simulasi (30 detik → 5 detik per tick). Lepas untuk kembali ke kecepatan normal.`
    },
    {
      title: "📋 Jadwal & Kontrol Ruangan",
      body: `Panel ini menampilkan jadwal penggunaan ruangan yang dibuat otomatis untuk simulasi — tiga lantai, masing-masing tiga kelas.
             <br><br>
             Gunakan <strong>ikon ×</strong> pada jadwal untuk menghapus entri, atau tambahkan jadwal manual lewat form di bawahnya.
             <br><br>
             Aktifkan <strong>Buffer 10 Menit</strong> agar lampu menyala 10 menit sebelum kelas mulai dan padam 10 menit setelah selesai.`
    },
    {
      title: "🏢 Denah Ruangan",
      body: `Area utama menampilkan denah setiap lantai. Lampu tiap ruangan akan <strong>menyala atau mati</strong> sesuai jadwal yang aktif.
             <br><br>
             Amati perubahan status lampu secara real-time. Jika simulasi terasa terlalu cepat, gunakan ikon <strong>⏳</strong> di panel atas untuk memperlambat agar lebih mudah diamati.`
    },
    {
      title: "🗂 Ringkasan Lantai",
      body: `Ribbon bawah menampilkan <strong>miniatur status</strong> semua lantai sekaligus.
             <br><br>
             Klik salah satu lantai (<strong>F1 / F2 / F3</strong>) untuk menampilkan detail denah lantai tersebut di panel utama.`
    },
    {
      title: "📡 Log API Middleware",
      body: `Panel kiri mencatat semua perintah API yang dikirim oleh middleware ke sistem lampu.
             <br><br>
             Proses ini berjalan <strong>setiap menit</strong>: middleware membaca seluruh status lampu, mencocokkannya dengan jadwal, lalu mengirim perintah koreksi agar kondisi ruangan sesuai yang diharapkan.
             <br><br>
             Jika ada kegagalan jaringan atau gangguan aplikasi, sistem akan <strong>retry otomatis</strong> pada menit berikutnya.`
    }
  ];

  const targets = ['#top-ribbon', '#control-panel', '#canvas-grid', '#bottom-ribbon', '#left-panel'];
  let current = 0;

  const card   = document.getElementById('tutor-card');
  const badge  = document.getElementById('tutor-badge');
  const title  = document.getElementById('tutor-title');
  const body   = document.getElementById('tutor-body');
  const dotsEl = document.getElementById('tutor-dots');
  const nextBtn= document.getElementById('tutor-next');

  function buildDots() {
    dotsEl.innerHTML = '';
    steps.forEach((_, i) => {
      const d = document.createElement('span');
      if (i === current) d.classList.add('active');
      dotsEl.appendChild(d);
    });
  }

  function showStep(idx) {
    const s = steps[idx];
    badge.textContent = `Langkah ${idx + 1} / ${steps.length}`;
    title.textContent = s.title;
    body.innerHTML   = s.body;
    nextBtn.textContent = idx === steps.length - 1 ? 'Selesai ✓' : 'Lanjut →';
    buildDots();

    // Swap body classes: remove old step, add new
    document.body.classList.remove(...steps.map((_, i) => `s${i + 1}`));
    document.body.classList.add(`s${idx + 1}`);
  }

  function advance() {
    if (current < steps.length - 1) {
      current++;
      showStep(current);
    } else {
      endTutorial();
    }
  }

  function endTutorial() {
    document.body.classList.remove('tutor', ...steps.map((_, i) => `s${i + 1}`));
    card.classList.remove('visible');
  }

  function startTutorial() {
    current = 0;
    document.body.classList.add('tutor');
    card.classList.add('visible');
    showStep(0);
  }

  nextBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    advance();
  });

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startTutorial);
} else {
  startTutorial(); // DOM already ready, just run it
}
})();