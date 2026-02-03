$headers = @{
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcHVpanR0ZGdrbGxudmh2amx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNjQ4MTUsImV4cCI6MjA4MzY0MDgxNX0.c3b_nbviligcH8O3k3-HpqKGM2rAjp9zXze_1HL5ydg"
    "Content-Type" = "application/json"
}
$body = '{"query": "subject:Abrechnung", "top": 100}'
$response = Invoke-RestMethod -Uri "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/email-search" -Method POST -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10
