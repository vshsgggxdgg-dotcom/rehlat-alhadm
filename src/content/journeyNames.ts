const stations = ['بوابة الاكتشاف', 'مغامرة لقمة', 'مختبر العصارات', 'كنوز الغذاء', 'عالم الخملات', 'بطل الرحلة'];
const medals = ['وسام المستكشف الصغير', 'وسام دليل المسار', 'وسام عالم الهضم', 'وسام صائد الغذاء', 'وسام خبير الامتصاص', 'وسام بطل رحلة الهضم'];
export const stationName = (order: number) => stations[order - 1] ?? 'رحلة الاكتشاف';
export const medalName = (order: number) => medals[order - 1] ?? 'وسام الإنجاز';
