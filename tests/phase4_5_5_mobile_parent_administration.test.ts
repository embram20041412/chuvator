import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

// Setup Mock Window for Node.js SSR test environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1024,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    location: { origin: 'https://chuvator.pages.dev', search: '' }
  };
}

import ParentManagementPage, { ParentDesktopMain } from '../src/pages/ParentManagementPage.jsx';
import MobileParentManagementMain, {
  resolveTenantId,
  filterParentsByTenant,
  filterParentsList,
  validateKKNumber,
  validateAndNormalizeParentPhone,
  buildCreateParentPayload,
  getParentInvitationStatusMeta,
  toggleStudentSelection,
  executeSearchStudentsByKK,
  executeCreateParentWithLock,
  executeGenerateWhatsAppInvitation,
  executeDeleteParentWithConfirmation,
  copyTextToClipboard
} from '../src/mobile/pages/admin/MobileParentManagementMain.jsx';

test('CHUVATOR — Phase 4.5.5 Mobile Parent Administration Test Suite', async (t) => {
  const mockOwnerProfile = {
    tenantId: 'tenant-gor-101',
    role: 'owner',
    displayName: 'Owner Kediri Arena',
    email: 'owner@kedirisport.id',
    tenant: {
      id: 'tenant-gor-101',
      name: 'KEDIRI SPORT ARENA'
    }
  };

  const mockProfileNoTenant = {
    id: 'auth-user-uuid-999',
    uid: 'auth-user-uuid-999',
    role: 'owner',
    displayName: 'User Tanpa Tenant'
  };

  const sampleParents = [
    {
      id: 'parent-uuid-001',
      tenant_id: 'tenant-gor-101',
      name: 'Budi Santoso',
      full_name: 'Budi Santoso',
      email: 'budi.santoso@gmail.com',
      phone: '6281234567890',
      status: 'active',
      invitationStatus: 'ACTIVATED',
      links: [
        { student: { id: 'std-1', name: 'Rizky Pratama', kk_last4: '4321' } },
        { student: { id: 'std-2', name: 'Nadia Pratama', kk_last4: '4321' } }
      ]
    },
    {
      id: 'parent-uuid-002',
      tenant_id: 'tenant-gor-101',
      name: 'Siti Aminah',
      full_name: 'Siti Aminah',
      email: 'siti.aminah@yahoo.com',
      phone: '6285711223344',
      status: 'pending',
      invitationStatus: 'READY_TO_SEND',
      links: [
        { student: { id: 'std-3', name: 'Fajar Nugroho', kk_last4: '8899' } }
      ]
    },
    {
      id: 'parent-uuid-003',
      tenant_id: 'tenant-gor-101',
      name: 'Hendra Wijaya',
      full_name: 'Hendra Wijaya',
      email: 'hendra.w@domain.id',
      phone: '6281999888777',
      status: 'pending',
      invitationStatus: 'SENT_MANUALLY',
      links: []
    },
    {
      id: 'parent-uuid-004',
      tenant_id: 'tenant-gor-101',
      name: 'Dewi Lestari',
      full_name: 'Dewi Lestari',
      email: 'dewi.lestari@mail.com',
      phone: '6281333444555',
      status: 'expired',
      invitationStatus: 'EXPIRED',
      links: []
    }
  ];

  /* ========================================================================= */
  /* TEST 1: Mobile route merender komponen mobile (SSR Component Render)      */
  /* ========================================================================= */
  await t.test('TEST 1 [SSR]: Mobile route (<=767px) merender MobileParentManagementMain dan kartu wali', () => {
    (globalThis as any).window.innerWidth = 390;

    const htmlWrapper = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(ParentManagementPage, { userProfile: mockOwnerProfile })
      )
    );

    assert.ok(htmlWrapper.includes('mobile-parent-management-main'));
    assert.ok(htmlWrapper.includes('chua-mobile-app'));
    assert.ok(htmlWrapper.includes('Manajemen Wali Murid'));
    assert.ok(htmlWrapper.includes('Tambah Akun Wali Murid'));

    // Render dengan daftar wali untuk memverifikasi kartu mobile (bukan tabel horizontal)
    const htmlWithCards = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: sampleParents
        })
      )
    );

    assert.ok(htmlWithCards.includes('mobile-parent-card-list'));
    assert.ok(htmlWithCards.includes('Budi Santoso'));
    assert.ok(htmlWithCards.includes('Siti Aminah'));
    assert.ok(htmlWithCards.includes('Rizky Pratama'));
    assert.ok(htmlWithCards.includes('Nadia Pratama'));
    assert.equal(htmlWithCards.includes('<table'), false, 'Mobile tidak boleh menggunakan tabel horizontal sebagai tampilan utama');
  });

  /* ========================================================================= */
  /* TEST 2: Desktop route tetap merender komponen desktop (SSR Render)        */
  /* ========================================================================= */
  await t.test('TEST 2 [SSR]: Desktop route (>=768px) tetap merender ParentDesktopMain', () => {
    (globalThis as any).window.innerWidth = 1280;

    const htmlDesktop = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(ParentManagementPage, { userProfile: mockOwnerProfile })
      )
    );

    assert.ok(htmlDesktop.includes('Manajemen Wali Murid'));
    assert.ok(htmlDesktop.includes('Kelola akun wali murid, verifikasi status Auth'));
    assert.equal(htmlDesktop.includes('mobile-parent-management-main'), false);
    assert.equal(htmlDesktop.includes('chua-mobile-app'), false);
  });

  /* ========================================================================= */
  /* TEST 3: Tenant Isolation — Fail Closed (Phase 4.5.5.1)                    */
  /* ========================================================================= */
  await t.test('TEST 3 [UNIT]: Tenant Isolation Fail-Closed — hanya menerima record dengan tenant_id/tenantId valid yang cocok dengan activeTenantId', () => {
    assert.equal(resolveTenantId({ tenant: { id: 'tenant-a-1' } }), 'tenant-a-1');
    assert.equal(resolveTenantId({ tenantId: 'tenant-b-2' }), 'tenant-b-2');
    assert.equal(resolveTenantId({ tenant: { tenant_id: 'tenant-c-3' } }), 'tenant-c-3');

    // Pastikan userProfile.id dan userProfile.uid DITOLAK sebagai fallback tenant
    assert.equal(resolveTenantId({ id: 'user-uid-1', uid: 'user-uid-1' }), null);
    assert.equal(resolveTenantId({ id: 'user-uid-1', uid: 'user-uid-1', tenant: {} }), null);
    assert.equal(resolveTenantId(null), null);
    assert.equal(resolveTenantId(undefined), null);
    assert.equal(resolveTenantId({ tenantId: '   ' }), null);

    // 1. Active tenant valid & parent memiliki tenant_id atau tenantId yang sama -> DITERIMA
    const validRecords = [
      { id: 'p-valid-snake', tenant_id: 'tenant-gor-101', name: 'Wali Snake Case' },
      { id: 'p-valid-camel', tenantId: 'tenant-gor-101', name: 'Wali Camel Case' }
    ];
    const accepted = filterParentsByTenant(validRecords, 'tenant-gor-101');
    assert.equal(accepted.length, 2);
    assert.deepEqual(accepted.map((p) => p.id), ['p-valid-snake', 'p-valid-camel']);

    // 2. Parent memiliki tenant berbeda -> DITOLAK
    // 3. Parent tanpa tenant_id/tenantId (null / undefined / missing property) -> DITOLAK
    // 4. Parent dengan tenant_id/tenantId kosong atau whitespace -> DITOLAK
    const candidateRecords = [
      ...sampleParents,
      {
        id: 'parent-camel-match',
        tenantId: 'tenant-gor-101',
        name: 'Wali Camel Valid'
      },
      {
        id: 'parent-foreign-999',
        tenant_id: 'tenant-rival-999',
        name: 'Wali Tenant Lain'
      },
      {
        id: 'parent-foreign-camel-998',
        tenantId: 'tenant-rival-998',
        name: 'Wali Tenant Lain Camel'
      },
      {
        id: 'parent-missing-prop',
        name: 'Wali Tanpa Properti Tenant'
      },
      {
        id: 'parent-null-tenant',
        tenant_id: null,
        name: 'Wali Tenant Null'
      },
      {
        id: 'parent-undefined-tenant',
        tenant_id: undefined,
        tenantId: undefined,
        name: 'Wali Tenant Undefined'
      },
      {
        id: 'parent-empty-tenant',
        tenant_id: '',
        name: 'Wali Tenant String Kosong'
      },
      {
        id: 'parent-whitespace-snake',
        tenant_id: '    ',
        name: 'Wali Tenant Whitespace Snake'
      },
      {
        id: 'parent-whitespace-camel',
        tenantId: '   \t  ',
        name: 'Wali Tenant Whitespace Camel'
      }
    ];

    const isolated = filterParentsByTenant(candidateRecords, 'tenant-gor-101');
    assert.equal(isolated.length, 5, 'Hanya 4 sampleParents + 1 parent-camel-match yang boleh lolos filter fail-closed');
    assert.equal(isolated.some((p) => p.id === 'parent-foreign-999'), false);
    assert.equal(isolated.some((p) => p.id === 'parent-foreign-camel-998'), false);
    assert.equal(isolated.some((p) => p.id === 'parent-missing-prop'), false);
    assert.equal(isolated.some((p) => p.id === 'parent-null-tenant'), false);
    assert.equal(isolated.some((p) => p.id === 'parent-undefined-tenant'), false);
    assert.equal(isolated.some((p) => p.id === 'parent-empty-tenant'), false);
    assert.equal(isolated.some((p) => p.id === 'parent-whitespace-snake'), false);
    assert.equal(isolated.some((p) => p.id === 'parent-whitespace-camel'), false);

    // 5. Active tenant kosong / tidak tersedia -> hasil harus berupa array kosong
    assert.deepEqual(filterParentsByTenant(candidateRecords, null), []);
    assert.deepEqual(filterParentsByTenant(candidateRecords, undefined), []);
    assert.deepEqual(filterParentsByTenant(candidateRecords, ''), []);
    assert.deepEqual(filterParentsByTenant(candidateRecords, '    '), []);
  });

  /* ========================================================================= */
  /* TEST 4: Tenant ID kosong tidak memicu pemanggilan service                 */
  /* ========================================================================= */
  await t.test('TEST 4 [UNIT + SSR]: Tenant ID kosong menampilkan peringatan dan tidak memicu pemanggilan service', async () => {
    let serviceCallCount = 0;
    const spyService = {
      getParentAccounts: async () => {
        serviceCallCount += 1;
        return [];
      },
      searchStudentsByKK: async () => {
        serviceCallCount += 1;
        return { data: [] };
      },
      createParentAccount: async () => {
        serviceCallCount += 1;
        return {};
      },
      generateWhatsAppInvitation: async () => {
        serviceCallCount += 1;
        return {};
      },
      confirmManualSent: async () => {
        serviceCallCount += 1;
        return {};
      },
      deleteParentAccount: async () => {
        serviceCallCount += 1;
        return {};
      }
    };

    const htmlNoTenant = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockProfileNoTenant,
          serviceOverride: spyService
        })
      )
    );

    assert.ok(htmlNoTenant.includes('mobile-parent-no-tenant'));
    assert.ok(htmlNoTenant.includes('Konteks Cabang (Tenant) Tidak Tersedia'));

    await assert.rejects(
      () => executeSearchStudentsByKK({ tenantId: null, kk: '3506011234560001', service: spyService as any }),
      /Konteks tenant tidak tersedia/
    );
    await assert.rejects(
      () =>
        executeCreateParentWithLock({
          tenantId: null,
          formData: { name: 'Budi', email: 'budi@mail.com', phone: '081234567890', kk: '3506011234560001', relationship: 'father' },
          selectedStudentIds: ['std-1'],
          lockRef: { current: false },
          service: spyService as any
        }),
      /Konteks tenant tidak tersedia/
    );
    await assert.rejects(
      () => executeGenerateWhatsAppInvitation({ tenantId: null, parentId: 'p-1', service: spyService as any }),
      /Konteks tenant tidak tersedia/
    );
    await assert.rejects(
      () => executeDeleteParentWithConfirmation({ tenantId: null, parentId: 'p-1', isConfirmed: true, service: spyService as any }),
      /Konteks tenant tidak tersedia/
    );

    assert.equal(serviceCallCount, 0, 'Tidak boleh ada satu pun panggilan ke parentService ketika tenantId kosong');
  });

  /* ========================================================================= */
  /* TEST 5: Pencarian wali bekerja berdasarkan nama, email, dan nomor WA      */
  /* ========================================================================= */
  await t.test('TEST 5 [UNIT]: Pencarian wali bekerja berdasarkan nama, email, dan nomor WhatsApp', () => {
    // Cari berdasarkan nama
    const byName = filterParentsList(sampleParents, 'siti aminah');
    assert.equal(byName.length, 1);
    assert.equal(byName[0].id, 'parent-uuid-002');

    // Cari berdasarkan email
    const byEmail = filterParentsList(sampleParents, 'hendra.w@domain.id');
    assert.equal(byEmail.length, 1);
    assert.equal(byEmail[0].id, 'parent-uuid-003');

    // Cari berdasarkan nomor WA (format 628... maupun awalan lokal 08...)
    const byPhoneIntl = filterParentsList(sampleParents, '6281234567890');
    assert.equal(byPhoneIntl.length, 1);
    assert.equal(byPhoneIntl[0].id, 'parent-uuid-001');

    const byPhoneLocal = filterParentsList(sampleParents, '08571122');
    assert.equal(byPhoneLocal.length, 1);
    assert.equal(byPhoneLocal[0].id, 'parent-uuid-002');
  });

  /* ========================================================================= */
  /* TEST 6: Validasi KK tepat 16 digit                                        */
  /* ========================================================================= */
  await t.test('TEST 6 [UNIT]: Validasi nomor Kartu Keluarga (KK) wajib tepat 16 digit angka', () => {
    assert.equal(validateKKNumber('').valid, false);
    assert.equal(validateKKNumber('35060112345').valid, false);
    assert.equal(validateKKNumber('35060112345678901').valid, false);

    const validKK = validateKKNumber('3506011234560001');
    assert.equal(validKK.valid, true);
    assert.equal(validKK.normalized, '3506011234560001');
  });

  /* ========================================================================= */
  /* TEST 7: Pencarian siswa menggunakan service yang sudah ada                */
  /* ========================================================================= */
  await t.test('TEST 7 [UNIT]: Pencarian siswa berdasarkan KK memanggil parentService.searchStudentsByKK', async () => {
    let capturedKK = '';
    const mockService = {
      searchStudentsByKK: async (kk: string) => {
        capturedKK = kk;
        return {
          success: true,
          data: [
            { studentId: 'student-uuid-101', name: 'Dimas Pratama', kkLast4: '0001' },
            { studentId: 'student-uuid-102', name: 'Ayu Pratama', kkLast4: '0001' }
          ]
        };
      }
    };

    const res = await executeSearchStudentsByKK({
      tenantId: 'tenant-gor-101',
      kk: '3506011234560001',
      service: mockService as any
    });

    assert.equal(capturedKK, '3506011234560001');
    assert.equal(res.isEmpty, false);
    assert.equal(res.students.length, 2);
    assert.equal(res.students[0].name, 'Dimas Pratama');
  });

  /* ========================================================================= */
  /* TEST 8: Pemilihan beberapa siswa                                          */
  /* ========================================================================= */
  await t.test('TEST 8 [UNIT]: Pemilihan satu atau beberapa siswa (multi-select toggle)', () => {
    let selected: string[] = [];
    selected = toggleStudentSelection(selected, 'student-uuid-101');
    assert.deepEqual(selected, ['student-uuid-101']);

    selected = toggleStudentSelection(selected, 'student-uuid-102');
    assert.deepEqual(selected, ['student-uuid-101', 'student-uuid-102']);

    // Klik ulang menghapus siswa dari daftar pilihan
    selected = toggleStudentSelection(selected, 'student-uuid-101');
    assert.deepEqual(selected, ['student-uuid-102']);
  });

  /* ========================================================================= */
  /* TEST 9: Payload create parent tetap kompatibel                            */
  /* ========================================================================= */
  await t.test('TEST 9 [UNIT]: Payload createParentAccount kompatibel dengan kontrak API dan tidak menyuntikkan tenantId buatan', () => {
    const payload = buildCreateParentPayload({
      name: '  Budi Santoso  ',
      email: '  budi.santoso@gmail.com  ',
      phone: '0812-3456-7890',
      kk: '3506011234560001',
      relationship: 'father',
      studentIds: ['student-uuid-101', 'student-uuid-102']
    });

    assert.deepEqual(payload, {
      name: 'Budi Santoso',
      email: 'budi.santoso@gmail.com',
      phone: '6281234567890',
      kk: '3506011234560001',
      relationship: 'father',
      studentIds: ['student-uuid-101', 'student-uuid-102']
    });

    // Pastikan tidak ada properti tenantId atau tenant_id buatan di dalam payload
    assert.equal('tenantId' in payload, false);
    assert.equal('tenant_id' in payload, false);
  });

  /* ========================================================================= */
  /* TEST 10: Validasi dan normalisasi nomor WhatsApp                          */
  /* ========================================================================= */
  await t.test('TEST 10 [UNIT]: Validasi dan normalisasi nomor WhatsApp sesuai aturan sistem', () => {
    // 08... -> 628...
    const fromZero = validateAndNormalizeParentPhone('081234567890');
    assert.equal(fromZero.valid, true);
    assert.equal(fromZero.normalized, '6281234567890');

    // 8... -> 628...
    const fromEight = validateAndNormalizeParentPhone('85711223344');
    assert.equal(fromEight.valid, true);
    assert.equal(fromEight.normalized, '6285711223344');

    // +628... -> 628...
    const fromPlus = validateAndNormalizeParentPhone('+62 813-4455-6677');
    assert.equal(fromPlus.valid, true);
    assert.equal(fromPlus.normalized, '6281344556677');

    // Nomor terlalu pendek (< 10 digit) ditolak
    assert.equal(validateAndNormalizeParentPhone('081234').valid, false);

    // Nomor terlalu panjang (> 15 digit) ditolak
    assert.equal(validateAndNormalizeParentPhone('08123456789012345').valid, false);

    // Nomor telepon rumah (6221...) ditolak karena bukan seluler 628...
    assert.equal(validateAndNormalizeParentPhone('02155667788').valid, false);
  });

  /* ========================================================================= */
  /* TEST 11: Generate invitation & Buka WhatsApp                              */
  /* ========================================================================= */
  await t.test('TEST 11 [UNIT + SSR]: Generate WhatsApp invitation memanggil service dan menampilkan Salin Link, Salin Pesan, serta Buka WhatsApp tanpa tombol Tandai Sudah Dikirim', async () => {
    let requestedParentId = '';
    const mockService = {
      generateWhatsAppInvitation: async (parentId: string) => {
        requestedParentId = parentId;
        return {
          success: true,
          status: 'READY_TO_SEND',
          data: {
            parentId,
            parentName: 'Siti Aminah',
            tenantName: 'KEDIRI SPORT ARENA',
            phone: '6285711223344',
            claimUrl: 'https://chuvator.pages.dev/portal/claim-invitation?token=abc123token',
            whatsappUrl: 'https://wa.me/6285711223344?text=Halo',
            message: 'Halo Ibu Siti Aminah, silakan klik link aktivasi...',
            isConfirmed: false
          }
        };
      }
    };

    const modalData = await executeGenerateWhatsAppInvitation({
      tenantId: 'tenant-gor-101',
      parentId: 'parent-uuid-002',
      service: mockService as any
    });

    assert.equal(requestedParentId, 'parent-uuid-002');
    assert.equal(modalData.status, 'READY_TO_SEND', 'Generate tautan tidak boleh mengklaim status sudah terkirim');
    assert.equal(modalData.claimUrl, 'https://chuvator.pages.dev/portal/claim-invitation?token=abc123token');

    // Render modal WhatsApp pada komponen mobile
    const htmlModal = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: sampleParents,
          initialWhatsAppModal: modalData
        })
      )
    );

    assert.ok(htmlModal.includes('mobile-parent-whatsapp-modal'));
    assert.ok(htmlModal.includes('Siti Aminah'));
    assert.ok(htmlModal.includes('KEDIRI SPORT ARENA'));
    assert.ok(htmlModal.includes('Salin Link'));
    assert.ok(htmlModal.includes('Salin Pesan'));
    assert.ok(htmlModal.includes('Buka WhatsApp'));
    assert.ok(htmlModal.includes('Pengiriman undangan dilakukan secara manual oleh operator melalui WhatsApp'));
    assert.equal(htmlModal.includes('Tandai Sudah Dikirim'), false, 'Tombol manual confirmation yang tidak didukung backend tidak boleh dirender');
  });

  /* ========================================================================= */
  /* TEST 12: Copy link dan copy message                                       */
  /* ========================================================================= */
  await t.test('TEST 12 [UNIT]: Copy invitation link dan copy invitation message menyalin teks tanpa mengubah status pengiriman', async () => {
    const copiedItems: string[] = [];
    const mockClipboard = {
      writeText: async (txt: string) => {
        copiedItems.push(txt);
      }
    };

    const linkRes = await copyTextToClipboard(
      'https://chuvator.pages.dev/portal/claim-invitation?token=tok999',
      mockClipboard
    );
    assert.equal(linkRes.copied, true);

    const msgRes = await copyTextToClipboard(
      'Assalamualaikum Bapak/Ibu Budi Santoso, berikut tautan aktivasi...',
      mockClipboard
    );
    assert.equal(msgRes.copied, true);

    assert.equal(copiedItems.length, 2);
    assert.equal(copiedItems[0], 'https://chuvator.pages.dev/portal/claim-invitation?token=tok999');
    assert.match(copiedItems[1], /Budi Santoso/);
  });

  /* ========================================================================= */
  /* TEST 13: Penghapusan aksi manual confirmation yang tidak didukung backend */
  /* ========================================================================= */
  await t.test('TEST 13 [SOURCE + SSR]: Tombol Tandai Sudah Dikirim dan pemanggilan confirmManualSent() telah dihapus dari MobileParentManagementMain', () => {
    const mobileSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/mobile/pages/admin/MobileParentManagementMain.jsx'),
      'utf8'
    );

    // 1. Komponen tidak memanggil confirmManualSent()
    assert.equal(
      mobileSource.includes('confirmManualSent'),
      false,
      'MobileParentManagementMain.jsx tidak boleh memanggil atau mereferensikan confirmManualSent()'
    );

    // 2. Tombol "Tandai Sudah Dikirim" tidak lagi tersedia di kode maupun hasil render
    assert.equal(
      mobileSource.includes('Tandai Sudah Dikirim'),
      false,
      'Tombol Tandai Sudah Dikirim tidak boleh ada di MobileParentManagementMain.jsx'
    );

    const htmlPostCreation = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: sampleParents,
          initialSuccessResult: {
            success: true,
            data: {
              parentId: 'parent-new-777',
              email: 'wali.baru@domain.com',
              phone: '6281299887766',
              status: 'READY_TO_SEND',
              claimUrl: 'https://chuvator.pages.dev/portal/claim-invitation?token=newtoken',
              whatsappUrl: 'https://wa.me/6281299887766?text=Halo'
            }
          }
        })
      )
    );

    assert.equal(htmlPostCreation.includes('Tandai Sudah Dikirim'), false);
    assert.ok(htmlPostCreation.includes('Buka WhatsApp'));
    assert.ok(htmlPostCreation.includes('Salin Tautan Aktivasi'));
  });

  /* ========================================================================= */
  /* TEST 14: Status undangan ditampilkan dengan benar                         */
  /* ========================================================================= */
  await t.test('TEST 14 [UNIT + SSR]: Status READY_TO_SEND, SENT_MANUALLY, ACTIVATED, dan EXPIRED ditampilkan dengan akurat', () => {
    assert.equal(getParentInvitationStatusMeta({ invitationStatus: 'READY_TO_SEND' }).label, 'Siap Kirim');
    assert.equal(getParentInvitationStatusMeta({ invitationStatus: 'SENT_MANUALLY' }).label, 'Terkirim (WA)');
    assert.equal(getParentInvitationStatusMeta({ invitationStatus: 'ACTIVATED' }).label, 'Aktif');
    assert.equal(getParentInvitationStatusMeta({ invitationStatus: 'EXPIRED' }).label, 'Kedaluwarsa');

    const htmlAllStatuses = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: sampleParents
        })
      )
    );

    assert.ok(htmlAllStatuses.includes('Aktif'));
    assert.ok(htmlAllStatuses.includes('Siap Kirim'));
    assert.ok(htmlAllStatuses.includes('Terkirim (WA)'));
    assert.ok(htmlAllStatuses.includes('Kedaluwarsa'));
  });

  /* ========================================================================= */
  /* TEST 15: Penghapusan akun memerlukan konfirmasi                           */
  /* ========================================================================= */
  await t.test('TEST 15 [UNIT + SSR]: Penghapusan akun menampilkan identitas wali dan memerlukan konfirmasi eksplisit', async () => {
    let deletedParentId: string | null = null;
    const mockService = {
      deleteParentAccount: async (id: string) => {
        deletedParentId = id;
        return { success: true };
      }
    };

    // Tanpa konfirmasi -> tidak menghapus
    const unconfirmed = await executeDeleteParentWithConfirmation({
      tenantId: 'tenant-gor-101',
      parentId: 'parent-uuid-002',
      isConfirmed: false,
      service: mockService as any
    });
    assert.equal(unconfirmed.deleted, false);
    assert.equal(deletedParentId, null);

    // Render modal konfirmasi hapus untuk memastikan identitas wali ditampilkan jelas
    const htmlDeleteModal = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: sampleParents,
          initialDeleteTarget: sampleParents[1]
        })
      )
    );
    assert.ok(htmlDeleteModal.includes('mobile-parent-delete-modal'));
    assert.ok(htmlDeleteModal.includes('Konfirmasi Hapus Akun Wali'));
    assert.ok(htmlDeleteModal.includes('Siti Aminah'));
    assert.ok(htmlDeleteModal.includes('siti.aminah@yahoo.com'));
    assert.ok(htmlDeleteModal.includes('6285711223344'));
    assert.ok(htmlDeleteModal.includes('Fajar Nugroho'));

    // Dengan konfirmasi -> memanggil deleteParentAccount
    const confirmed = await executeDeleteParentWithConfirmation({
      tenantId: 'tenant-gor-101',
      parentId: 'parent-uuid-002',
      isConfirmed: true,
      service: mockService as any
    });
    assert.equal(confirmed.deleted, true);
    assert.equal(deletedParentId, 'parent-uuid-002');
  });

  /* ========================================================================= */
  /* TEST 16: Loading, empty, error, dan success states                        */
  /* ========================================================================= */
  await t.test('TEST 16 [SSR]: Loading, Empty, Error, dan Post-Creation Success states dirender dengan benar', () => {
    // 1. Loading State
    const htmlLoading = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile
        })
      )
    );
    assert.ok(htmlLoading.includes('mobile-parent-loading'));
    assert.ok(htmlLoading.includes('Memverifikasi daftar &amp; status akun wali murid...') || htmlLoading.includes('Memverifikasi daftar & status akun wali murid...'));

    // 2. Empty State
    const htmlEmpty = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: []
        })
      )
    );
    assert.ok(htmlEmpty.includes('mobile-parent-empty'));
    assert.ok(htmlEmpty.includes('Belum Ada Akun Wali Murid'));

    // 3. Error State
    const htmlError = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialError: 'Gagal menghubungi server daftar wali murid.'
        })
      )
    );
    assert.ok(htmlError.includes('mobile-parent-error'));
    assert.ok(htmlError.includes('Gagal menghubungi server daftar wali murid.'));

    // 4. Success State setelah pembuatan akun (jujur menyatakan READY_TO_SEND, belum terkirim otomatis)
    const htmlSuccess = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: sampleParents,
          initialSuccessResult: {
            success: true,
            data: {
              parentId: 'parent-new-777',
              email: 'wali.baru@domain.com',
              phone: '6281299887766',
              status: 'READY_TO_SEND',
              claimUrl: 'https://chuvator.pages.dev/portal/claim-invitation?token=newtoken',
              whatsappUrl: 'https://wa.me/6281299887766?text=Halo'
            }
          }
        })
      )
    );
    assert.ok(htmlSuccess.includes('mobile-parent-create-success'));
    assert.ok(htmlSuccess.includes('wali.baru@domain.com'));
    assert.ok(htmlSuccess.includes('READY_TO_SEND'));
    assert.ok(htmlSuccess.includes('Undangan Belum Terkirim Otomatis'));
  });

  /* ========================================================================= */
  /* TEST 17: Double submission dicegah                                        */
  /* ========================================================================= */
  await t.test('TEST 17 [UNIT]: Double submission pada pembuatan akun wali murid dicegah oleh submission lock', async () => {
    let apiCreateCount = 0;
    const lockRef = { current: false };

    const slowService = {
      createParentAccount: async (payload: any) => {
        apiCreateCount += 1;
        await new Promise((r) => setTimeout(r, 40));
        return {
          success: true,
          data: { parentId: 'p-1', email: payload.email, phone: payload.phone, status: 'READY_TO_SEND' }
        };
      }
    };

    const formInput = {
      name: 'Budi Santoso',
      email: 'budi@domain.com',
      phone: '081234567890',
      kk: '3506011234560001',
      relationship: 'father'
    };

    const [firstCall, secondCall] = await Promise.all([
      executeCreateParentWithLock({
        tenantId: 'tenant-gor-101',
        formData: formInput,
        selectedStudentIds: ['std-1'],
        lockRef,
        service: slowService as any
      }),
      executeCreateParentWithLock({
        tenantId: 'tenant-gor-101',
        formData: formInput,
        selectedStudentIds: ['std-1'],
        lockRef,
        service: slowService as any
      })
    ]);

    assert.equal(apiCreateCount, 1, 'createParentAccount hanya boleh dipanggil tepat 1 kali saat terjadi klik ganda');
    assert.equal(firstCall.skippedDuplicate, false);
    assert.equal(secondCall.skippedDuplicate, true);
    assert.equal(lockRef.current, false, 'Lock wajib dilepas kembali setelah request selesai');
  });

  /* ========================================================================= */
  /* TEST 18: Tidak ada perubahan backend/service/desktop di luar ruang lingkup*/
  /* ========================================================================= */
  await t.test('TEST 18 [SOURCE VERIFICATION]: parentService.js dan endpoint backend tidak dimodifikasi, serta ParentDesktopMain tetap utuh', () => {
    const parentServiceSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/parentService.js'),
      'utf8'
    );
    assert.ok(parentServiceSource.includes("fetch('/api/tenant/parents'"));
    assert.ok(parentServiceSource.includes("fetch(`/api/tenant/parents/students?kk=${encodeURIComponent(kk)}`"));
    assert.ok(parentServiceSource.includes("fetch('/api/tenant/parents/resend'"));
    assert.ok(parentServiceSource.includes("fetch(`/api/tenant/parents/delete?id=${encodeURIComponent(parentId)}`"));

    const parentPageSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/ParentManagementPage.jsx'),
      'utf8'
    );
    assert.ok(parentPageSource.includes('export function ParentDesktopMain'));
    assert.ok(parentPageSource.includes('useMobileViewport(767)'));
    assert.equal(parentPageSource.includes('userProfile?.uid'), false, 'Fallback userProfile?.uid wajib dihapus dari resolusi tenant di ParentManagementPage.jsx');
    assert.equal(typeof ParentDesktopMain, 'function');
  });
});
