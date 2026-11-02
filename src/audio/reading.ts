/** Only transforms text already disclosed to the learner; never loads answer keys. */
export function egyptianReading(text: string): string {
  return text.replace(/عملية الهضم هي تحويل/g,'الهضم ببساطة بيحوّل')
    .replace(/غير القابلة للذوبان/g,'اللي مش بتدوب')
    .replace(/قابلة للذوبان والامتصاص/g,'تقدر تدوب والجسم يمتصها')
    .replace(/ليستفيد منها الجسم/g,'عشان الجسم يستفيد بيها')
    .replace(/عندما/g,'لما').replace(/لذلك/g,'عشان كده')
    .replace(/يتم /g,'بيتم ').replace(/تتم /g,'بتتم ')
    .replace(/يبدأ /g,'بيبدأ ').replace(/تبدأ /g,'بتبدأ ')
    .replace(/ينتقل /g,'بينتقل ').replace(/تنتقل /g,'بتنتقل ')
    .replace(/يقوم /g,'بيقوم ').replace(/تقوم /g,'بتقوم ')
    .replace(/ما المقصود علمياً بعملية الهضم داخل جسم الإنسان؟/g,'يعني إيه عملية الهضم جوه جسم الإنسان؟')
    .replace(/ما المقصود بـ?/g,'يعني إيه ').replace(/أيّ? مما يلي/g,'أنهي اختيار من دول')
    .replace(/لماذا/g,'ليه').replace(/كيف/g,'إزاي').replace(/أين/g,'فين')
    .replace(/ما وظيفة/g,'إيه وظيفة').replace(/ما دور/g,'إيه دور')
    .replace(/الذي|التي|الذين/g,'اللي').replace(/هذا/g,'ده').replace(/هذه/g,'دي')
    .replace(/داخل جسم الإنسان/g,'جوه جسم الإنسان').replace(/داخل الجسم/g,'جوه الجسم')
    .replace(/يساعد على/g,'بيساعد على').replace(/تساعد على/g,'بتساعد على')
    .replace(/يساعد في/g,'بيساعد في').replace(/تساعد في/g,'بتساعد في')
    .replace(/يُحوِّل|يحوّل/g,'بيحوّل').replace(/تُحوِّل|تحوّل/g,'بتحوّل')
    .replace(/يمكنك/g,'تقدر').replace(/انقر/g,'اضغط').replace(/اختر/g,'اختار')
    .replace(/؛/g,'،').replace(/\s+/g,' ').trim();
}
export function chooseArabicVoice<T extends {lang:string}>(voices: T[]): T | undefined {
  return voices.find(v=>/^ar[-_]EG$/i.test(v.lang)) ?? voices.find(v=>/^ar(?:[-_]|$)/i.test(v.lang));
}
