import subprocess
import sys

try:
    from docx2pdf import convert
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "docx2pdf", "-q"])
    from docx2pdf import convert

input_path = r"C:\Users\holge\neurealis GmbH\Wohnungssanierung - Kunden - Kunden\16 VBW - neu\00 LVs\2026 VBW - Neues LV mit 10er Schritten\2026-01-27 VBW - LV 2026 - Entscheidungsgrundlage - neurealis v1.1.docx"
output_path = r"C:\Users\holge\neurealis GmbH\Wohnungssanierung - Kunden - Kunden\16 VBW - neu\00 LVs\2026 VBW - Neues LV mit 10er Schritten\2026-01-27 VBW - LV 2026 - Entscheidungsgrundlage - neurealis v1.1.pdf"

convert(input_path, output_path)
print(f"PDF erstellt: {output_path}")
