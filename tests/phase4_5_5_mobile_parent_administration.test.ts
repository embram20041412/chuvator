import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { parentService } from '../src/services/parentService.js';

// Setup lightweight W3C DOM & Window harness for React 19 createRoot + act in Node.js
class MiniDOMNode {
  nodeType: number;
  nodeName: string;
  childNodes: MiniDOMNode[] = [];
  parentNode: MiniDOMNode | null = null;
  ownerDocument: any = null;
  nodeValue: string | null = null;
  constructor(nodeType: number, nodeName: string) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
  }
  appendChild(child: MiniDOMNode) {
    if (child.nodeType === 11) {
      while (child.childNodes.length) this.appendChild(child.childNodes[0]);
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  removeChild(child: MiniDOMNode) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }
  insertBefore(newNode: MiniDOMNode, refNode: MiniDOMNode | null) {
    if (!refNode) return this.appendChild(newNode);
    if (newNode.nodeType === 11) {
      while (newNode.childNodes.length) this.insertBefore(newNode.childNodes[0], refNode);
      return newNode;
    }
    if (newNode.parentNode) newNode.parentNode.removeChild(newNode);
    const idx = this.childNodes.indexOf(refNode);
    if (idx === -1) return this.appendChild(newNode);
    newNode.parentNode = this;
    this.childNodes.splice(idx, 0, newNode);
    return newNode;
  }
  get firstChild(): MiniDOMNode | null {
    return this.childNodes[0] || null;
  }
  get lastChild(): MiniDOMNode | null {
    return this.childNodes[this.childNodes.length - 1] || null;
  }
  get nextSibling(): MiniDOMNode | null {
    if (!this.parentNode) return null;
    const i = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[i + 1] || null;
  }
  get textContent(): string {
    if (this.nodeType === 3 || this.nodeType === 8) return this.nodeValue || '';
    return this.childNodes.map((c) => c.textContent).join('');
  }
  set textContent(v: string) {
    if (this.nodeType === 3 || this.nodeType === 8) {
      this.nodeValue = String(v ?? '');
    } else {
      this.childNodes.forEach((c) => (c.parentNode = null));
      this.childNodes = [];
      if (v !== null && v !== undefined && v !== '') {
        const t = new MiniDOMNode(3, '#text');
        t.nodeValue = String(v);
        t.ownerDocument = this.ownerDocument;
        this.appendChild(t);
      }
    }
  }
}

class MiniDOMElement extends MiniDOMNode {
  tagName: string;
  attributes: Record<string, string> = {};
  style: Record<string, any> = {};
  namespaceURI = 'http://www.w3.org/1999/xhtml';
  onclick: ((e?: any) => void) | null = null;
  disabled = false;
  value = '';
  checked = false;
  constructor(tag: string, doc: any) {
    super(1, tag.toUpperCase());
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
  }
  setAttribute(k: string, v: string) {
    this.attributes[k] = String(v);
  }
  getAttribute(k: string) {
    return this.attributes[k] ?? null;
  }
  removeAttribute(k: string) {
    delete this.attributes[k];
  }
  addEventListener() {}
  removeEventListener() {}
  get innerHTML(): string {
    return this.childNodes.map((c: any) => c.outerHTML ?? c.textContent).join('');
  }
  set innerHTML(_v: string) {
    this.childNodes.forEach((c) => (c.parentNode = null));
    this.childNodes = [];
  }
  get outerHTML(): string {
    const attrs = Object.entries(this.attributes)
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('');
    return `<${this.tagName.toLowerCase()}${attrs}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
  }
  findByTestId(testId: string): MiniDOMElement | null {
    if (this.attributes['data-testid'] === testId) return this;
    for (const child of this.childNodes) {
      if (child instanceof MiniDOMElement) {
        const found = child.findByTestId(testId);
        if (found) return found;
      }
    }
    return null;
  }
}

function setupMiniDOMEnvironment() {
  const doc: any = new MiniDOMNode(9, '#document');
  doc.defaultView = globalThis;
  doc.activeElement = null;
  doc.documentElement = new MiniDOMElement('html', doc);
  doc.body = new MiniDOMElement('body', doc);
  doc.createElement = (tag: string) => new MiniDOMElement(tag, doc);
  doc.createElementNS = (_ns: string, tag: string) => new MiniDOMElement(tag, doc);
  doc.createTextNode = (text: string) => {
    const n = new MiniDOMNode(3, '#text');
    n.nodeValue = String(text);
    n.ownerDocument = doc;
    return n;
  };
  doc.createComment = (text: string) => {
    const n = new MiniDOMNode(8, '#comment');
    n.nodeValue = String(text);
    n.ownerDocument = doc;
    return n;
  };
  doc.createDocumentFragment = () => {
    const n = new MiniDOMNode(11, '#document-fragment');
    n.ownerDocument = doc;
    return n;
  };
  doc.addEventListener = () => {};
  doc.removeEventListener = () => {};

  (globalThis as any).document = doc;
  (globalThis as any).window = globalThis;
  (globalThis as any).window.innerWidth = 390;
  (globalThis as any).window.addEventListener = () => {};
  (globalThis as any).window.removeEventListener = () => {};
  (globalThis as any).window.dispatchEvent = () => true;
  (globalThis as any).window.location = { origin: 'https://chuvator.pages.dev', search: '' };
  (globalThis as any).HTMLIFrameElement = class {};
  (globalThis as any).Element = MiniDOMElement;
  (globalThis as any).Node = MiniDOMNode;
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'node-dom',
        clipboard: { writeText: async () => {} }
      },
      configurable: true,
      writable: true
    });
  } catch (_) {}
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const container = doc.createElement('div') as MiniDOMElement;
  doc.body.appendChild(container);
  return { doc, container };
}

setupMiniDOMEnvironment();

import { onRequestGet as parentListHandler } from '../functions/api/tenant/parents/index.js';
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
  copyTextToClipboard,
  UNAVAILABLE_STUDENT_NAME_LABEL,
  resolveStudentNameFromRecord,
  resolveParentLinkedStudents
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

  /* ========================================================================= */
  /* TEST 19: Phase 4.5.5.2 — Parent–Student Relationship Display Correction   */
  /* ========================================================================= */
  await t.test('TEST 19 [UNIT + SSR]: Phase 4.5.5.2 — Tampilan relasi wali-siswa pada kartu mobile akurat untuk seluruh bentuk response tanpa nama dummy atau ID siswa', () => {
    // 1. Satu wali dengan satu siswa
    const singleStudentParent = {
      id: 'parent-rel-1',
      tenant_id: 'tenant-gor-101',
      name: 'Siti Aminah',
      email: 'siti@mail.com',
      phone: '6285711223344',
      status: 'active',
      invitationStatus: 'ACTIVATED',
      links: [
        { student: { id: 'std-101', name: 'Fajar Nugroho', kk_last4: '8899' } }
      ]
    };
    const singleMeta = resolveParentLinkedStudents(singleStudentParent);
    assert.equal(singleMeta.count, 1);
    assert.equal(singleMeta.items[0].displayName, 'Fajar Nugroho');
    assert.equal(singleMeta.items[0].hasValidName, true);

    // 2. Satu wali dengan beberapa siswa
    const multiStudentParent = {
      id: 'parent-rel-2',
      tenant_id: 'tenant-gor-101',
      name: 'Budi Santoso',
      email: 'budi@mail.com',
      phone: '6281234567890',
      status: 'active',
      invitationStatus: 'ACTIVATED',
      links: [
        { student: { id: 'std-201', name: 'Rizky Pratama', kk_last4: '4321' } },
        { student: { id: 'std-202', student_name: 'Nadia Pratama', kk_last4: '4321' } },
        { student: { id: 'std-203', studentName: 'Bagas Pratama', kk_last4: '4321' } }
      ]
    };
    const multiMeta = resolveParentLinkedStudents(multiStudentParent);
    assert.equal(multiMeta.count, 3);
    assert.deepEqual(
      multiMeta.items.map((i) => i.displayName),
      ['Rizky Pratama', 'Nadia Pratama', 'Bagas Pratama']
    );

    // 3. Relasi student berbentuk object (prioritas student_name, fallback name, studentName, full_name)
    assert.equal(resolveStudentNameFromRecord({ id: 's-1', name: 'Dimas Anggara' }), 'Dimas Anggara');
    assert.equal(resolveStudentNameFromRecord({ id: 's-2', name: null, student_name: 'Ayu Lestari' }), 'Ayu Lestari');
    assert.equal(resolveStudentNameFromRecord({ id: 's-2b', name: 'Nama Lama', student_name: 'Nama Utama Student' }), 'Nama Utama Student');
    assert.equal(resolveStudentNameFromRecord({ id: 's-3', studentName: 'Raka Saputra' }), 'Raka Saputra');
    assert.equal(resolveStudentNameFromRecord({ id: 's-4', full_name: 'Kirana Putri' }), 'Kirana Putri');

    // 4. Relasi student berbentuk array jika didukung response PostgREST
    const arrayStudentParent = {
      id: 'parent-rel-array',
      tenant_id: 'tenant-gor-101',
      name: 'Hendra Wijaya',
      email: 'hendra@mail.com',
      phone: '6281999888777',
      status: 'pending',
      invitationStatus: 'READY_TO_SEND',
      links: [
        {
          parent_account_id: 'parent-rel-array',
          student: [
            { id: 'std-301', name: 'Galih Wijaya', kk_last4: '1122' },
            { id: 'std-302', student_name: 'Ratna Wijaya', kk_last4: '1122' }
          ]
        }
      ]
    };
    const arrayMeta = resolveParentLinkedStudents(arrayStudentParent);
    assert.equal(arrayMeta.count, 2);
    assert.deepEqual(
      arrayMeta.items.map((i) => i.displayName),
      ['Galih Wijaya', 'Ratna Wijaya']
    );

    // 5. Relasi student null
    const nullStudentParent = {
      id: 'parent-rel-null',
      tenant_id: 'tenant-gor-101',
      name: 'Wali Relasi Null',
      email: 'nullrel@mail.com',
      phone: '6281222333444',
      status: 'pending',
      invitationStatus: 'READY_TO_SEND',
      links: [
        { parent_account_id: 'parent-rel-null', student_id: '550e8400-e29b-41d4-a716-446655440000', student: null }
      ]
    };
    const nullMeta = resolveParentLinkedStudents(nullStudentParent);
    assert.equal(nullMeta.count, 1);
    assert.equal(nullMeta.items[0].hasValidName, false);
    assert.equal(nullMeta.items[0].displayName, UNAVAILABLE_STUDENT_NAME_LABEL);
    assert.equal(nullMeta.items[0].displayName, 'Nama siswa belum tersedia');

    // 6. Nama siswa kosong / whitespace / hanya ID (tidak boleh menampilkan ID sebagai nama atau nama palsu)
    const emptyNameParent = {
      id: 'parent-rel-empty-name',
      tenant_id: 'tenant-gor-101',
      name: 'Wali Nama Siswa Kosong',
      email: 'emptyname@mail.com',
      phone: '6281555666777',
      status: 'pending',
      invitationStatus: 'READY_TO_SEND',
      links: [
        { student: { id: '550e8400-e29b-41d4-a716-446655440001', name: '' } },
        { student: { id: 'std-custom-id-99', name: '   ' } },
        { student: { id: '550e8400-e29b-41d4-a716-446655440002', name: '550e8400-e29b-41d4-a716-446655440002' } }
      ]
    };
    const emptyNameMeta = resolveParentLinkedStudents(emptyNameParent);
    assert.equal(emptyNameMeta.count, 3);
    assert.ok(emptyNameMeta.items.every((i) => i.hasValidName === false));
    assert.ok(emptyNameMeta.items.every((i) => i.displayName === 'Nama siswa belum tersedia'));

    // 7. Jumlah siswa sesuai dengan jumlah relasi & 8. Tenant berbeda ditolak saat render SSR
    const mixedTestParents = [
      singleStudentParent,
      multiStudentParent,
      arrayStudentParent,
      nullStudentParent,
      emptyNameParent,
      {
        id: 'parent-other-tenant-777',
        tenant_id: 'tenant-other-999',
        name: 'Wali Cabang Lain',
        email: 'other@cabanglain.id',
        phone: '6281888999000',
        status: 'active',
        invitationStatus: 'ACTIVATED',
        links: [
          { student: { id: 'std-foreign-1', name: 'Siswa Cabang Lain' } }
        ]
      }
    ];

    (globalThis as any).window.innerWidth = 390;
    const htmlRendered = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: mixedTestParents
        })
      )
    );

    // Nama lengkap siswa tampil jelas
    assert.ok(htmlRendered.includes('Fajar Nugroho'));
    assert.ok(htmlRendered.includes('Rizky Pratama'));
    assert.ok(htmlRendered.includes('Nadia Pratama'));
    assert.ok(htmlRendered.includes('Bagas Pratama'));
    assert.ok(htmlRendered.includes('Galih Wijaya'));
    assert.ok(htmlRendered.includes('Ratna Wijaya'));

    // Keterangan jujur saat nama tidak tersedia
    assert.ok(htmlRendered.includes('Nama siswa belum tersedia'));

    // Jumlah siswa sesuai dengan jumlah relasi (1, 3, 2, 1, 3 -> total 10 di KPI)
    assert.ok(htmlRendered.includes('Siswa Terhubung (1)'));
    assert.ok(htmlRendered.includes('Siswa Terhubung (3)'));
    assert.ok(htmlRendered.includes('Siswa Terhubung (2)'));

    // Tidak menampilkan ID siswa sebagai nama
    assert.equal(htmlRendered.includes('550e8400-e29b-41d4-a716-446655440000'), false);
    assert.equal(htmlRendered.includes('550e8400-e29b-41d4-a716-446655440001'), false);
    assert.equal(htmlRendered.includes('550e8400-e29b-41d4-a716-446655440002'), false);
    assert.equal(htmlRendered.includes('std-custom-id-99'), false);

    // 8. Tenant berbeda tidak boleh ditampilkan
    assert.equal(htmlRendered.includes('Wali Cabang Lain'), false);
    assert.equal(htmlRendered.includes('Siswa Cabang Lain'), false);

    // Jika data relasi gagal dimuat (links: null / linksError: true), tampilkan pesan jujur dan jangan klaim daftar nama tampil
    const failedRelParent = {
      id: 'parent-rel-failed',
      tenant_id: 'tenant-gor-101',
      name: 'Wali Gagal Relasi',
      email: 'failedrel@mail.com',
      phone: '6281777888999',
      status: 'active',
      invitationStatus: 'ACTIVATED',
      links: null
    };
    const htmlFailedRel = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(MobileParentManagementMain, {
          userProfile: mockOwnerProfile,
          initialParents: [failedRelParent]
        })
      )
    );
    assert.ok(htmlFailedRel.includes('Data relasi siswa gagal dimuat'));
    assert.equal(htmlFailedRel.includes('mobile-parent-student-chip-named'), false);

    // 9. Tampilan desktop tetap tidak berubah
    (globalThis as any).window.innerWidth = 1280;
    const htmlDesktopUnchanged = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
        React.createElement(ParentManagementPage, { userProfile: mockOwnerProfile })
      )
    );
    assert.ok(htmlDesktopUnchanged.includes('Manajemen Wali Murid'));
    assert.equal(htmlDesktopUnchanged.includes('mobile-parent-management-main'), false);
  });

  /* ========================================================================= */
  /* TEST 20: Phase 4.5.5.2.1 — Backend Response Contract & Mobile Integration */
  /* ========================================================================= */
  await t.test('TEST 20 [CONTRACT INTEGRATION]: Phase 4.5.5.2.1 — Kontrak Endpoint GET /api/tenant/parents dengan Mock Supabase REST Response (Skenario A-H)', async () => {
    const mockSupabaseUrl = 'https://mock-supabase.local';
    const mockServiceKey = 'service-role-key';
    const appUrl = 'https://chuvator.pages.dev';
    const activeTenantId = 'tenant-gor-101';
    const originalFetch = globalThis.fetch;
    let capturedUrls: string[] = [];

    const createContext = (tenantId = activeTenantId, role = 'owner') => ({
      request: new Request('https://chuvator.pages.dev/api/tenant/parents', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-staff-token',
          'Origin': appUrl,
          'x-test-staff-role': role,
          'x-test-staff-uid': 'staff-uid-101',
          'x-test-tenant-id': tenantId,
          'Content-Type': 'application/json'
        }
      }),
      env: {
        SUPABASE_URL: mockSupabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: mockServiceKey,
        SUPABASE_ANON_KEY: 'mock-anon-key',
        KK_HMAC_SECRET: 'test-hmac-secret-1234567890123456',
        APP_URL: appUrl,
        ALLOWED_ORIGINS: appUrl,
        ENVIRONMENT: 'development'
      }
    });

    try {
      // Skenario A, B, C, D, E, G, H dalam satu alur integrasi endpoint -> Mobile UI
      capturedUrls = [];
      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        capturedUrls.push(urlStr);

        if (urlStr.includes('/rest/v1/parent_accounts')) {
          return new Response(
            JSON.stringify([
              {
                id: 'parent-a',
                tenant_id: activeTenantId,
                auth_uid: null,
                full_name: 'Wali Skenario A',
                email: 'walia@mail.com',
                phone: '6281211110001',
                created_at: '2026-11-01T00:00:00Z'
              },
              {
                id: 'parent-b',
                tenant_id: activeTenantId,
                auth_uid: null,
                full_name: 'Wali Skenario B',
                email: 'walib@mail.com',
                phone: '6281211110002',
                created_at: '2026-11-01T00:00:00Z'
              },
              {
                id: 'parent-c',
                tenant_id: activeTenantId,
                auth_uid: null,
                full_name: 'Wali Skenario C',
                email: 'walic@mail.com',
                phone: '6281211110003',
                created_at: '2026-11-01T00:00:00Z'
              },
              {
                id: 'parent-d',
                tenant_id: activeTenantId,
                auth_uid: null,
                full_name: 'Wali Skenario D Multi Siswa',
                email: 'walid@mail.com',
                phone: '6281211110004',
                created_at: '2026-11-01T00:00:00Z'
              },
              {
                id: 'parent-e',
                tenant_id: activeTenantId,
                auth_uid: null,
                full_name: 'Wali Skenario E Tanpa Siswa',
                email: 'walie@mail.com',
                phone: '6281211110005',
                created_at: '2026-11-01T00:00:00Z'
              },
              // G. Parent milik tenant lain seandainya lolos dari REST mock
              {
                id: 'parent-foreign',
                tenant_id: 'tenant-other-999',
                auth_uid: null,
                full_name: 'Wali Tenant Asing',
                email: 'foreign@mail.com',
                phone: '6281299999999',
                created_at: '2026-11-01T00:00:00Z'
              }
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (urlStr.includes('/rest/v1/parent_student_links')) {
          return new Response(
            JSON.stringify([
              // A. Siswa dengan student_name terisi dan name null + H. Nomor KK lengkap di mock DB
              {
                parent_account_id: 'parent-a',
                student: {
                  id: 'std-a1',
                  name: null,
                  student_name: 'Arjuna Wijaya',
                  kk_last4: '1122',
                  kk: '3506019988771122',
                  no_kk: '3506019988771122',
                  kk_hmac: 'secret-hmac-hash-value'
                }
              },
              // B. Siswa dengan student_name dan name keduanya terisi (prioritas student_name)
              {
                parent_account_id: 'parent-b',
                student: {
                  id: 'std-b1',
                  name: 'Bima Nama Lama',
                  student_name: 'Bima Sakti Utama',
                  kk_last4: '3344'
                }
              },
              // C. Siswa dengan student_name kosong dan name terisi (fallback ke name)
              {
                parent_account_id: 'parent-c',
                student: {
                  id: 'std-c1',
                  name: 'Citra Lestari Fallback',
                  student_name: '   ',
                  kk_last4: '5566'
                }
              },
              // D. Satu wali dengan beberapa siswa
              {
                parent_account_id: 'parent-d',
                student: {
                  id: 'std-d1',
                  name: null,
                  student_name: 'Daffa Pratama',
                  kk_last4: '7788'
                }
              },
              {
                parent_account_id: 'parent-d',
                student: {
                  id: 'std-d2',
                  name: 'Dinda Pratama',
                  student_name: null,
                  kk_last4: '7788'
                }
              },
              // G. Relasi milik tenant lain yang mencoba bocor ke parent aktif maupun parent asing
              {
                parent_account_id: 'parent-a',
                student: {
                  id: 'std-foreign-leak-1',
                  tenant_id: 'tenant-other-999',
                  name: 'Siswa Bocor Tenant Lain',
                  student_name: 'Siswa Bocor Tenant Lain',
                  kk_last4: '9999'
                }
              },
              {
                parent_account_id: 'parent-foreign',
                student: {
                  id: 'std-foreign-leak-2',
                  name: 'Siswa Wali Asing',
                  student_name: 'Siswa Wali Asing',
                  kk_last4: '0000'
                }
              }
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify([]), { status: 200 });
      };

      const res = await parentListHandler(createContext() as any);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.linksError, false);

      // Buktikan bahwa endpoint benar-benar meminta kolom student_name pada query REST Supabase
      const linksQueryUrl = capturedUrls.find((u) => u.includes('/rest/v1/parent_student_links'));
      assert.ok(linksQueryUrl, 'Endpoint wajib memanggil /rest/v1/parent_student_links');
      assert.ok(
        linksQueryUrl.includes('select=parent_account_id,student:students(id,name,student_name,kk_last4)'),
        `Query parent_student_links wajib meminta id,name,student_name,kk_last4. Aktual: ${linksQueryUrl}`
      );

      const parentsData: any[] = body.data;
      // G. Parent tenant asing ditolak
      assert.equal(parentsData.some((p) => p.id === 'parent-foreign'), false);

      // A. Siswa dengan student_name terisi dan name null
      const parentA = parentsData.find((p) => p.id === 'parent-a');
      assert.ok(parentA);
      assert.equal(parentA.linksError, false);
      assert.equal(parentA.links.length, 1, 'Siswa bocor dari tenant lain wajib ditolak dari links parent-a');
      assert.equal(parentA.links[0].student.student_name, 'Arjuna Wijaya');
      assert.equal(parentA.links[0].student.name, 'Arjuna Wijaya');
      assert.equal(parentA.links[0].student.kk_last4, '1122');

      // H. Nomor KK lengkap tidak boleh masuk response
      const rawJsonString = JSON.stringify(body);
      assert.equal(rawJsonString.includes('3506019988771122'), false, 'Nomor KK 16 digit lengkap dilarang masuk ke response');
      assert.equal(rawJsonString.includes('secret-hmac-hash-value'), false, 'kk_hmac dilarang masuk ke response');
      assert.equal('kk' in parentA.links[0].student, false);
      assert.equal('no_kk' in parentA.links[0].student, false);

      // B. Siswa dengan student_name dan name terisi -> prioritas student_name
      const parentB = parentsData.find((p) => p.id === 'parent-b');
      assert.ok(parentB);
      assert.equal(parentB.links.length, 1);
      assert.equal(parentB.links[0].student.student_name, 'Bima Sakti Utama');
      assert.equal(parentB.links[0].student.name, 'Bima Sakti Utama');

      // C. Siswa dengan student_name kosong dan name terisi -> fallback ke name
      const parentC = parentsData.find((p) => p.id === 'parent-c');
      assert.ok(parentC);
      assert.equal(parentC.links.length, 1);
      assert.equal(parentC.links[0].student.student_name, null);
      assert.equal(parentC.links[0].student.name, 'Citra Lestari Fallback');

      // D. Satu wali dengan beberapa siswa
      const parentD = parentsData.find((p) => p.id === 'parent-d');
      assert.ok(parentD);
      assert.equal(parentD.links.length, 2);
      assert.deepEqual(
        parentD.links.map((l: any) => l.student.name),
        ['Daffa Pratama', 'Dinda Pratama']
      );

      // E. Wali tanpa relasi siswa (query berhasil namun belum ada link)
      const parentE = parentsData.find((p) => p.id === 'parent-e');
      assert.ok(parentE);
      assert.equal(parentE.linksError, false);
      assert.ok(Array.isArray(parentE.links));
      assert.equal(parentE.links.length, 0);

      // Verifikasi render langsung hasil response endpoint pada MobileParentManagementMain
      (globalThis as any).window.innerWidth = 390;
      const htmlSuccessContract = renderToString(
        React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
          React.createElement(MobileParentManagementMain, {
            userProfile: mockOwnerProfile,
            initialParents: parentsData
          })
        )
      );

      assert.ok(htmlSuccessContract.includes('Arjuna Wijaya'), 'Skenario A: student_name tampil di kartu mobile');
      assert.ok(htmlSuccessContract.includes('Bima Sakti Utama'), 'Skenario B: prioritas student_name tampil di kartu mobile');
      assert.equal(htmlSuccessContract.includes('Bima Nama Lama'), false, 'Skenario B: name lama tidak menimpa student_name');
      assert.ok(htmlSuccessContract.includes('Citra Lestari Fallback'), 'Skenario C: fallback name tampil di kartu mobile');
      assert.ok(htmlSuccessContract.includes('Daffa Pratama'), 'Skenario D: siswa ke-1 tampil di kartu mobile');
      assert.ok(htmlSuccessContract.includes('Dinda Pratama'), 'Skenario D: siswa ke-2 tampil di kartu mobile');
      assert.ok(htmlSuccessContract.includes('Belum ada siswa terhubung'), 'Skenario E: wali tanpa siswa menampilkan Belum ada siswa terhubung');
      assert.equal(htmlSuccessContract.includes('Data relasi siswa gagal dimuat'), false);
      assert.equal(htmlSuccessContract.includes('Siswa Bocor Tenant Lain'), false, 'Skenario G: tidak ada kebocoran siswa antar-tenant');
      assert.equal(htmlSuccessContract.includes('Siswa Wali Asing'), false, 'Skenario G: tidak ada kebocoran wali antar-tenant');

      // F. Query relasi parent_student_links gagal (mis. HTTP 500 dari Supabase REST)
      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/rest/v1/parent_accounts')) {
          return new Response(
            JSON.stringify([
              {
                id: 'parent-f',
                tenant_id: activeTenantId,
                auth_uid: null,
                full_name: 'Wali Skenario F Error Relasi',
                email: 'walif@mail.com',
                phone: '6281211110006',
                created_at: '2026-11-01T00:00:00Z'
              }
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr.includes('/rest/v1/parent_student_links')) {
          return new Response(JSON.stringify({ message: 'Database relation query error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      };

      const resFailedLinks = await parentListHandler(createContext() as any);
      assert.equal(resFailedLinks.status, 200);
      const bodyFailedLinks = await resFailedLinks.json();
      assert.equal(bodyFailedLinks.success, true);
      assert.equal(bodyFailedLinks.linksError, true, 'Top-level linksError wajib true ketika query parent_student_links gagal');
      assert.equal(bodyFailedLinks.data.length, 1);
      assert.equal(bodyFailedLinks.data[0].linksError, true, 'Record wali wajib memiliki linksError: true ketika query relasi gagal');
      assert.equal(bodyFailedLinks.data[0].links, null, 'Record wali wajib memiliki links: null (bukan array kosong) ketika query relasi gagal');

      const htmlFailedContract = renderToString(
        React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
          React.createElement(MobileParentManagementMain, {
            userProfile: mockOwnerProfile,
            initialParents: bodyFailedLinks.data
          })
        )
      );

      assert.ok(
        htmlFailedContract.includes('Data relasi siswa gagal dimuat'),
        'Skenario F: Mobile UI wajib menampilkan "Data relasi siswa gagal dimuat" ketika query relasi gagal'
      );
      assert.equal(
        htmlFailedContract.includes('Belum ada siswa terhubung'),
        false,
        'Skenario F: Mobile UI dilarang menyatakan wali belum memiliki siswa ketika query relasi gagal'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  /* ========================================================================= */
  /* TEST 21: Phase 4.5.5.2.2 — React DOM Mount & Service Mock Integration     */
  /* ========================================================================= */
  await t.test('TEST 21 [REACT DOM MOUNT + SERVICE MOCK]: Phase 4.5.5.2.2 — Mount MobileParentManagementMain dengan createRoot & act, verifikasi loading state dan 8 skenario parentService.getParentAccounts', async () => {
    const { container } = setupMiniDOMEnvironment();
    const root = createRoot(container as any);
    const originalGetParents = parentService.getParentAccounts;

    try {
      // 3A. Component Mount: Loading state -> getParentAccounts dipanggil -> student_name, fallback name, multi-student, count
      let getParentsCallCount = 0;
      let resolveInitialMount: ((data: any) => void) | null = null;

      parentService.getParentAccounts = () => {
        getParentsCallCount += 1;
        return new Promise((resolve) => {
          resolveInitialMount = resolve;
        });
      };

      await act(async () => {
        root.render(
          React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
            React.createElement(MobileParentManagementMain, {
              userProfile: mockOwnerProfile
            })
          )
        );
      });

      // Saat request masih berjalan, loading state wajib muncul dan parentService.getParentAccounts telah dipanggil
      assert.equal(getParentsCallCount, 1, 'parentService.getParentAccounts wajib dipanggil saat mount');
      assert.ok(container.innerHTML.includes('mobile-parent-loading'), 'Loading state wajib tampil saat request sedang berjalan');

      // Selesaikan request dengan data:
      // - Wali 1: 1 siswa (student_name terisi, name null)
      // - Wali 2: beberapa siswa (student_name terisi + fallback name ketika student_name kosong)
      await act(async () => {
        resolveInitialMount!([
          {
            id: 'dom-p-1',
            tenant_id: 'tenant-gor-101',
            full_name: 'Wali Mount Satu',
            email: 'mount1@mail.com',
            phone: '6281210000001',
            status: 'active',
            invitationStatus: 'ACTIVATED',
            links: [
              { student: { id: 'dom-s-1', student_name: 'Naufal Pratama', name: null, kk_last4: '1234' } }
            ]
          },
          {
            id: 'dom-p-2',
            tenant_id: 'tenant-gor-101',
            full_name: 'Wali Mount Multi',
            email: 'mount2@mail.com',
            phone: '6281210000002',
            status: 'pending',
            invitationStatus: 'READY_TO_SEND',
            links: [
              { student: { id: 'dom-s-2', student_name: 'Zahra Putri', name: 'Zahra Lama', kk_last4: '5678' } },
              { student: { id: 'dom-s-3', student_name: '', name: 'Reza Fallback', kk_last4: '5678' } }
            ]
          }
        ]);
      });

      assert.equal(container.innerHTML.includes('mobile-parent-loading'), false, 'Loading state wajib hilang setelah response diterima');
      assert.ok(container.innerHTML.includes('Naufal Pratama'), 'Nama siswa dari student_name wajib tampil');
      assert.ok(container.innerHTML.includes('Zahra Putri'), 'Prioritas student_name wajib tampil');
      assert.equal(container.innerHTML.includes('Zahra Lama'), false);
      assert.ok(container.innerHTML.includes('Reza Fallback'), 'Fallback name wajib tampil ketika student_name kosong');
      assert.ok(container.innerHTML.includes('Siswa Terhubung (1)'), 'Jumlah siswa (1) wajib sesuai relasi');
      assert.ok(container.innerHTML.includes('Siswa Terhubung (2)'), 'Jumlah siswa (2) wajib sesuai relasi');

      await act(async () => {
        root.unmount();
      });

      // 3B. Uji ke-8 skenario Service Mock Integration melalui mount nyata
      const scenarios: Array<{
        name: string;
        mockFn: () => Promise<any>;
        verify: (html: string) => void;
      }> = [
        {
          name: '1. Satu wali dengan satu siswa',
          mockFn: async () => [
            {
              id: 'sc1-p',
              tenant_id: 'tenant-gor-101',
              full_name: 'Wali Skenario 1',
              email: 'sc1@mail.com',
              phone: '6281200000001',
              links: [{ student: { id: 'sc1-s', student_name: 'Aldi Taher Siswa', name: null } }]
            }
          ],
          verify: (html) => {
            assert.ok(html.includes('Aldi Taher Siswa'));
            assert.ok(html.includes('Siswa Terhubung (1)'));
          }
        },
        {
          name: '2. Satu wali dengan beberapa siswa',
          mockFn: async () => [
            {
              id: 'sc2-p',
              tenant_id: 'tenant-gor-101',
              full_name: 'Wali Skenario 2',
              email: 'sc2@mail.com',
              phone: '6281200000002',
              links: [
                { student: { id: 'sc2-s1', student_name: 'Bayu Siswa 1', name: null } },
                { student: { id: 'sc2-s2', student_name: 'Bela Siswa 2', name: null } },
                { student: { id: 'sc2-s3', student_name: 'Bimo Siswa 3', name: null } }
              ]
            }
          ],
          verify: (html) => {
            assert.ok(html.includes('Bayu Siswa 1'));
            assert.ok(html.includes('Bela Siswa 2'));
            assert.ok(html.includes('Bimo Siswa 3'));
            assert.ok(html.includes('Siswa Terhubung (3)'));
          }
        },
        {
          name: '3. student_name tersedia, name null',
          mockFn: async () => [
            {
              id: 'sc3-p',
              tenant_id: 'tenant-gor-101',
              full_name: 'Wali Skenario 3',
              email: 'sc3@mail.com',
              phone: '6281200000003',
              links: [{ student: { id: 'sc3-s', student_name: 'Cahya StudentName', name: null } }]
            }
          ],
          verify: (html) => {
            assert.ok(html.includes('Cahya StudentName'));
          }
        },
        {
          name: '4. student_name kosong, name tersedia',
          mockFn: async () => [
            {
              id: 'sc4-p',
              tenant_id: 'tenant-gor-101',
              full_name: 'Wali Skenario 4',
              email: 'sc4@mail.com',
              phone: '6281200000004',
              links: [{ student: { id: 'sc4-s', student_name: '   ', name: 'Dewi FallbackName' } }]
            }
          ],
          verify: (html) => {
            assert.ok(html.includes('Dewi FallbackName'));
          }
        },
        {
          name: '5. links kosong',
          mockFn: async () => [
            {
              id: 'sc5-p',
              tenant_id: 'tenant-gor-101',
              full_name: 'Wali Skenario 5',
              email: 'sc5@mail.com',
              phone: '6281200000005',
              links: []
            }
          ],
          verify: (html) => {
            assert.ok(html.includes('Siswa Terhubung (0)'));
            assert.ok(html.includes('Belum ada siswa terhubung'));
            assert.equal(html.includes('Data relasi siswa gagal dimuat'), false);
          }
        },
        {
          name: '6. linksError true',
          mockFn: async () => [
            {
              id: 'sc6-p',
              tenant_id: 'tenant-gor-101',
              full_name: 'Wali Skenario 6',
              email: 'sc6@mail.com',
              phone: '6281200000006',
              linksError: true,
              links: []
            }
          ],
          verify: (html) => {
            assert.ok(html.includes('Data relasi siswa gagal dimuat'));
            assert.equal(html.includes('Belum ada siswa terhubung'), false);
          }
        },
        {
          name: '7. links null',
          mockFn: async () => [
            {
              id: 'sc7-p',
              tenant_id: 'tenant-gor-101',
              full_name: 'Wali Skenario 7',
              email: 'sc7@mail.com',
              phone: '6281200000007',
              links: null
            }
          ],
          verify: (html) => {
            assert.ok(html.includes('Data relasi siswa gagal dimuat'));
            assert.equal(html.includes('Belum ada siswa terhubung'), false);
          }
        },
        {
          name: '8. Response gagal atau HTTP error',
          mockFn: async () => {
            throw new Error('HTTP 500: Gagal mengambil daftar akun wali murid dari server.');
          },
          verify: (html) => {
            assert.ok(html.includes('mobile-parent-error'));
            assert.ok(html.includes('HTTP 500: Gagal mengambil daftar akun wali murid dari server.'));
          }
        }
      ];

      for (const sc of scenarios) {
        const subEnv = setupMiniDOMEnvironment();
        const subRoot = createRoot(subEnv.container as any);
        let called = 0;
        parentService.getParentAccounts = async () => {
          called += 1;
          return sc.mockFn();
        };

        await act(async () => {
          subRoot.render(
            React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
              React.createElement(MobileParentManagementMain, {
                userProfile: mockOwnerProfile
              })
            )
          );
        });

        assert.equal(called, 1, `parentService.getParentAccounts wajib terpanggil pada skenario: ${sc.name}`);
        sc.verify(subEnv.container.innerHTML);

        await act(async () => {
          subRoot.unmount();
        });
      }
    } finally {
      parentService.getParentAccounts = originalGetParents;
    }
  });

  /* ========================================================================= */
  /* TEST 22: Phase 4.5.5.2.2 — Endpoint Handler -> parentService -> React Mount*/
  /* ========================================================================= */
  await t.test('TEST 22 [ENDPOINT -> SERVICE -> REACT MOUNT]: Phase 4.5.5.2.2 — Handler asli onRequestGet diteruskan melalui parentService.getParentAccounts ke mount MobileParentManagementMain', async () => {
    const originalFetch = globalThis.fetch;
    const originalGetParents = parentService.getParentAccounts;
    const mockSupabaseUrl = 'https://mock-supabase.local';
    const activeTenantId = 'tenant-gor-101';
    const capturedSupabaseUrls: string[] = [];

    try {
      globalThis.fetch = async (url: any) => {
        const urlStr = String(url);
        capturedSupabaseUrls.push(urlStr);

        if (urlStr.includes('/rest/v1/parent_accounts')) {
          return new Response(
            JSON.stringify([
              {
                id: 'ep-parent-1',
                tenant_id: activeTenantId,
                auth_uid: null,
                full_name: 'Hendra Kusuma',
                email: 'hendra@mail.com',
                phone: '6281230000001',
                created_at: '2026-11-01T00:00:00Z'
              },
              {
                id: 'ep-parent-2',
                tenant_id: activeTenantId,
                auth_uid: null,
                full_name: 'Lina Marlina',
                email: 'lina@mail.com',
                phone: '6281230000002',
                created_at: '2026-11-01T00:00:00Z'
              }
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (urlStr.includes('/rest/v1/parent_student_links')) {
          return new Response(
            JSON.stringify([
              {
                parent_account_id: 'ep-parent-1',
                student: {
                  id: 'ep-std-1',
                  name: null,
                  student_name: 'Kevin Kusuma',
                  kk_last4: '3506011234569876', // akan disanitasi menjadi 4 digit terakhir '9876'
                  kk: '3506011234569876',
                  kk_hmac: 'hmac-secret-dont-leak'
                }
              },
              {
                parent_account_id: 'ep-parent-2',
                student: {
                  id: 'ep-std-2',
                  name: 'Putri Marlina Fallback',
                  student_name: null,
                  kk_last4: '4321'
                }
              }
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify([]), { status: 200 });
      };

      // Hubungkan parentService.getParentAccounts langsung ke eksekusi onRequestGet asli
      parentService.getParentAccounts = async () => {
        const ctx = {
          request: new Request('https://chuvator.pages.dev/api/tenant/parents', {
            method: 'GET',
            headers: {
              'Authorization': 'Bearer test-staff-token',
              'Origin': 'https://chuvator.pages.dev',
              'x-test-staff-role': 'owner',
              'x-test-staff-uid': 'staff-uid-101',
              'x-test-tenant-id': activeTenantId
            }
          }),
          env: {
            SUPABASE_URL: mockSupabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
            KK_HMAC_SECRET: 'hmac-secret-1234567890123456',
            APP_URL: 'https://chuvator.pages.dev',
            ALLOWED_ORIGINS: 'https://chuvator.pages.dev',
            ENVIRONMENT: 'development'
          }
        };
        const response = await parentListHandler(ctx as any);
        const payload = await response.json();
        // Verifikasi kontrak di lapisan boundary:
        assert.equal(JSON.stringify(payload).includes('3506011234569876'), false, 'Nomor KK 16 digit tidak boleh bocor');
        assert.equal(JSON.stringify(payload).includes('hmac-secret-dont-leak'), false, 'HMAC tidak boleh bocor');
        assert.equal(payload.data[0].links[0].student.kk_last4, '9876', 'kk_last4 wajib dibatasi maksimal 4 digit');
        return payload.data;
      };

      const { container } = setupMiniDOMEnvironment();
      const root = createRoot(container as any);

      await act(async () => {
        root.render(
          React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
            React.createElement(MobileParentManagementMain, {
              userProfile: mockOwnerProfile
            })
          )
        );
      });

      const linksQuery = capturedSupabaseUrls.find((u) => u.includes('/rest/v1/parent_student_links'));
      assert.ok(linksQuery?.includes('select=parent_account_id,student:students(id,name,student_name,kk_last4)'));

      // Pastikan relasi parent tidak tertukar di DOM kartu masing-masing
      const cardParent1 = container.findByTestId('mobile-parent-card-ep-parent-1');
      const cardParent2 = container.findByTestId('mobile-parent-card-ep-parent-2');
      assert.ok(cardParent1, 'Kartu ep-parent-1 wajib ter-render');
      assert.ok(cardParent2, 'Kartu ep-parent-2 wajib ter-render');
      assert.ok(cardParent1!.innerHTML.includes('Kevin Kusuma'), 'ep-parent-1 wajib menampilkan Kevin Kusuma');
      assert.equal(cardParent1!.innerHTML.includes('Putri Marlina Fallback'), false, 'Relasi tidak boleh tertukar ke ep-parent-1');
      assert.ok(cardParent2!.innerHTML.includes('Putri Marlina Fallback'), 'ep-parent-2 wajib menampilkan Putri Marlina Fallback');
      assert.equal(cardParent2!.innerHTML.includes('Kevin Kusuma'), false, 'Relasi tidak boleh tertukar ke ep-parent-2');

      await act(async () => {
        root.unmount();
      });
    } finally {
      globalThis.fetch = originalFetch;
      parentService.getParentAccounts = originalGetParents;
    }
  });

  /* ========================================================================= */
  /* TEST 23: Phase 4.5.5.2.2 — React Lifecycle (1-6) & Timer/Subscription Audit*/
  /* ========================================================================= */
  await t.test('TEST 23 [REACT LIFECYCLE & CLEANUP]: Phase 4.5.5.2.2 — Mount/Unmount saat request berjalan, pergantian Tenant A -> Tenant B, proteksi late response Tenant A, dan cleanup timer saat unmount', async () => {
    const originalGetParents = parentService.getParentAccounts;

    const tenantAProfile = {
      tenantId: 'tenant-A',
      role: 'owner',
      tenant: { id: 'tenant-A', name: 'GOR CABANG A' }
    };
    const tenantBProfile = {
      tenantId: 'tenant-B',
      role: 'owner',
      tenant: { id: 'tenant-B', name: 'GOR CABANG B' }
    };

    try {
      // Skenario Lifecycle 2: Mount -> request masih berjalan -> unmount -> response selesai setelah unmount
      {
        const { container } = setupMiniDOMEnvironment();
        const root = createRoot(container as any);
        let resolvePendingRequest: ((val: any) => void) | null = null;

        parentService.getParentAccounts = () =>
          new Promise((resolve) => {
            resolvePendingRequest = resolve;
          });

        await act(async () => {
          root.render(
            React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
              React.createElement(MobileParentManagementMain, {
                userProfile: tenantAProfile
              })
            )
          );
        });

        assert.ok(container.innerHTML.includes('mobile-parent-loading'));

        // Unmount ketika request masih in-flight
        await act(async () => {
          root.unmount();
        });
        assert.equal(container.innerHTML, '');

        // Selesaikan request setelah unmount -> tidak boleh melempar error atau memodifikasi DOM
        await act(async () => {
          resolvePendingRequest!([
            {
              id: 'unmounted-parent',
              tenant_id: 'tenant-A',
              full_name: 'Wali Setelah Unmount',
              links: [{ student: { id: 's-u', student_name: 'Siswa Unmount' } }]
            }
          ]);
        });
        assert.equal(container.innerHTML, '');
      }

      // Skenario Lifecycle 3, 4, 5:
      // - Mount dengan Tenant A (request A berjalan lambat)
      // - Tenant berubah menjadi Tenant B saat request A belum selesai
      // - Request Tenant B selesai lebih dulu dan merender data Tenant B
      // - Response Tenant A akhirnya datang terlambat -> TIDAK BOLEH menimpa data Tenant B!
      {
        const { container } = setupMiniDOMEnvironment();
        const root = createRoot(container as any);

        let resolveTenantA: ((val: any) => void) | null = null;
        let resolveTenantB: ((val: any) => void) | null = null;
        let callIdx = 0;

        parentService.getParentAccounts = () => {
          callIdx += 1;
          if (callIdx === 1) {
            return new Promise((resolve) => {
              resolveTenantA = resolve;
            });
          }
          return new Promise((resolve) => {
            resolveTenantB = resolve;
          });
        };

        // 1. Mount dengan Tenant A
        await act(async () => {
          root.render(
            React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
              React.createElement(MobileParentManagementMain, {
                userProfile: tenantAProfile
              })
            )
          );
        });
        assert.equal(callIdx, 1);

        // 2. Ubah prop userProfile ke Tenant B sementara request Tenant A belum selesai
        await act(async () => {
          root.render(
            React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
              React.createElement(MobileParentManagementMain, {
                userProfile: tenantBProfile
              })
            )
          );
        });
        assert.equal(callIdx, 2, 'Perubahan tenant wajib memicu fetch baru untuk Tenant B');

        // 3. Selesaikan request Tenant B terlebih dahulu
        await act(async () => {
          resolveTenantB!([
            {
              id: 'parent-tenant-b',
              tenant_id: 'tenant-B',
              full_name: 'Wali Resmi Tenant B',
              email: 'walib@gorb.id',
              phone: '6281299990002',
              links: [{ student: { id: 'std-b', student_name: 'Siswa Cabang B Resmi' } }]
            }
          ]);
        });

        assert.ok(container.innerHTML.includes('Wali Resmi Tenant B'));
        assert.ok(container.innerHTML.includes('Siswa Cabang B Resmi'));

        // 4. Sekarang response Tenant A yang terlambat akhirnya datang (bahkan seandainya berisi record tanpa filter)
        await act(async () => {
          resolveTenantA!([
            {
              id: 'parent-tenant-a-stale',
              tenant_id: 'tenant-B', // sengaja disamakan untuk menguji bahwa sequence guard fetchSeqRef benar-benar menolak stale response!
              full_name: 'Wali Stale Dari Request A',
              email: 'stale@gora.id',
              phone: '6281299990001',
              links: [{ student: { id: 'std-a-stale', student_name: 'Siswa Stale Request A' } }]
            }
          ]);
        });

        // Buktikan response lama dari Request A TIDAK menimpa data Tenant B!
        assert.ok(
          container.innerHTML.includes('Wali Resmi Tenant B'),
          'Data Tenant B wajib tetap tampil dan tidak tertimpa response terlambat dari Request A'
        );
        assert.ok(container.innerHTML.includes('Siswa Cabang B Resmi'));
        assert.equal(
          container.innerHTML.includes('Wali Stale Dari Request A'),
          false,
          'Response terlambat dari Request A wajib diabaikan oleh request sequence guard'
        );
        assert.equal(container.innerHTML.includes('Siswa Stale Request A'), false);

        await act(async () => {
          root.unmount();
        });
      }

      // Skenario Lifecycle 6: Komponen di-unmount ketika timer notifikasi masih aktif
      {
        const { container } = setupMiniDOMEnvironment();
        const root = createRoot(container as any);
        const originalSetTimeout = globalThis.setTimeout;
        const originalClearTimeout = globalThis.clearTimeout;
        const activeTimers = new Set<any>();
        let clearedTimerCount = 0;

        globalThis.setTimeout = ((fn: any, ms?: number, ...args: any[]) => {
          const id = originalSetTimeout(fn, ms, ...args);
          if (ms === 5000 || ms === 3000) {
            activeTimers.add(id);
          }
          return id;
        }) as any;

        globalThis.clearTimeout = ((id: any) => {
          if (activeTimers.has(id)) {
            activeTimers.delete(id);
            clearedTimerCount += 1;
          }
          return originalClearTimeout(id);
        }) as any;

        try {
          const mockSvcTimer = {
            getParentAccounts: async () => [
              {
                id: 'p-timer-1',
                tenant_id: 'tenant-A',
                full_name: 'Wali Timer Test',
                email: 'timer@mail.com',
                phone: '6281277778888',
                links: [{ student: { id: 's-t1', student_name: 'Siswa Timer' } }]
              }
            ]
          };

          await act(async () => {
            root.render(
              React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
                React.createElement(MobileParentManagementMain, {
                  userProfile: tenantAProfile,
                  serviceOverride: mockSvcTimer,
                  initialActionMessage: {
                    type: 'success',
                    text: 'Notifikasi aktif 5 detik sebelum unmount'
                  }
                })
              )
            );
          });

          assert.ok(container.innerHTML.includes('Notifikasi aktif 5 detik sebelum unmount'));
          assert.equal(activeTimers.size, 1, 'Timer notifikasi 5000ms wajib terdaftar saat banner notifikasi aktif');

          // Unmount komponen ketika timer notifikasi masih aktif dan pastikan clearTimeout dipanggil
          await act(async () => {
            root.unmount();
          });

          assert.equal(activeTimers.size, 0, 'Tidak boleh ada timer komponen yang tertinggal setelah unmount');
          assert.equal(clearedTimerCount, 1, 'clearTimeout wajib dipanggil tepat 1 kali untuk membersihkan timer notifikasi saat unmount');
        } finally {
          globalThis.setTimeout = originalSetTimeout;
          globalThis.clearTimeout = originalClearTimeout;
        }
      }

      // 3E. Audit kode sumber untuk memastikan tidak ada klaim palsu terkait subscription
      const mobileSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/mobile/pages/admin/MobileParentManagementMain.jsx'),
        'utf8'
      );
      assert.equal(
        mobileSource.includes('.channel('),
        false,
        'MobileParentManagementMain tidak menggunakan Supabase realtime channel'
      );
      assert.equal(
        mobileSource.includes('addEventListener('),
        false,
        'MobileParentManagementMain tidak mendaftarkan window/document event listener'
      );
    } finally {
      parentService.getParentAccounts = originalGetParents;
    }
  });

  /* ========================================================================= */
  /* TEST 24: Phase 4.5.5.2.2 — Dynamic Tenant Isolation (Section 4)           */
  /* ========================================================================= */
  await t.test('TEST 24 [TENANT ISOLATION LIFECYCLE]: Phase 4.5.5.2.2 — Isolasi penuh saat transisi Tenant A -> Tenant B -> Tenant Kosong tanpa kebocoran data sebelumnya', async () => {
    const { container } = setupMiniDOMEnvironment();
    const root = createRoot(container as any);
    let fetchCalls = 0;

    const mixedBackendList = [
      {
        id: 'p-ten-a',
        tenant_id: 'tenant-A',
        full_name: 'Wali Cabang A',
        email: 'a@cabang.id',
        phone: '6281200010001',
        links: [{ student: { id: 's-a', student_name: 'Siswa Milik Tenant A' } }]
      },
      {
        id: 'p-ten-b',
        tenant_id: 'tenant-B',
        full_name: 'Wali Cabang B',
        email: 'b@cabang.id',
        phone: '6281200020002',
        links: [{ student: { id: 's-b', student_name: 'Siswa Milik Tenant B' } }]
      },
      {
        id: 'p-no-tenant',
        tenant_id: null,
        full_name: 'Wali Tanpa Tenant ID',
        email: 'notenant@cabang.id',
        phone: '6281200030003',
        links: [{ student: { id: 's-nt', student_name: 'Siswa Tanpa Tenant' } }]
      }
    ];

    const mockSvc = {
      getParentAccounts: async () => {
        fetchCalls += 1;
        return mixedBackendList;
      }
    };

    // 1. Mount sebagai Tenant A
    await act(async () => {
      root.render(
        React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
          React.createElement(MobileParentManagementMain, {
            userProfile: { tenantId: 'tenant-A', role: 'owner', tenant: { id: 'tenant-A', name: 'CABANG A' } },
            serviceOverride: mockSvc
          })
        )
      );
    });

    assert.equal(fetchCalls, 1);
    assert.ok(container.innerHTML.includes('Wali Cabang A'));
    assert.ok(container.innerHTML.includes('Siswa Milik Tenant A'));
    assert.equal(container.innerHTML.includes('Wali Cabang B'), false);
    assert.equal(container.innerHTML.includes('Siswa Milik Tenant B'), false);
    assert.equal(container.innerHTML.includes('Wali Tanpa Tenant ID'), false);

    // 2. Ganti ke Tenant B -> hanya menerima parent Tenant B, data Tenant A langsung hilang
    await act(async () => {
      root.render(
        React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
          React.createElement(MobileParentManagementMain, {
            userProfile: { tenantId: 'tenant-B', role: 'owner', tenant: { id: 'tenant-B', name: 'CABANG B' } },
            serviceOverride: mockSvc
          })
        )
      );
    });

    assert.equal(fetchCalls, 2);
    assert.ok(container.innerHTML.includes('Wali Cabang B'));
    assert.ok(container.innerHTML.includes('Siswa Milik Tenant B'));
    assert.equal(container.innerHTML.includes('Wali Cabang A'), false, 'Data Tenant A tidak boleh tersisa setelah pindah ke Tenant B');
    assert.equal(container.innerHTML.includes('Siswa Milik Tenant A'), false);
    assert.equal(container.innerHTML.includes('Wali Tanpa Tenant ID'), false);

    // 3. Ganti ke profil tanpa tenant (meskipun memiliki id & uid) -> TIDAK melakukan fetch dan menampilkan pesan konteks tidak tersedia
    await act(async () => {
      root.render(
        React.createElement(MemoryRouter, { initialEntries: ['/parents'] },
          React.createElement(MobileParentManagementMain, {
            userProfile: { id: 'user-id-fallback-forbidden', uid: 'user-uid-fallback-forbidden', role: 'owner' },
            serviceOverride: mockSvc
          })
        )
      );
    });

    assert.equal(fetchCalls, 2, 'Tenant kosong dilarang memicu pemanggilan getParentAccounts');
    assert.ok(container.innerHTML.includes('mobile-parent-no-tenant'));
    assert.equal(container.innerHTML.includes('Wali Cabang B'), false);

    await act(async () => {
      root.unmount();
    });
  });
});


