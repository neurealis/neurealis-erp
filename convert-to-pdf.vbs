Dim objWord, objDoc
Dim inputPath, outputPath

inputPath = "C:\Users\holge\neurealis GmbH\Wohnungssanierung - Kunden - Kunden\16 VBW - neu\00 LVs\2026 VBW - Neues LV mit 10er Schritten\2026-01-27 VBW - LV 2026 - Entscheidungsgrundlage - neurealis v1.1.docx"
outputPath = "C:\Users\holge\neurealis GmbH\Wohnungssanierung - Kunden - Kunden\16 VBW - neu\00 LVs\2026 VBW - Neues LV mit 10er Schritten\2026-01-27 VBW - LV 2026 - Entscheidungsgrundlage - neurealis v1.1.pdf"

Set objWord = CreateObject("Word.Application")
objWord.Visible = False

Set objDoc = objWord.Documents.Open(inputPath)
objDoc.ExportAsFixedFormat outputPath, 17

objDoc.Close False
objWord.Quit

WScript.Echo "PDF erstellt: " & outputPath
