import { render } from '@react-email/render'
import type { ReactElement } from 'react'

const PRINT_TOOLBAR = `
<div class="no-print" style="text-align:center;padding:16px;background:#f9f6f2;border-top:1px solid #e8e0d5;margin-top:8px">
  <p style="font-size:11px;color:#5c534a;margin:0 0 10px">Ctrl+P ou bouton ci-dessous pour enregistrer en PDF</p>
  <button type="button" onclick="window.print()" style="background:#c0392b;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:14px;font-weight:600;padding:10px 24px">Imprimer / Enregistrer PDF</button>
</div>`

/** Rendu HTML document professionnel (facture, rapport, journal fiscal). */
export async function renderPrintDocument(element: ReactElement): Promise<string> {
  const html = await render(element, { pretty: true })
  if (html.includes('</body>')) {
    return html.replace('</body>', `${PRINT_TOOLBAR}</body>`)
  }
  return html + PRINT_TOOLBAR
}
