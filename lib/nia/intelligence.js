const THRESHOLDS = {
  treatmentAcceptance: { green: 75, yellow: 60 },
  treatmentProgression: { green: 80, yellow: 60 },
  overduePlans: { green: 15, yellow: 25, inverse: true },
  followUpContact: { green: 90, yellow: 75 },
  followUpConversion: { green: 50, yellow: 30 },
  reminderCompletion: { green: 90, yellow: 75 },
  noShowRate: { green: 10, yellow: 15, inverse: true },
  cancellationRate: { green: 10, yellow: 15, inverse: true },
  recallBooking: { green: 80, yellow: 65 },
  recallCompletion: { green: 75, yellow: 60 },
  overdueRecall: { green: 15, yellow: 25, inverse: true },
  satisfaction: { green: 90, yellow: 80 },
  complaintResolution: { green: 90, yellow: 75 },
  incidentClosure: { green: 90, yellow: 75 },
}

export function classify(value, key, { hasData = true } = {}) {
  if (!hasData || value === null || value === undefined || Number.isNaN(Number(value))) return 'unknown'
  const threshold = THRESHOLDS[key]
  if (!threshold) return 'unknown'
  const amount = Number(value)
  if (threshold.inverse) return amount < threshold.green ? 'success' : amount <= threshold.yellow ? 'warning' : 'danger'
  return amount >= threshold.green ? 'success' : amount >= threshold.yellow ? 'warning' : 'danger'
}

export function trend(current, previous, { higherIsBetter = true } = {}) {
  if (current === null || current === undefined || previous === null || previous === undefined) return { state: 'unknown', change: null, label: 'No comparison available' }
  const change = Number(current) - Number(previous)
  if (Math.abs(change) < 0.01) return { state: 'stable', change: 0, label: 'Stable vs prior period' }
  const improving = higherIsBetter ? change > 0 : change < 0
  return { state: improving ? 'improving' : 'declining', change, label: `${improving ? 'Improving' : 'Declining'} ${Math.abs(Math.round(change))} points vs prior period` }
}

export function metric(value, key, previous, options = {}) {
  const status = classify(value, key, options)
  const comparison = trend(value, previous, options)
  return { value, status, trend: comparison, hasData: options.hasData !== false && value !== null && value !== undefined }
}

export function health(signals = []) {
  const safety = signals.find(signal => signal.key === 'safety')
  if (safety?.critical) return { status: 'danger', score: 0, reasons: [safety.reason] }
  const available = signals.filter(signal => signal.status && signal.status !== 'unknown')
  if (!available.length) return { status: 'unknown', score: null, reasons: ['Not enough validated data for this period.'] }
  const weights = { safety: 30, treatment: 20, followup: 20, recall: 15, experience: 15 }
  const score = Math.round(available.reduce((total, signal) => total + (signal.status === 'success' ? weights[signal.key] : signal.status === 'warning' ? weights[signal.key] * 0.65 : 0), 0) / available.reduce((total, signal) => total + weights[signal.key], 0) * 100)
  const reasons = available.filter(signal => signal.status !== 'success').map(signal => signal.reason).filter(Boolean)
  return { status: score >= 80 ? 'success' : score >= 55 ? 'warning' : 'danger', score, reasons }
}

export function actionFor(key, status, trendState) {
  const actions = {
    treatment: status === 'danger' ? 'Start recovery review' : trendState === 'declining' ? 'Review treatment trend' : 'Review treatment',
    followup: status === 'danger' ? 'Investigate conversion' : 'Review appointment management',
    recall: status === 'danger' ? 'Start recall recovery' : trendState === 'declining' ? 'Monitor recall trend' : 'Review recalls',
    experience: status === 'danger' ? 'Start experience review' : 'Review feedback',
    safety: status === 'danger' ? 'Review incident now' : 'View incidents',
  }
  return actions[key] || 'View details'
}

export { THRESHOLDS }
