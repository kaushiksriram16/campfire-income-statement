/** Format an exact two-decimal API amount without floating-point conversion. */
export function formatMoney(value: string): string {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value)
  if (!match) throw new Error('Expected money with two decimal places')
  const [, sign, digits, cents] = match
  const whole = digits.replace(/^0+(?=\d)/, '')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const result = `${grouped}.${cents}`
  return sign === '-' && (whole !== '0' || cents !== '00') ? `(${result})` : result
}
