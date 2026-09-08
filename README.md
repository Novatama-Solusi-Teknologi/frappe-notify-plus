# Notify Plus for Frappe / ERPNext

App Frappe untuk mengatur toast dan suara **per Notification**. Target kompatibilitas: Frappe v15/v16; ERPNext opsional. Versi 0.1.2. Pengujian pada site Frappe nyata masih diperlukan sebelum produksi.

## Fitur

| Pengaturan | Pilihan |
| --- | --- |
| Style | Minimal, Accent (garis samping), Solid (warna penuh), Glass, Banner |
| Tone | Info, Success, Warning, Danger |
| Posisi | Top Right, Top Left, Bottom Right, Bottom Left |
| Durasi | 1–60 detik, atau 0 sampai ditutup |
| Suara | None, Chime, Bell, Pulse, Custom |
| Custom audio | Upload MP3/WAV/OGG publik, maksimal 2 MB |
| Volume | 0–100% |

Profil reusable, preview toast dan suara, mute per browser/pengguna, dukungan dark mode dan reduced motion, pause auto-dismiss saat hover/fokus, serta klik toast/tombol untuk membuka record terkait (fallback ke Notification Log jika tidak ada referensi). Teks notifikasi ditampilkan sebagai plain text untuk mencegah injeksi HTML. Maksimal lima toast per posisi; riwayat tetap tersimpan di notification bell bawaan.

## Instalasi dari GitHub ke Frappe Cloud

1. Buat repository GitHub, misalnya `frappe_notify_plus`.
2. Upload **isi folder project ini** ke root repository. `pyproject.toml` harus berada langsung di root, bukan di dalam folder pembungkus tambahan.
3. Di Frappe Cloud, gunakan bench group yang mendukung custom apps (private bench). Tambahkan app dari repository GitHub dan branch yang dipilih. Beri integrasi GitHub Frappe Cloud akses ke repository tersebut.
4. Deploy/update bench group, lalu install app **frappe_notify_plus** di site.
5. Jalankan migrasi melalui proses update Frappe Cloud jika diperlukan, lalu hard refresh Desk agar assets termuat.

Referensi resmi: [Custom app](https://docs.frappe.io/cloud/benches/custom-app), [Installing an app](https://docs.frappe.io/cloud/installing-an-app).

Untuk menyiapkan Git lokal (ganti URL contoh setelah membuat repository):

```bash
cd /path/to/frappe_notify_plus
git init -b main
git add .
git commit -m "Initial Notify Plus app"
git remote add origin https://github.com/YOUR_ORG/frappe_notify_plus.git
git push -u origin main
```

## Instalasi bench lokal

```bash
bench get-app https://github.com/YOUR_ORG/frappe_notify_plus.git
bench --site your-site install-app frappe_notify_plus
bench build --app frappe_notify_plus
bench --site your-site migrate
```

## Konfigurasi

1. Login sebagai **System Manager**. Cari **Notification Style** lewat Awesome Bar, atau buka `/app/notification-style`.
2. Buat profil, misalnya `Approval Penting`, pilih Accent / Warning / Top Right / 10 detik / Bell.
3. Klik **Preview Toast & Sound**. Preview juga dapat dipakai sebelum menyimpan; preview tidak mengirim notifikasi ke pengguna lain. Jika browser sedang mute, unmute terlebih dahulu.
4. Buka **Notification** yang sudah ada atau buat baru. Isi document type, event, condition, subject/message dan recipients seperti biasa.
5. Pilih channel **System Notification**, atau aktifkan **Send System Notification** pada channel lain jika opsi itu tersedia pada versi Anda.
6. Pada bagian **Notify Plus**, pilih **Notification Style**, kemudian simpan.
7. Penerima membuka Desk dan klik **Enable sound**. Trigger event dokumen yang memenuhi kondisi Notification.

Contoh: satu Notification untuk Purchase Order yang membutuhkan persetujuan memakai Warning + Bell, sementara Notification untuk pembayaran selesai memakai Success + Chime. Keduanya dapat menunjuk profil berbeda, bahkan pada DocType yang sama.

Untuk Custom Sound: upload file **public**, simpan, lalu preview. File public dapat diakses siapa pun yang mengetahui URL-nya; gunakan audio tanpa data rahasia. Audio private tidak didukung karena penerima belum tentu punya akses ke profil konfigurasi. Format OGG bergantung pada dukungan browser. Suara bawaan disintesis memakai Web Audio, tanpa unduhan atau dependensi eksternal.

## Cara kerja dan batasan

- Core Frappe tetap mengevaluasi event, condition, recipients, email/SMS/Slack. App mengganti `Notification.create_system_notification` hanya ketika profil aktif dipilih, menambahkan identitas profil ke payload Notification Log. Tanpa profil atau profil nonaktif, metode core dipakai langsung.
- Pekerjaan pembuatan log diantrekan setelah transaksi asal commit. Hook `Notification Log.after_insert` mengirim event realtime `notify_plus` **hanya ke for_user** dan setelah commit. Worker/Redis/realtime Frappe harus berfungsi.
- Pengiriman memakai helper Notification Log bawaan sehingga pengaturan penerima/notifikasi Frappe tetap berlaku. Toast tidak mengirim ulang email atau membuat log kedua.
- Toast dan audio tersedia di **Desk browser yang sedang terhubung**. Ini bukan push OS/mobile. Saat offline tidak ada replay toast/suara; lihat riwayat bell ketika kembali online. Setiap tab Desk yang terhubung dapat menampilkan dan membunyikan notifikasi; gunakan mute bila perlu.
- Browser membutuhkan klik Enable sound atau Preview sebelum audio diizinkan. Preferensi enabled/muted tersimpan di localStorage per pengguna dan disinkronkan antar tab. Setelah reload, app mencoba mengaktifkan audio otomatis; jika autoplay diblokir browser, klik atau tekan tombol keyboard di Desk akan mengaktifkannya tanpa perlu menekan Enable sound lagi. Status tombol tetap mengikuti preferensi tersimpan. Tidak ada suara saat semua tab tertutup.
- Tampilan ini tidak mengganti `frappe.msgprint`, alert validasi, toast lain, atau suara bawaan dari app lain. Assignment/mention yang tidak berasal dari Notification terhubung tidak dikustomisasi.
- Hanya System Manager mengelola profil. Membuka dokumen/log tetap mengikuti permission Frappe. Payload tidak membawa daftar penerima.
- App memakai `override_doctype_class` untuk Notification; app lain yang juga mengoverride controller ini harus diperiksa untuk konflik. Isi payload core bisa berubah antar patch Frappe, sehingga jalankan checklist staging setelah upgrade.
- Uninstall menghapus custom field milik app melalui hook; data profil dihapus oleh proses uninstall Frappe. Backup terlebih dahulu jika ingin menyimpan konfigurasi.

## Verifikasi

Pemeriksaan tanpa bench:

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q frappe_notify_plus
node --check frappe_notify_plus/public/js/notify_plus.js
node --test tests/test_frontend.cjs
python3 -m pip install build
python3 -m build
```

Checklist **site staging v15/v16** sebelum produksi:

- Install bersih, migrate dua kali, pastikan Notification Style dan link di Notification tersedia.
- Preview kelima style; cek posisi, dark mode, keyboard/Escape, durasi 0, volume 0, mute, audio upload.
- Buat dua user penerima, satu nonpenerima; trigger Notification System pada dokumen test. Hanya penerima mendapat toast dan log, tepat satu per penerima.
- Uji dua Notification berbeda pada dokumen sama dengan profil berbeda; profil tidak tertukar.
- Uji channel Email + Send System Notification, role recipient, condition, dan scheduled event Days Before/After.
- Hapus pilihan profil/nonaktifkan profil; pastikan notifikasi core tetap berjalan tanpa custom toast.
- Rollback transaksi dokumen; pastikan tidak ada log/toast dari transaksi tersebut.
- Uji user dengan notifikasi dinonaktifkan, penerima offline, reload, multi-tab, dan koneksi realtime terputus.
- Uji uninstall di site disposable.

CI memeriksa validasi konfigurasi, integrasi via mock, syntax JS/Python dan build paket. CI ini tidak menjalankan server Frappe, database, Redis, atau browser; hasilnya bukan sertifikasi kompatibilitas site.
# frappe-notify-plus

## Update 0.1.1

- Enable/mute/unmute disimpan per pengguna di localStorage (`notify-plus-sound:<user>`). Preferensi mute versi sebelumnya tetap dibaca. Perubahan disinkronkan ke tab lain pada origin dan pengguna yang sama.
- Preferensi enabled dipulihkan saat reload. Jika browser menahan autoplay, interaksi biasa di Desk mencoba mengaktifkan audio kembali tanpa mengubah preferensi.
- Klik badan toast atau Open document membuka `document_type` + `document_name` dari Notification Log; jika referensi tidak lengkap, fallback ke log. Tombol tutup tetap hanya menutup toast.
- Setelah push ke GitHub, deploy update app di Frappe Cloud (termasuk assets), kemudian hard refresh satu kali agar JavaScript terbaru termuat. Uji enable → refresh, mute → refresh, unmute → refresh, serta klik toast dari Notification yang terhubung ke record.

## Update 0.1.2 — restore preferensi setelah reload

Inisialisasi sekarang menunggu DOM ready atau event `app_ready`, lalu mengambil identitas dari `frappe.boot.user.name` dengan fallback ke session. Tidak membaca/menulis preferensi untuk user yang belum tersedia atau Guest. Ini mencegah key `undefined` dan perbedaan key akibat urutan startup Desk. URL JavaScript diberi versi untuk mengganti cache asset 0.1.1.

Setelah deploy 0.1.2, reload Desk. Jika pilihan lama dahulu tersimpan dengan identitas yang belum tersedia, pilih Enable sound sekali lagi untuk menyimpannya pada key pengguna yang benar. Key ambigu tersebut tidak dipindahkan otomatis karena tidak bisa dipastikan pemiliknya. Reload berikutnya harus mempertahankan status. Jika browser menolak penyimpanan, app sekarang memberi pesan.

Untuk memastikan asset terbaru termuat, jalankan `frappe.notify_plus.version` di browser console: hasilnya harus `0.1.2`. Jika masih versi lama atau undefined, pastikan deploy app selesai dan cache site/assets sudah diperbarui. Verifikasi preferensi memakai `localStorage.getItem("notify-plus-sound:" + frappe.boot.user.name)`; nilai yang diharapkan `enabled` atau `muted`.
