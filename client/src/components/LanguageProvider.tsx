import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Language = 'ar' | 'en';
type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  ar: {
    'app.name': 'شبكة سوق للإعلانات',
    'nav.home': 'الرئيسية',
    'nav.ads': 'الإعلانات',
    'nav.create': 'إنشاء إعلان',
    'nav.login': 'تسجيل الدخول',
    'nav.logout': 'تسجيل الخروج',
    'hero.title': 'أنشئ إعلانك بسهولة',
    'hero.subtitle': 'أنشئ إعلان صور أو فيديو وابدأ التسويق فوراً',
    'hero.cta': 'ابدأ الآن',
    'ads.title': 'أحدث الإعلانات',
    'ads.no_ads': 'لا توجد إعلانات حالياً',
    'create.title': 'إعلان جديد',
    'create.success': 'تم إنشاء الإعلان بنجاح',
    'create.ai_copy': 'توليد نص ذكي',
    'create.ai_image': 'توليد صورة',
    'create.submit': 'نشر الإعلان',
    'common.loading': 'جاري التحميل...',
    'common.error': 'حدث خطأ ما',
    'common.delete': 'حذف',
    'common.view': 'عرض التفاصيل',
  },
  en: {
    'app.name': 'Souq Ads Network',
    'nav.home': 'Home',
    'nav.ads': 'Advertisements',
    'nav.create': 'Create Ad',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'hero.title': 'Create Your Ad Easily',
    'hero.subtitle': 'Create image or video ads and start marketing instantly',
    'hero.cta': 'Get Started',
    'ads.title': 'Latest Ads',
    'ads.no_ads': 'No ads available right now',
    'create.title': 'New Ad',
    'create.success': 'Ad created successfully',
    'create.ai_copy': 'Generate AI Copy',
    'create.ai_image': 'Generate AI Image',
    'create.submit': 'Publish Ad',
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'common.delete': 'Delete',
    'common.view': 'View Details',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');
  const [direction, setDirection] = useState<Direction>('rtl');

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setDirection(lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  const t = (key: string) => {
    const keys = key.split('.');
    // @ts-ignore
    return translations[language][key] || key;
  };

  useEffect(() => {
    // Set initial direction
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, []);

  return (
    <LanguageContext.Provider value={{ language, direction, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
