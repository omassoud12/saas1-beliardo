$report = Get-Content -Raw 'C:\Users\USER\.codex\attachments\e1e10a2e-d42e-46cf-9f03-73e01b6c3a05\pasted-text.txt' | ConvertFrom-Json

$metricIds = @(
  'first-contentful-paint',
  'largest-contentful-paint',
  'speed-index',
  'total-blocking-time',
  'cumulative-layout-shift',
  'interactive'
)

$metrics = foreach ($id in $metricIds) {
  $audit = $report.audits.$id
  [PSCustomObject]@{ id = $id; score = $audit.score; value = $audit.displayValue }
}

$network = $report.audits.'network-requests'.details.items |
  Sort-Object transferSize -Descending |
  Select-Object -First 12 url, resourceType, transferSize

[PSCustomObject]@{
  url = $report.finalDisplayedUrl
  fetchTime = $report.fetchTime
  formFactor = $report.configSettings.formFactor
  throttlingMethod = $report.configSettings.throttlingMethod
  categories = [PSCustomObject]@{
    performance = $report.categories.performance.score
    accessibility = $report.categories.accessibility.score
    bestPractices = $report.categories.'best-practices'.score
    seo = $report.categories.seo.score
  }
  metrics = $metrics
  diagnostics = $report.audits.diagnostics.details.items | Select-Object -First 1
  mainThread = $report.audits.'mainthread-work-breakdown'.details.items
  bootup = $report.audits.'bootup-time'.details.items | Sort-Object total -Descending | Select-Object -First 8
  unusedJavaScript = $report.audits.'unused-javascript'.details.items | Sort-Object wastedBytes -Descending | Select-Object -First 10 url, totalBytes, wastedBytes, wastedPercent
  unminifiedJavaScript = $report.audits.'unminified-javascript'.details.items | Sort-Object wastedBytes -Descending | Select-Object -First 10 url, totalBytes, wastedBytes
  largestNetworkRequests = $network
  lcpBreakdown = $report.audits.'lcp-breakdown-insight'.details
} | ConvertTo-Json -Depth 10
