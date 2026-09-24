import React, { useState } from 'react';
import {
  FileText,
  RotateCcw,
  Phone,
  Shield,
  X,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { getAdminWhatsapp } from '../services/adminContactService';

export type LegalTab = 'terms' | 'refund' | 'contact' | 'privacy';

interface LegalInfoModalProps {
  isOpen: boolean;
  initialTab?: LegalTab;
  onClose: () => void;
}

export const LegalInfoModal: React.FC<LegalInfoModalProps> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);
  const adminPhone = getAdminWhatsapp();

  // Format admin phone number for display
  const formattedAdminPhone = adminPhone.startsWith('62')
    ? '+' + adminPhone
    : adminPhone.startsWith('0')
    ? '+62 ' + adminPhone.slice(1)
    : adminPhone;

  const waContactUrl = `https://wa.me/${adminPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    'Halo Admin AimBoth, saya ingin bertanya seputar layanan photobooth / status sesi foto saya.'
  )}`;

  // Sync initial tab when changed
  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0f111a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Informasi Resmi & Kebijakan Layanan
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                AimBoth • photobooth.aimspace.my.id
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-950/70 border-b border-zinc-800/60 overflow-x-auto text-xs font-medium scrollbar-none">
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Syarat & Ketentuan</span>
          </button>

          <button
            onClick={() => setActiveTab('refund')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'refund'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kebijakan Pengembalian (Refund)</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Kebijakan Privasi</span>
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'contact'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Hubungi Kami</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-sm leading-relaxed text-zinc-300">
          {/* TAB 1: SYARAT DAN KETENTUAN */}
          {activeTab === 'terms' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Syarat dan Ketentuan Layanan
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Terakhir diperbarui: September 2026 • Berlaku untuk seluruh pengguna layanan AimBoth di platform photobooth.aimspace.my.id
                </p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    1. Penerimaan Ketentuan
                  </h4>
                  <p className="text-zinc-400">
                    Dengan mengakses, menggunakan, atau melakukan transaksi pembayaran pada kiosk photobooth digital <strong className="text-zinc-200">AimBoth</strong> (<span className="font-mono text-zinc-300">photobooth.aimspace.my.id</span>), Anda menyatakan telah membaca, memahami, dan menyetujui untuk terikat oleh seluruh Syarat dan Ketentuan ini.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    2. Deskripsi Layanan & Pilihan Paket
                  </h4>
                  <p className="text-zinc-400 mb-2">
                    AimBoth menyediakan sistem photobooth interaktif mandiri (self-service) yang mencakup pengambilan pose foto, filter warna real-time, pemasangan bingkai tematik (frame overlay), stiker dekorasi, dan preview hasil foto. Layanan tersedia dalam opsi paket:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
                    <li>
                      <strong className="text-zinc-200">Paket Digital Softfile HD:</strong> Layanan sesi foto di mana file digital beresolusi tinggi (300 DPI) asli tanpa watermark beserta video boomerang dikirimkan langsung oleh admin resmi ke nomor WhatsApp pengguna setelah transaksi terverifikasi. Paket ini tidak mencakup cetak fisik.
                    </li>
                    <li>
                      <strong className="text-zinc-200">Paket Cetak Fisik + Softfile HD:</strong> Layanan komplit yang mencakup pencetakan lembar photo strip fisik tebal glossy di lokasi booth serta bonus pengiriman seluruh softfile digital asli HD via WhatsApp oleh admin.
                    </li>
                    <li>
                      <strong className="text-zinc-200">Sesi Bersponsor / Gratis:</strong> Pada event yang disewa penuh atau disponsori pihak penyelenggara, seluruh layanan dapat dinikmati secara gratis (Rp 0) tanpa biaya tambahan kepada tamu.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    3. Kebijakan Transaksi & Pembayaran
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
                    <li>Semua transaksi dinyatakan dalam mata uang Rupiah (IDR).</li>
                    <li>Metode pembayaran yang didukung meliputi pembayaran <strong className="text-zinc-200">Tunai</strong> langsung di meja kasir photobooth dan pembayaran non-tunai melalui <strong className="text-zinc-200">QRIS</strong> (GoPay, OVO, Dana, BCA, Mandiri Livin, ShopeePay, LinkAja, dll).</li>
                    <li>Proses cetak lembar fisik dan pengiriman softfile digital HD melalui WhatsApp akan diproses oleh tim kasir/admin setelah pembayaran terkonfirmasi lunas.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    4. Hak Cipta & Pengiriman File via WhatsApp
                  </h4>
                  <p className="text-zinc-400">
                    Pengguna memegang hak cipta penuh atas foto pribadi yang diambil. AimBoth menjamin tidak akan menyebarluaskan atau memperjualbelikan foto pengguna kepada pihak ketiga. Nomor WhatsApp yang digunakan oleh pelanggan saat menghubungi admin semata-mata dimanfaatkan untuk mentransfer file foto/video hasil sesi dan bukti transaksi.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    5. Tata Tertib Penggunaan Kiosk
                  </h4>
                  <p className="text-zinc-400">
                    Pengguna dilarang berpose atau memasukkan konten yang melanggar hukum, norma kesusilaan (pornografi), kekerasan, atau ujaran kebencian. Operator booth berhak menolak mencetak atau meneruskan konten yang melanggar peraturan perundang-undangan Republik Indonesia.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KEBIJAKAN PENGEMBALIAN (REFUND) */}
          {activeTab === 'refund' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                  Kebijakan Pengembalian Dana (Refund & Cancellation Policy)
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Jaminan kepuasan pelanggan dan transparansi layanan AimBoth
                </p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white text-xs sm:text-sm">
                      Garansi Uang Kembali 100% Jika Terjadi Kendala Teknis
                    </span>
                    <span className="text-xs text-zinc-300">
                      Kami menjamin pengembalian dana penuh tanpa potongan apabila terjadi kegagalan sistem teknis pada kiosk atau pengiriman file kami.
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    1. Kondisi yang Berhak Mendapatkan Pengembalian Dana (Refund):
                  </h4>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
                    <li>
                      <strong className="text-zinc-200">Gagal Cetak Fisik (Paket Cetak):</strong> Pembayaran telah lunas namun mesin cetak mengalami kerusakan teknis (kertas habis, paper jam, tinta rusak) dan operator tidak dapat mencetak ulang foto fisik Anda di lokasi. Pengguna berhak meminta pengembalian penuh atau penyesuaian tarif menjadi Paket Digital.
                    </li>
                    <li>
                      <strong className="text-zinc-200">Gagal Pengiriman Softfile Digital:</strong> Terjadi kendala teknis pada sistem penyimpanan atau jaringan sehingga admin tidak dapat mengirimkan file digital HD Anda via WhatsApp dalam waktu wajar setelah sesi selesai.
                    </li>
                    <li>
                      <strong className="text-zinc-200">Pembayaran Ganda (Double Charge):</strong> Saldo Anda terpotong lebih dari satu kali untuk nomor tiket sesi yang sama akibat gangguan jaringan perbankan/QRIS.
                    </li>
                    <li>
                      <strong className="text-zinc-200">Sistem Mati / Listrik Padam:</strong> Kiosk mati mendadak sebelum proses pemotretan atau pemrosesan hasil foto terselesaikan.
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <X className="w-4 h-4 text-rose-400" />
                    2. Kondisi yang Tidak Dapat Dikembalikan (Non-Refundable):
                  </h4>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
                    <li>Foto fisik telah berhasil dicetak dengan baik dan/atau softfile HD telah berhasil dikirimkan ke WhatsApp pengguna.</li>
                    <li>Ketidakpuasan pose pribadi, ekspresi wajah, atau salah memilih desain bingkai/filter yang ditentukan secara mandiri oleh pengguna selama sesi.</li>
                    <li>Pembatalan sepihak setelah foto diproses atau dicetak oleh mesin.</li>
                    <li>Kesalahan penulisan nomor WhatsApp oleh pengguna (namun admin akan dengan senang hati mengirimkan ulang ke nomor yang benar begitu pengguna mengonfirmasi).</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    3. Alur & Prosedur Klaim Pengembalian Dana:
                  </h4>
                  <div className="bg-zinc-900/70 p-3.5 rounded-xl border border-zinc-800 space-y-2 text-zinc-300">
                    <p>
                      Klaim pengembalian dana dapat dilakukan secara mudah melalui salah satu cara berikut:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-zinc-400 ml-1">
                      <li>
                        <strong className="text-zinc-200">Langsung di Kasir Booth:</strong> Sampaikan kendala kepada kasir/operator booth yang bertugas untuk pengembalian dana tunai seketika di lokasi.
                      </li>
                      <li>
                        <strong className="text-zinc-200">Via WhatsApp Admin:</strong> Hubungi WhatsApp <span className="font-mono text-amber-300 font-semibold">{formattedAdminPhone}</span> dengan menyertakan Nomor Tiket Sesi dan bukti transaksi/kendala.
                      </li>
                      <li>
                        <strong className="text-zinc-200">Via Email Resmi:</strong> Kirimkan ke <span className="text-amber-400 font-semibold">mochamadhennysoeyono@gmail.com</span>.
                      </li>
                    </ul>
                    <p className="text-xs text-emerald-400 font-medium pt-1">
                      ⚡ Pengembalian dana tunai diproses seketika di kasir. Pengembalian via transfer bank/e-wallet diproses dalam waktu 1x24 jam hingga maksimal 3 hari kerja.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: KEBIJAKAN PRIVASI */}
          {activeTab === 'privacy' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400" />
                  Kebijakan Privasi (Privacy Policy)
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Komitmen perlindungan data pribadi dan privasi foto di AimBoth
                </p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-zinc-400">
                <p>
                  AimBoth sangat menghormati privasi setiap pengunjung. Kebijakan Privasi ini menjelaskan bagaimana data dan foto hasil sesi photobooth Anda dikelola secara aman dan bertanggung jawab.
                </p>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1">1. Data yang Dikumpulkan</h4>
                  <p>
                    Kami hanya mengumpulkan data yang mutlak diperlukan untuk operasional photobooth:
                  </p>
                  <ul className="list-disc list-inside space-y-1 mt-1 text-zinc-400 ml-1">
                    <li>Foto dan rekaman klip boomerang yang diambil selama sesi aktif di kiosk.</li>
                    <li>Informasi transaksi (Nomor Tiket Sesi, rincian paket, nominal, dan metode pembayaran).</li>
                    <li>Nomor WhatsApp kontak yang digunakan saat pengguna menghubungi admin untuk menerima softfile digital HD.</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1">2. Penggunaan Data & Komitmen Anti-Spam</h4>
                  <p>
                    Nomor WhatsApp Anda hanya digunakan secara eksklusif untuk mengirimkan file foto/video asli beresolusi tinggi dan bukti konfirmasi pemesanan. <strong className="text-zinc-200">Kami menjamin 100% TIDAK ADA SPAM:</strong> nomor Anda tidak akan pernah dijual, disebarkan, atau digunakan untuk pesan penawaran/marketing yang tidak diminta.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1">3. Keamanan & Retensi Penyimpanan Foto</h4>
                  <p>
                    Foto disimpan pada infrastruktur cloud terenkripsi semata-mata agar admin dapat mengirimkannya ke WhatsApp pengguna. Pengguna memiliki hak penuh untuk meminta penghapusan permanen file foto dari sistem penyimpanan cloud kami kapan saja dengan menghubungi admin.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-white text-sm mb-1">4. Keamanan Transaksi</h4>
                  <p>
                    Semua transmisi web dilindungi enkripsi SSL/TLS (HTTPS). Untuk pembayaran QRIS, seluruh verifikasi transaksi dilakukan melalui gerbang pembayaran berstandar keamanan Bank Indonesia (BI). AimBoth tidak pernah menyimpan data rahasia seperti PIN, OTP, atau nomor kartu perbankan pengguna.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HUBUNGI KAMI */}
          {activeTab === 'contact' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Phone className="w-5 h-5 text-amber-400" />
                  Hubungi Kami (Customer Support)
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Kontak resmi pengelola layanan AimBoth & Booth Operator
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Brand & Penanggung Jawab */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider">Nama Brand / Usaha</span>
                  <p className="text-sm font-bold text-white">AimBoth (AimSpace)</p>
                  <span className="text-xs text-zinc-400 block pt-1">
                    Penanggung Jawab: <strong className="text-zinc-200">Mochamad Henny Soeyono</strong>
                  </span>
                </div>

                {/* WhatsApp Admin Booth */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> WhatsApp Admin Booth
                  </span>
                  <a
                    href={waContactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs sm:text-sm font-semibold text-emerald-400 hover:underline break-all block"
                  >
                    {formattedAdminPhone}
                  </a>
                  <span className="text-[11px] text-zinc-400 block pt-1">
                    Untuk konfirmasi bayar & penerimaan softfile
                  </span>
                </div>

                {/* Email Dukungan */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email Dukungan Resmi
                  </span>
                  <a
                    href="mailto:mochamadhennysoeyono@gmail.com"
                    className="text-xs sm:text-sm font-semibold text-amber-300 hover:underline break-all block"
                  >
                    mochamadhennysoeyono@gmail.com
                  </a>
                  <span className="text-[11px] text-zinc-400 block pt-1">
                    Respons bantuan dalam 1-12 jam kerja
                  </span>
                </div>

                {/* Jam Operasional */}
                <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Jam Operasional Layanan
                  </span>
                  <p className="text-xs text-zinc-300 font-medium">
                    Kiosk Online: <strong className="text-white">24 Jam / 7 Hari</strong>
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Customer Support: Setiap Hari, 08:00 – 22:00 WIB
                  </p>
                </div>
              </div>

              {/* Quick Contact Form / WhatsApp & Mail CTA */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">Butuh Bantuan Langsung via WhatsApp?</h4>
                  <p className="text-[11px] text-zinc-400">Hubungi admin operator photobooth untuk klaim softfile atau pertanyaan teknis.</p>
                </div>
                <a
                  href={waContactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <MessageSquare className="w-3.5 h-3.5 fill-current" />
                  <span>Chat WhatsApp Admin</span>
                  <ArrowRight className="w-3 h-3 stroke-[3]" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-950 flex items-center justify-between text-xs text-zinc-500">
          <span>AimBoth © 2026 • Mochamad Henny Soeyono</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

