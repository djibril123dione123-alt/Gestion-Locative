import { createHash } from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MODE = process.argv[2] ?? 'seed';
const DOCUMENTS_ONLY = process.argv.includes('--documents-only');
const AGENCY_ID = 'd3e00000-0000-4000-8000-000000000001';
const ADMIN_EMAIL = 'admin@demo.samaykeur.test';
const ADMIN_PASSWORD = 'TerangaDemo!2026';
const AGENCY_NAME = 'Teranga Gestion Immobiliere';
const BUCKET = 'documents';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VERIFY_BASE = String(process.env.VITE_PUBLIC_VERIFY_BASE_URL || 'https://samaykeur.com')
  .replace(/\/+$/, '');

if (!['seed', 'reset', 'verify'].includes(MODE)) {
  throw new Error(`Mode inconnu: ${MODE}. Utilisez seed, reset ou verify.`);
}
if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis.');
}
if (!SERVICE_KEY && !DOCUMENTS_ONLY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY est requis pour seed/reset/verify. ' +
    'Cette cle reste exclusivement dans le terminal et ne doit jamais etre prefixee par VITE_.',
  );
}

const service = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const user = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sha256(value) {
  const input = typeof value === 'string' || value instanceof Uint8Array
    ? value
    : JSON.stringify(value);
  return createHash('sha256').update(input).digest('hex');
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function xof(value) {
  return `${new Intl.NumberFormat('fr-FR').format(Number(value || 0))} F CFA`;
}

function sanitize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'document';
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function rpc(client, name, params = {}) {
  const { data, error } = await client.rpc(name, params);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

async function signInDemoAdmin() {
  const { data, error } = await user.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (error || !data.user) throw new Error(`Connexion demo impossible: ${error?.message ?? 'profil absent'}`);
  return data.user;
}

async function listStorageFiles(client, prefix) {
  const files = [];
  async function walk(path) {
    let offset = 0;
    while (true) {
      const { data, error } = await client.storage.from(BUCKET).list(path, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`Lecture Storage ${path}: ${error.message}`);
      for (const entry of data ?? []) {
        const child = path ? `${path}/${entry.name}` : entry.name;
        if (entry.id || entry.metadata) files.push(child);
        else await walk(child);
      }
      if (!data || data.length < 100) break;
      offset += data.length;
    }
  }
  await walk(prefix);
  return files;
}

async function removeDemoStorage(client) {
  const prefix = `agencies/${AGENCY_ID}`;
  const files = await listStorageFiles(client, prefix);
  for (let index = 0; index < files.length; index += 100) {
    const { error } = await client.storage.from(BUCKET).remove(files.slice(index, index + 100));
    if (error) throw new Error(`Nettoyage Storage: ${error.message}`);
  }
  return files.length;
}

async function registerVerification(spec, payloadHash) {
  const data = await rpc(user, 'register_document_verification_command', {
    p_agency_id: AGENCY_ID,
    p_document_ref: spec.reference,
    p_document_type: spec.verificationType,
    p_agency_name: AGENCY_NAME,
    p_issued_at: new Date().toISOString(),
    p_amount_xof: spec.amount ?? null,
    p_payment_status: spec.paymentStatus ?? null,
    p_payload_hash: payloadHash,
    p_metadata: {
      source: 'official_demo_seed',
      period: spec.period,
      fictitious_data: true,
    },
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id || !row?.token) throw new Error(`QR Verify invalide pour ${spec.reference}`);
  return row;
}

async function buildDemoPdf(spec, verification) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const primary = [6, 78, 59];
  const accent = [217, 119, 6];
  const verifyUrl = `${VERIFY_BASE}/verify?token=${verification.token}&ref=${encodeURIComponent(spec.reference)}&type=${spec.verificationType}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 240, margin: 1, errorCorrectionLevel: 'M' });

  doc.setProperties({
    title: `${spec.title} - ${spec.reference}`,
    author: AGENCY_NAME,
    subject: spec.subject,
    keywords: `Samay Keur, gestion locative, ${spec.verificationType}, demonstration`,
    creator: 'Samay Keur',
  });
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(AGENCY_NAME, 16, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Gestion locative professionnelle - Dakar, Senegal', 16, 19);
  doc.text(spec.reference, pageWidth - 16, 12, { align: 'right' });
  doc.text(new Intl.DateTimeFormat('fr-FR').format(new Date()), pageWidth - 16, 19, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(spec.title, 16, 44);
  doc.setDrawColor(...accent);
  doc.setLineWidth(1.2);
  doc.line(16, 49, 70, 49);

  doc.setFillColor(247, 250, 249);
  doc.roundedRect(16, 57, pageWidth - 32, 34, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(spec.leftLabel, 22, 67);
  doc.text(spec.rightLabel, pageWidth - 22, 67, { align: 'right' });
  doc.setFontSize(13);
  doc.setTextColor(...primary);
  doc.text(spec.leftValue, 22, 78);
  doc.text(spec.rightValue, pageWidth - 22, 78, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  let y = 104;
  for (const section of spec.sections) {
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, 16, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(section.body, pageWidth - 48);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 8;
    doc.setTextColor(15, 23, 42);
  }

  if (spec.rows?.length) {
    doc.setFont('helvetica', 'bold');
    doc.text('Detail de la periode', 16, y);
    y += 8;
    doc.setFontSize(8);
    spec.rows.slice(0, 6).forEach((row, index) => {
      doc.setFillColor(index % 2 ? 250 : 244, 247, 246);
      doc.rect(16, y - 4, pageWidth - 48, 8, 'F');
      doc.setTextColor(30, 41, 59);
      doc.text(String(row[0]), 20, y + 1);
      doc.text(String(row[1]), 85, y + 1);
      doc.text(String(row[2]), pageWidth - 38, y + 1, { align: 'right' });
      y += 9;
    });
  }

  doc.addImage(qrDataUrl, 'PNG', pageWidth - 42, 247, 25, 25);
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('QR de verification actif', pageWidth - 29.5, 277, { align: 'center' });
  doc.text('Document fictif reserve aux demonstrations Samay Keur.', 16, 268);
  doc.text('Empreinte et reference enregistrees dans le registre documentaire.', 16, 274);
  return new Uint8Array(doc.output('arraybuffer'));
}

function buildDocumentSpecs(context) {
  const year = new Date().getFullYear();
  const period = monthKey();
  const contracts = context.contracts;
  const owners = context.owners;
  const payments = context.payments;
  const specs = [];
  const definitions = [
    ['quittance', 'quittance', 'Quittance de loyer', 'Quittance de loyer', 3],
    ['contrat', 'contrat', 'Contrat de location', 'Contrat de location', 2],
    ['mandat', 'mandat', 'Mandat de gestion', 'Mandat de gestion immobiliere', 2],
    ['rapport_bailleur', 'rapport_bailleur', 'Rapport bailleur', 'Rapport financier de gestion locative', 3],
    ['facture', 'facture', 'Facture de gestion', 'Facture de gestion locative', 2],
  ];
  let serial = 1;
  for (const [type, verificationType, title, subject, count] of definitions) {
    for (let index = 0; index < count; index += 1) {
      const contract = contracts[(serial * 5) % contracts.length];
      const owner = owners[(serial * 7) % owners.length];
      const payment = payments[(serial * 11) % payments.length];
      const prefix = type === 'rapport_bailleur' ? 'RPT' : type.slice(0, 3).toUpperCase();
      const reference = `DEMO-${prefix}-${year}-${String(serial).padStart(4, '0')}`;
      const amount = Number(payment?.montant_total || contract?.loyer_mensuel || 0);
      specs.push({
        type,
        verificationType,
        title,
        subject,
        reference,
        period,
        entityId: type === 'mandat' || type === 'rapport_bailleur' ? owner.id : contract.id,
        amount,
        paymentStatus: type === 'quittance' || type === 'facture' ? 'paye' : null,
        leftLabel: type === 'rapport_bailleur' ? 'Bailleur' : 'Dossier',
        leftValue: type === 'rapport_bailleur' ? `${owner.prenom} ${owner.nom}` : reference,
        rightLabel: type === 'rapport_bailleur' ? 'Net de la periode' : 'Montant de reference',
        rightValue: xof(type === 'rapport_bailleur' ? amount * 4 : amount),
        sections: [
          { title: 'Identification', body: `Document genere pour le compte fictif ${AGENCY_NAME}. Les donnees presentees servent exclusivement aux demonstrations commerciales et tests visuels.` },
          { title: type === 'contrat' ? 'Conditions essentielles' : type === 'mandat' ? 'Etendue de la gestion' : 'Synthese de la periode', body: type === 'contrat' ? `Loyer mensuel: ${xof(contract.loyer_mensuel)}. Caution et conditions sont rattachees au bail enregistre.` : type === 'mandat' ? `Le mandat organise la gestion, les encaissements, le suivi documentaire et le reporting du portefeuille de ${owner.prenom} ${owner.nom}.` : `Encaissements, reliquats, commissions et depenses sont issus des ecritures du compte de demonstration.` },
        ],
        rows: [
          ['Loyer mensuel', period, xof(contract.loyer_mensuel)],
          ['Reglement enregistre', period, xof(amount)],
          ['Commission de gestion', period, xof(Math.round(amount * 0.08))],
        ],
      });
      serial += 1;
    }
  }
  return specs;
}

async function reserveManagedDocument(spec, bytes, payloadHash) {
  const reservation = await rpc(user, 'fn_prepare_managed_document', {
    p_document_type: spec.type,
    p_entity_id: spec.entityId,
    p_period: spec.period,
    p_reference: spec.reference,
    p_data_hash: payloadHash,
    p_file_size: bytes.byteLength,
    p_mime_type: 'application/pdf',
    p_retention_policy: 'critical',
    p_metadata: {
      file_name: `${spec.reference}.pdf`,
      source: 'official_demo_seed',
      fictitious_data: true,
    },
    p_template_revision_id: null,
    p_template_checksum: sha256(`official-demo-template:${spec.type}:v1`),
    p_renderer_version: 'official-demo-seed-v1',
    p_asset_checksums: {},
  });
  const result = Array.isArray(reservation) ? reservation[0] : reservation;
  if (!result?.entry?.id) throw new Error(`Reservation documentaire invalide: ${spec.reference}`);
  return result;
}

async function createManagedDocument(spec, adminUser) {
  const payloadHash = sha256(stableJson(spec));
  const verification = await registerVerification(spec, payloadHash);
  const bytes = await buildDemoPdf(spec, verification);
  const reservation = await reserveManagedDocument(spec, bytes, payloadHash);
  if (reservation.reused) return reservation.entry;
  const version = Number(reservation.entry.version || 1);
  const folders = {
    contrat: 'contrats', mandat: 'mandats', quittance: 'quittances',
    facture: 'factures', rapport_bailleur: 'rapports-bailleurs',
  };
  const path = `agencies/${AGENCY_ID}/${folders[spec.type]}/${spec.period.slice(0, 4)}/${spec.period.slice(5, 7)}/${sanitize(spec.reference)}${version > 1 ? `-v${version}` : ''}.pdf`;
  const { error: uploadError } = await user.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'application/pdf', cacheControl: '31536000', upsert: false,
  });
  if (uploadError) {
    await rpc(user, 'fn_abort_managed_document', { p_registry_id: reservation.entry.id });
    throw new Error(`Upload ${spec.reference}: ${uploadError.message}`);
  }
  const { data: finalized, error: finalizeError } = await user.functions.invoke('finalize-managed-document', {
    body: { registryId: reservation.entry.id, storagePath: path },
  });
  if (finalizeError || !finalized?.data?.id) {
    await user.storage.from(BUCKET).remove([path]);
    await rpc(user, 'fn_abort_managed_document', { p_registry_id: reservation.entry.id });
    throw new Error(`Finalisation ${spec.reference}: ${finalizeError?.message ?? 'reponse invalide'}`);
  }
  await rpc(user, 'link_document_verification_registry_command', {
    p_verification_id: verification.id,
    p_registry_id: finalized.data.id,
    p_registry_version: finalized.data.version,
    p_template_checksum: sha256(`official-demo-template:${spec.type}:v1`),
    p_metadata: { source: 'official_demo_seed', fictitious_data: true },
  });
  const { error: insertError } = await user.from('documents').insert({
    agency_id: AGENCY_ID,
    name: `${spec.title} - ${spec.reference}`,
    file_url: path,
    storage_path: path,
    file_type: 'application/pdf',
    file_size: bytes.byteLength,
    file_hash: finalized.data.file_hash,
    folder: spec.type === 'rapport_bailleur' ? 'exports' : spec.type === 'mandat' ? 'bailleurs' : 'contrats',
    document_category: spec.type === 'rapport_bailleur' ? 'exports' : spec.type === 'mandat' ? 'bailleurs' : 'contrats',
    document_scope: 'generated',
    lifecycle_status: 'active',
    retention_policy: 'critical',
    entity_type: spec.type === 'mandat' || spec.type === 'rapport_bailleur' ? 'bailleur' : 'contrat',
    entity_id: spec.entityId,
    description: 'Document officiel fictif genere par le seed de demonstration.',
    tags: ['official-demo', 'fictitious-data', spec.type],
    uploaded_by: adminUser.id,
  });
  if (insertError) throw new Error(`Index GED ${spec.reference}: ${insertError.message}`);
  return finalized.data;
}

async function createUploadedDocuments(adminUser, context) {
  const definitions = [
    ['administratif', 'Attestation assurance agence', 'agency', AGENCY_ID],
    ['bailleurs', 'Piece mandat bailleur - dossier fictif', 'bailleur', context.owners[0].id],
    ['immeubles', 'Diagnostic technique residence', 'immeuble', context.properties[0].id],
    ['contrats', 'Annexe etat des lieux', 'contrat', context.contracts[0].id],
    ['juridique', 'Reglement interieur type', 'agency', AGENCY_ID],
    ['assurances', 'Attestation multirisque portefeuille', 'agency', AGENCY_ID],
  ];
  for (let index = 0; index < definitions.length; index += 1) {
    const [category, name, entityType, entityId] = definitions[index];
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setProperties({ title: name, author: AGENCY_NAME, subject: 'Piece GED fictive', keywords: 'Samay Keur, GED, demonstration', creator: 'Samay Keur' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(name, 18, 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Document fictif reserve au compte officiel de demonstration Samay Keur.', 18, 45);
    doc.text(`Reference interne: GED-DEMO-${String(index + 1).padStart(3, '0')}`, 18, 55);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    const hash = sha256(bytes);
    const path = `agencies/${AGENCY_ID}/uploads/${category}/${monthKey().replace('-', '/')}/${sanitize(name)}-${hash.slice(0, 12)}.pdf`;
    const { data: existingDocument, error: existingDocumentError } = await user
      .from('documents')
      .select('id')
      .eq('agency_id', AGENCY_ID)
      .eq('storage_path', path)
      .maybeSingle();
    if (existingDocumentError) throw new Error(`Verification GED ${name}: ${existingDocumentError.message}`);
    if (existingDocument) continue;
    const { error: uploadError } = await user.storage.from(BUCKET).upload(path, bytes, {
      contentType: 'application/pdf', cacheControl: '31536000', upsert: true,
    });
    if (uploadError) throw new Error(`Upload GED ${name}: ${uploadError.message}`);
    const { error: insertError } = await user.from('documents').insert({
      agency_id: AGENCY_ID,
      name,
      file_url: path,
      storage_path: path,
      file_type: 'application/pdf',
      file_size: bytes.byteLength,
      file_hash: hash,
      folder: category,
      document_category: category,
      document_scope: 'user_uploaded',
      lifecycle_status: 'active',
      retention_policy: index === 4 ? 'critical' : 'standard',
      entity_type: entityType,
      entity_id: entityId,
      description: 'Piece GED fictive avec rattachement metier valide.',
      tags: ['official-demo', 'fictitious-data', category],
      uploaded_by: adminUser.id,
    });
    if (insertError) throw new Error(`Index GED ${name}: ${insertError.message}`);
  }
}

async function loadDocumentContext() {
  const [contracts, owners, properties, payments] = await Promise.all([
    user.from('contrats').select('id,loyer_mensuel,date_debut,unite_id,locataire_id').eq('agency_id', AGENCY_ID).order('created_at').limit(80),
    user.from('bailleurs').select('id,nom,prenom').eq('agency_id', AGENCY_ID).order('created_at').limit(30),
    user.from('immeubles').select('id,nom').eq('agency_id', AGENCY_ID).order('created_at').limit(25),
    user.from('paiements').select('id,montant_total,contrat_id,date_paiement').eq('agency_id', AGENCY_ID).eq('actif', true).order('date_paiement', { ascending: false }).limit(200),
  ]);
  for (const result of [contracts, owners, properties, payments]) {
    if (result.error) throw new Error(`Contexte documentaire: ${result.error.message}`);
  }
  if (!contracts.data?.length || !owners.data?.length || !properties.data?.length || !payments.data?.length) {
    throw new Error('Le contexte metier du compte de demonstration est incomplet.');
  }
  return { contracts: contracts.data, owners: owners.data, properties: properties.data, payments: payments.data };
}

async function seedDocuments(adminUser) {
  const context = await loadDocumentContext();
  const specs = buildDocumentSpecs(context);
  for (const spec of specs) {
    process.stdout.write(`  - ${spec.reference}... `);
    await createManagedDocument(spec, adminUser);
    console.log('registre, Storage et QR OK');
  }
  await createUploadedDocuments(adminUser, context);
  return { generated: specs.length, uploaded: 6 };
}

async function verifyAll() {
  const core = service ? await rpc(service, 'verify_official_demo_agency') : null;
  const client = service ?? user;
  const [documents, registry, verifications, storage] = await Promise.all([
    client.from('documents').select('id', { count: 'exact', head: true }).eq('agency_id', AGENCY_ID).eq('lifecycle_status', 'active'),
    client.from('document_registry').select('id', { count: 'exact', head: true }).eq('agency_id', AGENCY_ID).eq('status', 'active'),
    client.from('document_verifications').select('id', { count: 'exact', head: true }).eq('agency_id', AGENCY_ID).eq('document_status', 'authentic'),
    listStorageFiles(client, `agencies/${AGENCY_ID}`),
  ]);
  for (const result of [documents, registry, verifications]) {
    if (result.error) throw new Error(`Verification documentaire: ${result.error.message}`);
  }
  const result = {
    ...core,
    documents: documents.count ?? 0,
    registry_documents: registry.count ?? 0,
    qr_verifications: verifications.count ?? 0,
    storage_files: storage.length,
  };
  if ((result.documents ?? 0) < 18 || (result.registry_documents ?? 0) < 12 || (result.qr_verifications ?? 0) < 12 || result.storage_files < 18) {
    throw new Error(`Verification documentaire echouee: ${JSON.stringify(result)}`);
  }
  return result;
}

async function main() {
  console.log(`Compte demo officiel - mode ${MODE}${DOCUMENTS_ONLY ? ' (documents uniquement)' : ''}`);
  if (MODE === 'reset') {
    const removed = await removeDemoStorage(service);
    const result = await rpc(service, 'seed_official_demo_agency', { p_mode: 'reset' });
    console.log(JSON.stringify({ ...result, storage_files_removed: removed }, null, 2));
    return;
  }
  if (MODE === 'verify') {
    await signInDemoAdmin();
    console.log(JSON.stringify(await verifyAll(), null, 2));
    return;
  }
  if (!DOCUMENTS_ONLY) {
    await removeDemoStorage(service);
    const core = await rpc(service, 'seed_official_demo_agency', { p_mode: 'seed' });
    console.log('Donnees metier creees:', JSON.stringify(core));
  }
  const adminUser = await signInDemoAdmin();
  if (DOCUMENTS_ONLY && service) await removeDemoStorage(service);
  const documents = await seedDocuments(adminUser);
  const verification = await verifyAll();
  console.log(JSON.stringify({ mode: 'seed', documents, verification }, null, 2));
}

main()
  .catch((error) => {
    console.error(`Echec seed officiel: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await user.auth.signOut();
  });
