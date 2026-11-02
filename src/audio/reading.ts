export function chooseArabicVoice<T extends {lang:string}>(voices: T[]): T | undefined {
  return voices.find(v=>/^ar[-_]EG$/i.test(v.lang)) ?? voices.find(v=>/^ar(?:[-_]|$)/i.test(v.lang));
}


export function arabicVoiceHelp(userAgent:string):string {
 if(/Android/i.test(userAgent))return 'تعذّر نطق العربية. راجع إعدادات تحويل النص إلى كلام في الموبايل، واختَر العربية وحدّث محرك النطق، ثم جرّب تاني.';
 if(/iPhone|iPad|iPod/i.test(userAgent))return 'تعذّر نطق العربية. راجع إعدادات تسهيلات الاستخدام ثم المحتوى المنطوق والأصوات، وأضف العربية، ثم جرّب تاني.';
 if(/Windows/i.test(userAgent))return 'تعذّر نطق العربية. اقفل المتصفح بالكامل وافتحه بعد تثبيت الصوت العربي. لو استمرت المشكلة راجع إعدادات الكلام في Windows.';
 return 'تعذّر نطق العربية. تأكد من توفر صوت عربي في إعدادات تحويل النص إلى كلام على جهازك، ثم أعد المحاولة.';
}
