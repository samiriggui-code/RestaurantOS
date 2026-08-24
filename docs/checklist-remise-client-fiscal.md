# Checklist remise client — conformité fiscale

## Avant mise en production

### Technique (éditeur)

- [ ] `FISCAL_HMAC_SECRET` défini en production (distinct de `JWT_SECRET`)
- [ ] `FISCAL_SOFTWARE_VERSION` renseigné
- [ ] Email SMTP configuré (`EMAIL_SERVER_*`) pour reçus fiscaux web
- [ ] SumUp configuré (`SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `API_PUBLIC_BASE_URL`)
- [ ] `npm run fiscal:verify-chain --prefix server` → OK
- [ ] Test clôture Z sur environnement de préprod

### Procédures (gérant)

- [ ] Formation page `/admin/fiscal` (guide intégré)
- [ ] Clôture Z chaque soir de service
- [ ] Export archive en fin d'exercice
- [ ] Procédure annulation = avoir auto vérifié

### Juridique (expert-comptable)

- [ ] Revue `docs/conformite-article-286-cgi.md`
- [ ] Signature `docs/attestation-logiciel-caisse-bofip.md`
- [ ] Dossier conservé 6 ans (tickets + JET + clôtures + archives)

## Communication client

**Formulation recommandée :**

> « Logiciel de caisse RestaurantOS — conformité ISCA (art. 286 CGI) en cours d'attestation. Attestation BOFiP signée par votre expert-comptable requise avant contrôle fiscal. »

**Ne pas dire :** « Certifié NF525 » sans certificat officiel.

## P0 implémentés (juillet 2026)

| Point                                  | Statut |
| -------------------------------------- | ------ |
| Avoir auto annulation payée            | ✅     |
| Garde-fou commandes fiscalisées        | ✅     |
| Ticket fiscal synchrone (POS/comptoir) | ✅     |
| Clôture Z fuseau Europe/Paris          | ✅     |
| Rappel Z + auto 23h55                  | ✅     |
| JET login, prix, démarrage, formation  | ✅     |
| Reçu fiscal email web                  | ✅     |
| Référence TPE manuelle obligatoire     | ✅     |
| Modèle attestation BOFiP               | ✅     |
| Guide gérant in-app                    | ✅     |

## Reste hors périmètre code

- Certification NF525 tierce partie
- Signature expert-comptable (humain)
- Formation présentielle gérant
