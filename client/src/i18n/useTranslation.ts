import { useCallback } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

export function useTranslation(): { t: (key: string) => string; language: string } {
  const { t: i18nT, i18n } = useI18nTranslation();

  const t = useCallback((key: string): string => i18nT(key), [i18nT]);

  return { t, language: i18n.language };
}
