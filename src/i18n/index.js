// Translations. Built in: en, es, bg. A sportsbook picks one with `language` and can override any
// string — or add a whole language — with `translations`:
//
//   SSTChat.init({ language: 'es', translations: { es: { title: 'Asistente' }, pt: { … } } })
//
// A key missing in the chosen language falls back to English. Renderers read t(), the locale
// (dates) and price() (odds in `oddsFormat`: decimal | fractional) from I18nContext; without a
// provider they render in English with decimal odds.
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import en from './en.js';
import es from './es.js';
import bg from './bg.js';
import { priceFormatter } from '../renderers/odds.js';

export const languages = { en, es, bg };

// "es-PE" → es dictionary when there is no es-PE one.
const pick = (dicts, language) => dicts[language] ?? dicts[language?.split('-')[0]] ?? {};

export function createI18n({ language = 'en', locale, translations = {}, oddsFormat = 'decimal' } = {}) {
    const base = pick(languages, language);
    const custom = pick(translations, language);
    const dict = { ...en, ...base, ...custom };
    const t = (key, vars) => {
        const s = dict[key] ?? key;
        return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s;
    };
    return { language, locale: locale ?? language, t, oddsFormat, price: priceFormatter(oddsFormat) };
}

const fallback = createI18n();
export const I18nContext = createContext(fallback);
export const useI18n = () => useContext(I18nContext);
