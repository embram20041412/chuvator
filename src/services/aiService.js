import { GoogleGenAI } from '@google/genai';

// Retrieve API key from environment
const getApiKey = () => {
  const envKey = 
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    '';
  
  if (envKey && !envKey.includes('MY_GEMINI_API_KEY')) {
    return envKey;
  }
  return undefined;
};

/**
 * Sanitasi & Minimisasi Data: Mengubah raw database arena menjadi metrik agregat
 * tanpa menyertakan PII (Nama Lengkap, NIK, No. Telepon, Alamat Rumah)
 */
export const sanitizeArenaDataForAI = (arenaData) => {
  if (!arenaData) return {};

  const totalOmset = arenaData.metrikKeuangan?.totalOmset || 0;
  const totalTransaksi = arenaData.metrikKeuangan?.totalTransaksi || 0;
  const bookingList = Array.isArray(arenaData.bookings) ? arenaData.bookings : [];
  const courtList = Array.isArray(arenaData.courts) ? arenaData.courts : [];
  const studentList = Array.isArray(arenaData.students) ? arenaData.students : [];
  const classList = Array.isArray(arenaData.classes) ? arenaData.classes : [];
  const academyList = Array.isArray(arenaData.academies) ? arenaData.academies : [];
  const sppList = Array.isArray(arenaData.sppPayments) ? arenaData.sppPayments : [];

  // Hitung okupansi per lapangan tanpa identitas pelanggan
  const courtOccupancy = courtList.map((c, idx) => {
    const bookedSessions = bookingList.filter(
      (b) => b.courtId === c.id || b.courtName === c.name
    );
    return {
      courtId: `LAP-${idx + 1}`,
      cabor: c.sport || 'Umum',
      totalSesiTerjadwal: bookedSessions.length,
      tarifPerJam: Number(c.price || 0)
    };
  });

  // Metrik SPP agregat
  const sppMetrics = {
    totalLunas: sppList.filter((p) => p.status === 'PAID' || p.isPaid).length,
    totalMenunggak: sppList.filter((p) => p.status !== 'PAID' && !p.isPaid).length,
    nominalTerkumpul: sppList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  };

  // Sebaran usia siswa tanpa nama lengkap atau identitas wali
  const ageDistribution = studentList.reduce((acc, s) => {
    let age = s.age;
    if (!age && s.birthDate) {
      const birthYear = new Date(s.birthDate).getFullYear();
      if (!isNaN(birthYear)) {
        age = new Date().getFullYear() - birthYear;
      }
    }
    const groupKey = age ? `Usia ${age} Thn` : 'Usia Belum Terdata';
    acc[groupKey] = (acc[groupKey] || 0) + 1;
    return acc;
  }, {});

  // Sample slot waktu terisi (agregat jam & hari saja, tanpa nama customer)
  const aggregatedTimeSlots = bookingList.slice(0, 30).map((b, idx) => ({
    slotId: `S-${idx + 1}`,
    hari: b.date || '',
    jamMulai: b.startTime || '',
    jamSelesai: b.endTime || '',
    cabor: b.sport || 'Umum',
    status: b.status || 'confirmed'
  }));

  return {
    metrikFinansial: {
      totalOmset,
      totalTransaksi,
      nominalSppTerkumpul: sppMetrics.nominalTerkumpul
    },
    metrikOperasional: {
      jumlahLapanganTersedia: courtList.length,
      totalBookingAktif: bookingList.length,
      okupansiPerLapangan: courtOccupancy,
      sampleSlotJadwal: aggregatedTimeSlots
    },
    metrikAkademi: {
      jumlahAkademi: academyList.length,
      jumlahKelasLatihan: classList.length,
      totalSiswaAktif: studentList.length,
      distribusiKelompokUmur: ageDistribution,
      kepatuhanSpp: sppMetrics
    }
  };
};

export const generateBusinessInsights = async (arenaData) => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return "Fitur AI Insight membutuhkan API Key Gemini. Silakan konfigurasikan VITE_GEMINI_API_KEY pada environment.";
    }
    const ai = new GoogleGenAI({ apiKey });

    // 1. Guardrail: Cegah pemanggilan API jika data operasional masih kosong
    const hasBookings = arenaData?.bookings && arenaData.bookings.length > 0;
    const hasTransactions = arenaData?.transactions && arenaData.transactions.length > 0;
    const totalTxCount = arenaData?.metrikKeuangan?.totalTransaksi || 0;

    if (!arenaData || (!hasBookings && !hasTransactions && totalTxCount === 0)) {
      return "Data operasional Anda masih kosong. Silakan lakukan beberapa transaksi booking atau penjualan POS terlebih dahulu agar Chua Intelligence dapat memberikan analisa yang akurat.";
    }

    // 2. Data Minimization & Privacy Protection: Hanya kirim metrik agregat bersih tanpa PII
    const sanitizedPayload = sanitizeArenaDataForAI(arenaData);
    const promptData = JSON.stringify(sanitizedPayload);
    
    // 3. Gunakan format struktur array (role & parts) yang eksplisit & kebal error
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Berikut adalah ringkasan metrik operasional teranomisasi Sport Center: ${promptData}. Silakan berikan analisa performa bisnis dan rekomendasi optimasi.` }
          ]
        }
      ],
      config: {
        systemInstruction: "Anda adalah Senior Business Intelligence Engineer dan Valuator khusus manajemen Sport Center. Tugas Anda adalah melakukan data storytelling dari ringkasan metrik bisnis yang dikirimkan. Berikan: 1. Evaluasi Performa FinOps (Arus Kas). 2. Analisa Okupansi & Pemanfaatan Fasilitas. 3. Rekomendasi strategi harga atau promo untuk meningkatkan utilisasi jam sepi. Gunakan bahasa Indonesia yang profesional, tajam, dan langsung ke poin penting menggunakan format Markdown (bullet points dan bold).",
        temperature: 0.7
      }
    });

    return response.text || "Gagal menghasilkan respon dari AI.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const generateSportsNutritionInsight = async ({ studentName, age, sport, position, height, weight, bmi, status }) => {
  const apiKey = getApiKey();
  const ageText = age ? ` (Umur: ${age} tahun)` : '';

  // Anonymize student name: gunakan inisial atau label anonim untuk privasi atlet anak/remaja
  const anonymizedName = studentName 
    ? studentName.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() + '.').join('')
    : 'Atlet';

  if (!apiKey) {
    let nutrition = "Tingkatkan asupan protein bersih (daging tanpa lemak, telur, tahu/tempe) 1.6 - 2.0g/kgBB untuk mendukung pemulihan serat otot.";
    let training = "Fokus pada latihan ketahanan kardiovaskular dan agility eksplosif sesuai tuntutan posisi.";
    
    if (status === 'Underweight') {
      nutrition = "Tingkatkan asupan kalori harian surplus 300-500 kcal dengan karbohidrat kompleks (nasi merah, oat) dan protein tinggi untuk menaikkan massa otot.";
      training = "Fokus latihan beban terstruktur (Hypertrophy 3-4x/minggu) untuk membentuk massa otot bebas lemak.";
    } else if (status === 'Overweight') {
      nutrition = "Atur defisit kalori terukur (-300 kcal/hari) dengan mengurangi gula sederhana dan minyak berlebih, perbanyak serat sayuran dan protein murni.";
      training = "Tingkatkan latihan kardio zona-2 dan interval HIIT untuk membakar lemak berlebih tanpa mengorbankan kekuatan.";
    } else {
      nutrition = "Pertahankan asupan gizi seimbang dengan rasio karbohidrat 50%, protein 30%, lemak sehat 20% untuk menjaga energi kompetisi puncak.";
      training = "Kombinasikan latihan Agility, Explosive Power, dan latihan taktis spesifik posisi " + (position || 'atlet') + ".";
    }

    return `1) **Fokus Makronutrisi**: ${nutrition}\n2) **Fokus Latihan Fisik**: ${training}`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const promptText = `Bertindaklah sebagai Ahli Gizi Olahraga dan Pelatih Fisik. Atlet [Inisial: ${anonymizedName}]${ageText} [Cabang: ${sport || 'Umum'}] posisi [Posisi: ${position || 'Pemain'}], tinggi ${height} cm, berat ${weight} kg, BMI ${bmi} (Status: ${status}). Berikan 2 poin rekomendasi: 1) Fokus asupan makronutrisi harian (tambah/kurangi apa), 2) Fokus latihan fisik utama (Hypertrophy/Kardio/Agility). Maksimal 3 kalimat pendek.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ],
      config: {
        systemInstruction: "Anda adalah Ahli Gizi Olahraga (Sports Nutritionist) dan Strength & Conditioning Coach profesional. Berikan respon yang singkat, ilmiah, padat, dan memberikan 2 poin rekomendasi eksplisit tanpa meminta atau membocorkan data pribadi.",
        temperature: 0.7
      }
    });

    return response.text || "Rekomendasi AI gizi berhasil dikalkulasi.";
  } catch (err) {
    console.error("Gemini Sports Nutrition Error:", err);
    return `1) **Fokus Makronutrisi**: Sesuaikan kalori harian dengan intensitas latihan, pastikan konsumsi protein 1.8g/kgBB.\n2) **Fokus Latihan Fisik**: Fokus pada Agility, Explosive Power, dan pemulihan stamina harian.`;
  }
};
