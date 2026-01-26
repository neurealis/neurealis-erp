$r = Invoke-RestMethod -Uri 'https://tables-api.softr.io/api/v1/databases/e74de047-f727-4f98-aa2a-7bda298672d3/tables/J563LaZ43bZSQy/records/hPmWLchAL82yAS' -Headers @{'Softr-Api-Key'='dWhawF85Rw7tqSsaaqmavvmkE'}
Write-Host "Projekt: $($r.data.fields.QEcc2)"
Write-Host "BV: $($r.data.fields.uaDbm)"
Write-Host "Beschreibung: $($r.data.fields.ozrIj)"
