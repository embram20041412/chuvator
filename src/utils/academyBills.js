/**
 * academyBills.js
 * Logika murni pemetaan tagihan biaya pendaftaran dan SPP bulanan siswa akademi
 * ke format item produk POS standar untuk modul Kasir (POS Global).
 */

/**
 * @typedef {Object} MapAcademyBillsParams
 * @property {any[]} [students]
 * @property {any[]} [pendingSppPayments]
 * @property {string} [currentMonth]
 * @property {string | null} [currentMonthName]
 */

/**
 * @param {MapAcademyBillsParams} params
 */
export function mapAcademyBills({
  students = [],
  pendingSppPayments = [],
  currentMonth = new Date().toISOString().slice(0, 7),
  currentMonthName = null
} = {}) {
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const defaultMonthName = currentMonthName || (
    monthNames[new Date().getMonth()] + ' ' + new Date().getFullYear()
  );

  const bills = [];
  const addedSppStudentMonthSet = new Set();

  // 1. Tagihan Pendaftaran Siswa Baru (registration_paid === false / registrationFeePaid === false)
  students.forEach((student) => {
    const isRegPaid = Boolean(
      student.registrationFeePaid ||
      student.isRegistrationFeePaid ||
      student.registration_fee_paid ||
      student.is_registration_fee_paid ||
      student.registration_paid ||
      student.registrationPaid
    );

    if (!isRegPaid) {
      const studentName = student.studentName || student.name || 'Siswa Baru';
      const regPrice = Number(student.registrationFee || student.registration_fee) || 75000;
      bills.push({
        id: `REG-${student.id}`,
        name: `Pendaftaran - ${studentName}`,
        price: regPrice,
        cogs: 0,
        category: 'Tagihan SPP',
        subCategory: 'Biaya Pendaftaran',
        type: 'registration',
        student_id: student.id,
        studentId: student.id,
        studentName: studentName,
        className: student.className || student.sportCategory || 'Akademi',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || student.phone || '',
        stock: 1
      });
    }
  });

  // 2. Pending SPP Payments dari tabel spp_payments
  pendingSppPayments.forEach((spp) => {
    const studentName = spp.student_name || spp.studentName || 'Siswa';
    const mStr = spp.paid_month || spp.month || currentMonth;
    const mLabel = spp.paid_month_label || spp.month_label || defaultMonthName;
    addedSppStudentMonthSet.add(`${spp.student_id || spp.studentId}-${mStr}`);

    bills.push({
      id: `SPP-${spp.id}`,
      name: `SPP ${spp.paid_month || spp.month || mLabel} - ${studentName}`,
      price: Number(spp.amount) || 350000,
      cogs: 0,
      category: 'Tagihan SPP',
      subCategory: 'SPP Bulanan',
      type: 'spp',
      student_id: spp.student_id || spp.studentId,
      studentId: spp.student_id || spp.studentId,
      spp_id: spp.id,
      sppId: spp.id,
      studentName: studentName,
      month: spp.paid_month || mLabel,
      paid_month: spp.paid_month || currentMonth,
      stock: 1
    });
  });

  // 3. Tagihan SPP Bulanan dari data siswa yang belum melunasi bulan berjalan
  students.forEach((student) => {
    const isSppPaidThisMonth =
      (student.sppStatus === 'Lunas' || student.paymentStatus === 'lunas') &&
      student.lastPaidMonth === currentMonth;

    const key = `${student.id}-${currentMonth}`;
    if (!isSppPaidThisMonth && !addedSppStudentMonthSet.has(key)) {
      const studentName = student.studentName || student.name || 'Siswa';
      const fee = Number(student.monthlyFee || student.monthly_fee) || 350000;
      bills.push({
        id: `SPP-${student.id}-${currentMonth}`,
        name: `SPP ${defaultMonthName} - ${studentName}`,
        price: fee,
        cogs: 0,
        category: 'Tagihan SPP',
        subCategory: 'SPP Bulanan',
        type: 'spp',
        student_id: student.id,
        studentId: student.id,
        studentName: studentName,
        className: student.className || student.sportCategory || 'Akademi',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || student.phone || '',
        month: defaultMonthName,
        paid_month: currentMonth,
        stock: 1
      });
    }
  });

  return bills;
}
