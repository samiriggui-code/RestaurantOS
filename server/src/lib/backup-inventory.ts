import { readdir, stat } from 'fs/promises'
import path from 'path'
import { Client } from 'minio'

export type BackupKind = 'postgres' | 'fiscal'

export type BackupInventoryRow = {
  id: string
  filename: string
  kind: BackupKind
  kindLabel: string
  dayKey: string
  createdAt: string
  sizeBytes: number
  sizeLabel: string
  source: 'minio' | 'local'
  status: 'ok'
}

export type BackupInventoryResult = {
  month: string
  backups: BackupInventoryRow[]
  minioConfigured: boolean
  localDirConfigured: boolean
}

const MONTH_RE = /^\d{4}-\d{2}$/
const BACKUP_FILENAME_RE =
  /^(pizzeria|fiscal_archives)_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.(sql\.gz|tar\.gz)$/

const KIND_LABEL: Record<BackupKind, string> = {
  postgres: 'Base PostgreSQL',
  fiscal: 'Archives fiscales',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function assertValidMonth(month: string): void {
  if (!MONTH_RE.test(month)) {
    throw new Error('Paramètre month invalide (attendu YYYY-MM)')
  }
}

function parseBackupFilename(filename: string): {
  kind: BackupKind
  dayKey: string
  createdAt: Date
} | null {
  const match = BACKUP_FILENAME_RE.exec(filename)
  if (!match) return null

  const [, prefix, dayKey, timePart] = match
  const kind: BackupKind = prefix === 'fiscal_archives' ? 'fiscal' : 'postgres'
  const [hh, mm, ss] = timePart.split('-').map((v) => parseInt(v, 10))
  const [y, m, d] = dayKey.split('-').map((v) => parseInt(v, 10))
  const createdAt = new Date(y, m - 1, d, hh, mm, ss)

  return { kind, dayKey, createdAt }
}

function rowFromFile(
  filename: string,
  sizeBytes: number,
  source: 'minio' | 'local',
  lastModified?: Date,
): BackupInventoryRow | null {
  const parsed = parseBackupFilename(filename)
  if (!parsed) return null

  const createdAt = lastModified ?? parsed.createdAt

  return {
    id: `${source}:${filename}`,
    filename,
    kind: parsed.kind,
    kindLabel: KIND_LABEL[parsed.kind],
    dayKey: parsed.dayKey,
    createdAt: createdAt.toISOString(),
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    source,
    status: 'ok',
  }
}

function inMonth(dayKey: string, month: string): boolean {
  return dayKey.startsWith(`${month}-`)
}

function parseMinioEndpoint(): { endPoint: string; port: number; useSSL: boolean } {
  const raw = process.env.MINIO_ENDPOINT?.trim() || 'http://pizzeria-minio:9000'
  const url = new URL(raw)
  const defaultPort = url.protocol === 'https:' ? 443 : 9000
  return {
    endPoint: url.hostname,
    port: url.port ? parseInt(url.port, 10) : defaultPort,
    useSSL: url.protocol === 'https:',
  }
}

function createMinioClient(): Client | null {
  if (process.env.MINIO_ENABLED !== 'true') return null
  const accessKey = process.env.MINIO_ROOT_USER?.trim()
  const secretKey = process.env.MINIO_ROOT_PASSWORD?.trim()
  if (!accessKey || !secretKey) return null

  const { endPoint, port, useSSL } = parseMinioEndpoint()
  return new Client({ endPoint, port, useSSL, accessKey, secretKey })
}

async function listMinioBackups(month: string): Promise<BackupInventoryRow[]> {
  const client = createMinioClient()
  if (!client) return []

  const bucket = process.env.MINIO_BUCKET?.trim() || 'pizzeria-backups'
  const prefixes = ['postgres/', 'fiscal/'] as const
  const rows: BackupInventoryRow[] = []

  for (const prefix of prefixes) {
    const stream = client.listObjectsV2(bucket, prefix, true)
    for await (const obj of stream) {
      if (!obj.name) continue
      const filename = path.basename(obj.name)
      const parsed = parseBackupFilename(filename)
      if (!parsed || !inMonth(parsed.dayKey, month)) continue

      const row = rowFromFile(
        filename,
        obj.size ?? 0,
        'minio',
        obj.lastModified,
      )
      if (row) rows.push(row)
    }
  }

  return rows
}

async function listLocalBackups(month: string): Promise<BackupInventoryRow[]> {
  const backupDir = process.env.BACKUP_DIR?.trim()
  if (!backupDir) return []

  let entries: string[]
  try {
    entries = await readdir(backupDir)
  } catch {
    return []
  }

  const rows: BackupInventoryRow[] = []
  for (const filename of entries) {
    const parsed = parseBackupFilename(filename)
    if (!parsed || !inMonth(parsed.dayKey, month)) continue

    try {
      const fileStat = await stat(path.join(backupDir, filename))
      if (!fileStat.isFile()) continue
      const row = rowFromFile(filename, fileStat.size, 'local', fileStat.mtime)
      if (row) rows.push(row)
    } catch {
      // fichier supprimé entre-temps
    }
  }

  return rows
}

function mergeBackupRows(minioRows: BackupInventoryRow[], localRows: BackupInventoryRow[]): BackupInventoryRow[] {
  const byFilename = new Map<string, BackupInventoryRow>()

  for (const row of localRows) {
    byFilename.set(row.filename, row)
  }
  for (const row of minioRows) {
    byFilename.set(row.filename, row)
  }

  return [...byFilename.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function listMonthlyBackups(month: string): Promise<BackupInventoryResult> {
  assertValidMonth(month)

  const minioConfigured = process.env.MINIO_ENABLED === 'true'
  const localDirConfigured = Boolean(process.env.BACKUP_DIR?.trim())

  const [minioRows, localRows] = await Promise.all([
    listMinioBackups(month).catch((err) => {
      console.error('[backup-inventory/minio]', err)
      return [] as BackupInventoryRow[]
    }),
    listLocalBackups(month),
  ])

  return {
    month,
    backups: mergeBackupRows(minioRows, localRows),
    minioConfigured,
    localDirConfigured,
  }
}

export function currentMonthKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
