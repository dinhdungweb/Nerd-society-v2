export const NERD_NIGHT_SEASON_ORDER = [
  'THEORY',
  'PATTERN',
  'ANOMALY',
  'PARADOX',
  'ORIGIN',
  'RITUAL',
] as const

export type NerdNightThemeCode = (typeof NERD_NIGHT_SEASON_ORDER)[number]

export const NERD_NIGHT_DEFAULT_TOPIC_PROMPT =
  'Nghe hơi trừu tượng? Vài chủ đề đời thường có thể kể theo hướng này:'

export const NERD_NIGHT_DEFAULT_THEORY_EXAMPLES = [
  'Vì sao bài hát cũ luôn “đúng lúc” bật lên khi mình buồn',
  'Lý thuyết riêng về việc tại sao nhóm bạn nào cũng có một người hay trễ giờ',
  'Vì sao đồ ăn tự nấu ngon hơn hẳn dù công thức y hệt ngoài hàng',
  'Một khung giải thích cho thói quen mua sách về rồi không đọc',
  'Vì sao tin nhắn “đã xem” gây áp lực hơn cả cuộc gọi nhỡ',
  'Lý thuyết cá nhân về việc review 1 sao luôn đáng tin hơn 5 sao',
] as const

export const NERD_NIGHT_THEMES: Record<
  NerdNightThemeCode,
  { description: string; suggestions: string[]; color: 'clay' | 'moss' | 'gold' }
> = {
  THEORY: {
    color: 'clay',
    description:
      'Một lý thuyết, mô hình hay khung tư duy trong khoa học, tâm lý, kinh tế, nghệ thuật hoặc bất kỳ lĩnh vực nào mà bạn thấy giải thích được một phần thế giới hoặc chính mình.',
    suggestions: [
      'Game Theory',
      'Broken Windows Theory',
      'Iceberg Theory',
      'Attachment Theory',
      'Chaos Theory',
      'Big Man Theory',
    ],
  },
  PATTERN: {
    color: 'moss',
    description:
      'Một quy luật lặp lại mà bạn nhận ra trong dữ liệu, hành vi con người, tự nhiên, lịch sử hoặc chính thói quen của bạn.',
    suggestions: [
      'Fractal',
      'Pareto Principle',
      "Hero's Journey",
      'Regression to the Mean',
      'Confirmation Bias',
      'Chu kỳ Kondratiev',
    ],
  },
  ANOMALY: {
    color: 'gold',
    description:
      'Một hiện tượng, sự kiện hay trường hợp đi ngược số đông — thứ không khớp quy luật thông thường nhưng chính vì vậy lại thú vị.',
    suggestions: [
      'Black Swan',
      'Mandela Effect',
      'Uncanny Valley',
      'Placebo Effect',
      'Market Anomalies',
      'Tương quan thiên tài — điên loạn',
    ],
  },
  PARADOX: {
    color: 'clay',
    description:
      'Hai điều cùng đúng nhưng mâu thuẫn nhau — một nghịch lý khiến bạn phải dừng lại suy nghĩ.',
    suggestions: [
      'Con tàu Theseus',
      'Paradox of Choice',
      'Nghịch lý Icarus',
      'Easterlin Paradox',
      "Simpson's Paradox",
      "Prisoner's Dilemma",
    ],
  },
  ORIGIN: {
    color: 'moss',
    description:
      'Nguồn gốc của một khái niệm, trào lưu, từ ngữ, phát minh hoặc thói quen văn hoá.',
    suggestions: [
      'Sapir–Whorf Hypothesis',
      'Nguồn gốc số 0',
      'Thuần hoá động vật',
      'Nguồn gốc tiền tệ',
      'Etymology',
      'Nguồn gốc một trào lưu văn hoá',
    ],
  },
  RITUAL: {
    color: 'gold',
    description:
      'Một nghi thức hoặc thói quen lặp lại có chủ đích của cá nhân, cộng đồng hay văn hoá, cùng ý nghĩa đằng sau việc lặp lại đó.',
    suggestions: [
      'Rites of Passage',
      'Ritual Psychology',
      'Circadian Rhythm',
      'Trà đạo',
      'Kaizen',
      'Performance Ritual trong thể thao',
    ],
  },
}

export const NERD_NIGHT_INTERESTS = [
  'Khoa học tự nhiên',
  'Công nghệ',
  'Kinh doanh',
  'Tâm lý — Con người',
  'Nghệ thuật — Sáng tạo',
  'Lịch sử — Văn hoá',
  'Triết học — Tư duy',
] as const

export const NERD_NIGHT_PAYMENT_HOLD_MINUTES = 30

export function isNerdNightThemeCode(value: string): value is NerdNightThemeCode {
  return NERD_NIGHT_SEASON_ORDER.includes(value as NerdNightThemeCode)
}

export function getNerdNightTheme(value: string) {
  return isNerdNightThemeCode(value)
    ? NERD_NIGHT_THEMES[value]
    : NERD_NIGHT_THEMES.THEORY
}

export function formatNerdNightEpisode(season: number, episode: number) {
  return `S${season}E${String(episode).padStart(2, '0')}`
}
