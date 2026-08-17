'use client'

import { useState } from 'react'
import { Copy, Download, Smartphone, Usb, Wifi } from 'lucide-react'

type ApkKind = 'pos-sunmi' | 'pos-tablet' | 'kds' | 'livreur'

const APK_FILES: Record<ApkKind, { file: string; label: string }> = {
  'pos-sunmi': { file: 'pos-sunmi.apk', label: 'Caisse SUNMI V2' },
  'pos-tablet': { file: 'pos-tablet.apk', label: 'Caisse tablette' },
  kds: { file: 'kds.apk', label: 'Écran cuisine KDS' },
  livreur: { file: 'livreur.apk', label: 'Livreur' },
}

export function ApkInstallGuide({ kind }: { kind: ApkKind }) {
  const meta = APK_FILES[kind]
  const [sunmiIp, setSunmiIp] = useState('')
  const [copied, setCopied] = useState(false)
  const href =
    typeof window !== 'undefined'
      ? `${window.location.origin}/downloads/${meta.file}`
      : `/downloads/${meta.file}`

  const pushCmd = sunmiIp.trim()
    ? `.\\deploy\\scripts\\push-apk-to-sunmi.ps1 -SunmiIp ${sunmiIp.trim()}`
    : ''

  async function copyCmd() {
    if (!pushCmd) return
    await navigator.clipboard.writeText(pushCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-amber-100">
        <Smartphone className="h-4 w-4" />
        Installer l&apos;app {meta.label}
      </h3>
      <p className="text-xs leading-relaxed text-cream/60">
        {kind === 'pos-sunmi' ? (
          <>
            Le <strong className="text-cream/80">SUNMI V2 n&apos;a pas de navigateur</strong>. Installez
            l&apos;APK une fois — ensuite l&apos;icône « La Z Pizza » ouvre la caisse toute seule.
            <span className="mt-1 block text-cream/50">Mode portrait (terminal caisse).</span>
          </>
        ) : kind === 'pos-tablet' ? (
          <>
            Tablette Android en <strong className="text-cream/80">mode paysage</strong> — caisse comptoir
            (Epson réseau, pas imprimante SUNMI intégrée).
          </>
        ) : kind === 'livreur' ? (
          <>
            Téléphone livreur en <strong className="text-cream/80">mode portrait</strong> — tournée GPS,
            code client, récap du jour. <strong className="text-cream/80">Pas de jumelage</strong> : ouvrir
            l&apos;app → saisir votre <strong className="text-cream/80">PIN livreur</strong> (celui du
            planning, ex. Lucas).
          </>
        ) : (
          <>
            Tablette cuisine en <strong className="text-cream/80">mode paysage</strong> — APK dédié KDS
            (recommandé) ou Chrome.
          </>
        )}
      </p>

      <a
        href={href}
        download
        className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2.5 text-sm font-medium text-white hover:bg-tomato-light"
      >
        <Download className="h-4 w-4" />
        Télécharger l&apos;APK {meta.label}
      </a>

      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-cream/55">
        <p className="mb-2 font-medium text-cream/75">Workflow dev (sur ton PC)</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Android Studio → ouvrir dossier <code className="text-cream/70">android\</code></li>
          <li>
            <code className="text-cream/70">.\deploy\scripts\build-sunmi-lab.ps1</code>
          </li>
          <li>
            <code className="text-cream/70">.\deploy\scripts\pack-for-vps.ps1</code> → APK sur le serveur +
            bouton ci-dessus actif
          </li>
        </ol>
      </div>

      <p className="text-xs font-medium text-cream/70">Sur place — choix A ou B</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 p-3 text-xs text-cream/60">
          <p className="mb-1 flex items-center gap-1 font-medium text-cream/80">
            <Usb className="h-3.5 w-3.5" /> A — USB (le plus simple)
          </p>
          <p>
            Câble USB → copier <code className="text-cream/70">{meta.file}</code> dans{' '}
            <strong>Download</strong> du SUNMI (Explorateur Windows) → Fichiers → Installer.
            {kind === 'pos-sunmi' && (
              <>
                {' '}
                Si « Application non installée » : désinstallez d&apos;abord toute ancienne app « La Z
                Pizza » (Paramètres → Applications).
              </>
            )}
          </p>
        </div>
        {kind === 'pos-sunmi' && (
          <div className="rounded-lg border border-white/10 p-3 text-xs text-cream/60">
            <p className="mb-1 flex items-center gap-1 font-medium text-cream/80">
              <Wifi className="h-3.5 w-3.5" /> B — Wi‑Fi (PC sur le même réseau)
            </p>
            <label className="block">
              <span className="text-cream/50">IP locale du SUNMI (ex. 192.168.1.42)</span>
              <input
                value={sunmiIp}
                onChange={(e) => setSunmiIp(e.target.value)}
                placeholder="192.168.1.42"
                className="mt-1 w-full rounded-lg border border-white/15 bg-charcoal px-2 py-1.5 font-mono text-sm"
              />
            </label>
            {pushCmd && (
              <button
                type="button"
                onClick={() => void copyCmd()}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/15 py-1.5 hover:bg-white/5"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copié !' : 'Copier commande PowerShell'}
              </button>
            )}
            <p className="mt-2 text-[11px] text-cream/45">
              PC + SUNMI sur le Wi‑Fi boutique. Débogage USB ou sans fil activé sur le SUNMI. Le VPS ne
              peut pas pousser l&apos;APK sur une IP locale.
            </p>
          </div>
        )}
      </div>

      <p className="text-[11px] text-cream/40">
        {kind === 'livreur' ? (
          <>
            Après install : icône La Z Pizza Livreur → PIN personnel (planning) ou PIN équipe livraison.
          </>
        ) : (
          <>
            Après install : icône La Z Pizza → code jumelage 6 chiffres → PIN employé (
            {kind === 'pos-sunmi' || kind === 'pos-tablet' ? '1234 caisse' : '5678 cuisine'}).
          </>
        )}
      </p>

      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-cream/60">
        <p className="mb-1 font-medium text-emerald-100/90">C — Mise à jour sans câble (OTA)</p>
        <p>
          À partir de la v1.0.19, l&apos;APK vérifie{' '}
          <code className="text-cream/70">/downloads/apk-manifest.json</code> au démarrage. Si une
          version plus récente est sur le serveur, elle se télécharge et remplace l&apos;ancienne
          (même certificat — pas de désinstallation). Confirmez une fois « Installer » sur l&apos;écran
          Android. La <strong className="text-cream/80">première</strong> install de l&apos;APK OTA reste
          en USB ou Wi‑Fi ADB ; ensuite les MAJ sont automatiques.
        </p>
      </div>
    </section>
  )
}
