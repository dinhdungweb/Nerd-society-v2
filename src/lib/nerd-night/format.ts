export function formatNerdNightDate(value: Date | string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

export function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

export function buildNerdNightQrUrl(input: {
  bankCode: string
  accountNumber: string
  accountName: string
  amount: number
  content: string
}) {
  const query = new URLSearchParams({
    amount: String(input.amount),
    addInfo: input.content,
    accountName: input.accountName,
  })

  return `https://img.vietqr.io/image/${encodeURIComponent(input.bankCode)}-${encodeURIComponent(input.accountNumber)}-compact2.png?${query.toString()}`
}
