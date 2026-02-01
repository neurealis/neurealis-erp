---
id: 12061
title: "Sackrechner"
slug: sackrechner
type: page
status: publish
date: 2025-11-18
modified: 2025-11-18
link: https://neurealis.de/sackrechner/
excerpt: "Sackrechner Ausgleichsmasse Sackrechner Ausgleichsmasse 1 Fläche m² 2 Schichtdicke mm 3 Verbrauch kg/m²/mm 4 Gebindegröße kg Säcke gesamt: 0"
---

# Sackrechner

Sackrechner Ausgleichsmasse

  body {
    font-family: Arial, sans-serif;
    background: #f4f4f4;
    padding: 30px;
  }

  .rechner {
    max-width: 420px;
    background: #dcdcdc;
    box-shadow: 0 0 10px rgba(0,0,0,0.2);
  }

  .rechner-header {
    background: #555;
    color: #fff;
    padding: 12px 18px;
    font-size: 20px;
  }

  .content { padding: 18px; }

  .row {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
  }

  .num-circle {
    width: 24px;
    height: 24px;
    background: #e30613;
    color: white;
    border-radius: 50%;
    text-align: center;
    line-height: 24px;
    font-weight: bold;
    flex-shrink: 0;
  }

  .label {
    flex: 2;
    margin-left: 12px;
    font-weight: bold;
  }

  .input-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .unit {
    font-size: 14px;
    color: #000;
    white-space: nowrap;
  }

  .input-wrap input {
    width: 80px;
    padding: 6px;
    border: 1px solid #ccc;
    border-radius: 0;
    text-align: right;
  }

  .result-line {
    border-top: 1px solid #888;
    margin-top: 12px;
    padding-top: 12px;
    font-size: 16px;
    font-weight: bold;
    text-align: right;
  }

  .result-value {
    font-size: 24px;
    font-weight: bold;
  }

  Sackrechner Ausgleichsmasse

  

    
      1
      Fläche
      
        m²
        
      

    

    
      2
      Schichtdicke
      
        mm
        
      

    

    
      3
      Verbrauch
      
        kg/m²/mm
        
      

    

    
      4
      Gebindegröße
      
        kg
        
      

    

    
      Säcke gesamt: 0
    

  

  function berechnen() {
    const flaeche = parseInt(document.getElementById('flaeche').value) || 0;
    const dicke = parseFloat(document.getElementById('dicke').value) || 0;
    const verbrauch = parseFloat(document.getElementById('verbrauch').value) || 0;
    const gebinde = parseInt(document.getElementById('gebinde').value) || 0;

    const gesamtKg = flaeche * dicke * verbrauch;
    const saecke = gebinde > 0 ? Math.ceil(gesamtKg / gebinde) : 0;

    document.getElementById('saecke').textContent = saecke;
  }

  document.querySelectorAll("input").forEach(el => {
    el.addEventListener("input", berechnen);
  });

  berechnen();