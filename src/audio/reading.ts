export function chooseArabicVoice<T extends {lang:string}>(voices: T[]): T | undefined {
  return voices.find(v=>/^ar[-_]EG$/i.test(v.lang)) ?? voices.find(v=>/^ar(?:[-_]|$)/i.test(v.lang));
}

