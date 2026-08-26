import { PIZZERIA, PROMO } from '@/lib/pizzeria-content'
import { LEGAL_IDENTITY } from '@/lib/legal-identity'
import type { LegalSection } from '@/components/legal/LegalPageShell'

const L = LEGAL_IDENTITY

export function mentionsLegalesSections(): LegalSection[] {
  return [
    {
      id: 'editeur',
      title: 'Éditeur du site',
      paragraphs: [
        `${L.tradeName} est une enseigne exploitée par la société ${L.legalName}, ${L.legalForm}.`,
        `Siège social : ${L.address}.`,
        `Téléphone : ${L.phone} — E-mail : ${L.contactEmail}.`,
        `Directeur de la publication : ${L.directorPublication}.`,
        `SIREN ${L.siren} — SIRET ${L.siret} — TVA intracommunautaire ${L.vatNumber}.`,
        `Code NAF ${L.nafCode} (${L.nafLabel}). Immatriculation RCS ${L.rcsCity}.`,
      ],
    },
    {
      id: 'hebergement',
      title: 'Hébergement',
      paragraphs: [
        `Le site est hébergé par ${L.hostingProvider}.`,
        'Les données de commande et de paiement sont traitées via des connexions chiffrées (HTTPS/TLS).',
      ],
    },
    {
      id: 'propriete',
      title: 'Propriété intellectuelle',
      paragraphs: [
        `L'ensemble des éléments du site (textes, visuels, logo, charte graphique) est protégé. Toute reproduction non autorisée est interdite.`,
        'Les marques et logos de tiers (SumUp, Uber Eats, Deliveroo, etc.) restent la propriété de leurs titulaires respectifs.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      paragraphs: [
        `Pour toute question relative au site ou à une commande : ${L.contactEmail} ou ${L.phone}.`,
      ],
    },
  ]
}

export function confidentialiteSections(): LegalSection[] {
  return [
    {
      id: 'responsable',
      title: 'Responsable du traitement',
      paragraphs: [
        `${L.legalName} — ${L.address}.`,
        `Contact : ${L.contactEmail}.`,
      ],
    },
    {
      id: 'donnees',
      title: 'Données collectées',
      bullets: [
        'Identité et contact : nom, prénom, téléphone, e-mail (commande en ligne).',
        'Adresse de livraison et instructions (livraison uniquement).',
        'Données de commande : articles, montants, statut, canal, horodatage.',
        'Données de paiement : traitées par SumUp (nous ne stockons pas les numéros de carte).',
        'Données techniques : logs serveur, adresse IP (sécurité et statistiques).',
        'Programme fidélité (si activé) : solde de points lié au numéro de téléphone.',
      ],
    },
    {
      id: 'finalites',
      title: 'Finalités et bases légales',
      bullets: [
        'Exécution de la commande et livraison (contrat).',
        'Paiement sécurisé et facturation (contrat / obligation légale).',
        'Service client et suivi de commande (contrat / intérêt légitime).',
        'Obligations comptables et fiscales (obligation légale — conservation des tickets).',
        'Sécurité du site et prévention de la fraude (intérêt légitime).',
      ],
    },
    {
      id: 'duree',
      title: 'Durée de conservation',
      bullets: [
        'Données de commande : durée légale comptable (10 ans pour les pièces justificatives).',
        'Données client inactives : anonymisation ou suppression au-delà de 3 ans sans commande.',
        'Logs techniques : durée limitée (maximum 12 mois).',
      ],
    },
    {
      id: 'destinataires',
      title: 'Destinataires',
      bullets: [
        'Personnel habilité de La Z Pizza (caisse, cuisine, livraison, administration).',
        'Prestataire de paiement en ligne : SumUp.',
        'Hébergeur et maintenance technique du site.',
        'Plateformes partenaires (Uber Eats, Deliveroo) lorsque vous commandez via ces canaux.',
      ],
    },
    {
      id: 'droits',
      title: 'Vos droits',
      paragraphs: [
        'Conformément au RGPD, vous disposez d\'un droit d\'accès, de rectification, d\'effacement, de limitation, d\'opposition et de portabilité.',
        `Exercez vos droits par e-mail à ${L.contactEmail}, en joignant une copie d'un justificatif d'identité si nécessaire.`,
        'Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).',
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies et traceurs',
      paragraphs: [
        'Le site utilise des cookies strictement nécessaires au fonctionnement (session panier, préférences) et, le cas échéant, des cookies de mesure d\'audience.',
        'Vous pouvez configurer votre navigateur pour refuser les cookies non essentiels.',
      ],
    },
  ]
}

export function livraisonSections(): LegalSection[] {
  return [
    {
      id: 'zone',
      title: 'Zone et horaires',
      paragraphs: [
        `Livraison à domicile dans un rayon d'environ ${PIZZERIA.deliveryRadius}, ${PIZZERIA.daysOpen}, de ${PIZZERIA.deliveryHours}.`,
        `Retrait sur place : ${PIZZERIA.fullAddress}.`,
      ],
    },
    {
      id: 'minimum',
      title: 'Minimum de commande et frais',
      paragraphs: [
        'Le minimum de commande en livraison est calculé sur le montant des pizzas uniquement (boissons, desserts et suppléments ne comptent pas pour atteindre le minimum).',
        'Les frais de livraison s\'ajoutent au total et sont affichés avant validation de la commande.',
        'Tableau des communes desservies ci-dessous.',
      ],
    },
    {
      id: 'creneaux',
      title: 'Créneaux',
      paragraphs: [
        'Lors de la commande en ligne, vous choisissez un créneau horaire parmi ceux proposés selon la charge du service.',
        'En cas d\'affluence exceptionnelle, un léger retard peut survenir ; nous vous en informons par téléphone si besoin.',
      ],
    },
    {
      id: 'plateformes',
      title: 'Uber Eats & Deliveroo',
      paragraphs: [
        'Les commandes passées via Uber Eats ou Deliveroo sont préparées en boutique ; leurs livreurs récupèrent la commande sur place.',
        'Tarifs, frais et conditions peuvent différer de ceux du site direct.',
      ],
    },
    {
      id: 'promo',
      title: 'Offres promotionnelles',
      paragraphs: [PROMO.text, PROMO.detail, 'Les conditions détaillées des offres en cours sont indiquées sur le site et au comptoir.'],
    },
  ]
}

export function cgvSections(): LegalSection[] {
  return [
    {
      id: 'champ',
      title: '1. Champ d\'application',
      paragraphs: [
        `Les présentes Conditions Générales de Vente (CGV) s'appliquent aux commandes passées auprès de ${L.tradeName} (${L.legalName}) via le site de commande en ligne, au comptoir ou par téléphone.`,
        'Toute commande implique l\'acceptation sans réserve des présentes CGV.',
      ],
    },
    {
      id: 'produits',
      title: '2. Produits et prix',
      bullets: [
        'Les produits sont décrits sur la carte en ligne ou au comptoir. Les photos sont non contractuelles.',
        'Les prix sont indiqués en euros TTC (TVA alimentaire applicable).',
        'Les prix applicables sont ceux en vigueur au moment de la validation de la commande.',
        'Des offres promotionnelles peuvent s\'appliquer selon les conditions affichées (jour, taille, mode de retrait).',
      ],
    },
    {
      id: 'commande',
      title: '3. Commande',
      bullets: [
        'Commande en ligne : sélection des produits, choix emporter/livraison, coordonnées, paiement ou paiement au comptoir.',
        'La commande est confirmée après paiement accepté (en ligne) ou validation au comptoir.',
        'Un numéro de commande et, le cas échéant, un lien de suivi vous sont communiqués.',
      ],
    },
    {
      id: 'paiement',
      title: '4. Paiement',
      bullets: [
        'Paiement en ligne : carte bancaire via SumUp (3-D Secure lorsque requis).',
        'Paiement au comptoir : espèces, carte ou moyens acceptés en boutique.',
        'Commandes plateformes : règlement selon les conditions Uber Eats / Deliveroo.',
      ],
    },
    {
      id: 'livraison',
      title: '5. Livraison et retrait',
      paragraphs: [
        'Les conditions de livraison (zones, minimums, frais) sont détaillées sur la page Livraison.',
        'Le client s\'assure de la exactitude de l\'adresse et de sa disponibilité au créneau choisi.',
        'En cas d\'absence ou d\'adresse erronée, la commande peut être maintenue au comptoir ou annulée selon les circonstances.',
      ],
    },
    {
      id: 'retractation',
      title: '6. Droit de rétractation',
      paragraphs: [
        'Conformément à l\'article L221-28 du Code de la consommation, le droit de rétractation ne s\'applique pas aux denrées périssables et aux produits confectionnés selon les spécifications du consommateur.',
        'Les pizzas préparées à la demande en sont donc exclues.',
      ],
    },
    {
      id: 'reclamation',
      title: '7. Réclamations',
      paragraphs: [
        `Toute réclamation doit être adressée dans les plus brefs délais à ${L.contactEmail} ou au ${L.phone}, en indiquant le numéro de commande.`,
        'Nous nous efforçons de traiter toute insatisfaction de bonne foi (produit manquant, erreur de préparation, retard).',
      ],
    },
    {
      id: 'donnees',
      title: '8. Données personnelles',
      paragraphs: [
        'Les données collectées sont traitées conformément à notre Politique de confidentialité.',
      ],
    },
    {
      id: 'litiges',
      title: '9. Médiation et litiges',
      paragraphs: [
        `Réclamation ou médiation de la consommation : ${L.contactEmail} ou ${L.phone}.`,
        'Plateforme européenne ODR : https://ec.europa.eu/consumers/odr/',
        'À défaut d\'accord amiable, les tribunaux français restent compétents.',
      ],
    },
    {
      id: 'loi',
      title: '10. Droit applicable',
      paragraphs: ['Les présentes CGV sont soumises au droit français.'],
    },
  ]
}
