---
id: 12135
title: "Kostenrechner für Ihre Sanierung oder Renovierung"
slug: kostenrechner-sanierung-renovierung-wohnung-eigenheim
type: page
status: publish
date: 2025-12-15
modified: 2025-12-16
link: https://neurealis.de/kostenrechner-sanierung-renovierung-wohnung-eigenheim/
excerpt: "Kostenrechner Sanierung & Renovierung Wählen Sie pro Gewerk die passenden Maßnahmen, um einen Preis für die Sanierung Ihrer Wohnung oder Ihres Eigenheims zu. Kostenrechner Sanierung &#038; Renovierung Wohnung oder Eigenheim Wählen Sie pro Gewerk die passenden Maßnahmen, um einen Preis für die Sanier"
---

# Kostenrechner für Ihre Sanierung oder Renovierung

## Kostenrechner Sanierung & Renovierung

				

				

				
				
									
Wählen Sie pro Gewerk die passenden Maßnahmen, um einen Preis für die Sanierung Ihrer Wohnung oder Ihres Eigenheims zu.

								

				

				
				
					
  
    :root{
      --nr-bg:#efefef;
      --nr-panel:#ffffff;
      --nr-card:#f2f2f2;
      --nr-border:#d9d9d9;
      --nr-text:#111111;
      --nr-muted:#555555;
      --nr-accent:#d71920;
      --nr-accent-dark:#b81218;
      --nr-shadow:0 8px 24px rgba(0,0,0,.08);
    }

    /* WICHTIG: Font von Website übernehmen */
    #nr-configurator,
    #nr-configurator *{
      font-family: inherit !important;
    }

    #nr-configurator{
      background:var(--nr-bg);
      padding:26px;
      border:1px solid var(--nr-border);
      border-radius:0;
      color:var(--nr-text);
      max-width:1100px;
      margin:0 auto;
    }

    .nr-header{
      background:#dcdcdc;
      padding:16px 18px;
      border:1px solid var(--nr-border);
      border-radius:0;
      margin-bottom:14px;
    }
    .nr-title{
      margin:0;
      font-size:clamp(20px, 2.1vw, 34px);
      font-weight:900;
      letter-spacing:-0.02em;
      line-height:1.15;
    }
    .nr-subtitle{
      margin:8px 0 0 0;
      color:var(--nr-muted);
      font-size:13px;
      line-height:1.5;
      max-width:920px;
    }

    .nr-progress{ display:flex; justify-content:center; gap:10px; padding:16px 0 0; user-select:none; }
    .nr-dot{
      width:12px; height:12px;
      background:#cfcfcf; border:1px solid #c0c0c0;
      opacity:.85; transition:all .15s ease;
      border-radius:0;
    }
    .nr-dot.active{ background:var(--nr-accent); border-color:var(--nr-accent); transform:scale(1.08); }
    .nr-dot.done{ background:#9be2a7; border-color:#59c06a; }

    .nr-step{ display:none; margin-top:14px; }
    .nr-step.active{ display:block; }

    .nr-panel{
      background:var(--nr-panel);
      border:1px solid var(--nr-border);
      border-radius:0;
      padding:18px;
      box-shadow:var(--nr-shadow);
    }

    .nr-h2{ margin:0 0 10px 0; font-size:20px; font-weight:900; letter-spacing:-0.01em; }
    .nr-note{ margin:0 0 14px 0; color:var(--nr-muted); font-size:13px; line-height:1.5; }

    .nr-grid{
      display:grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap:12px;
    }
    @media (max-width: 980px){ .nr-grid{ grid-template-columns: repeat(2, minmax(0,1fr)); } }
    @media (max-width: 520px){ #nr-configurator{ padding:16px; } .nr-grid{ grid-template-columns:1fr; } }

    /* Karte klickbar (ganze Box) */
    .nr-card{
      background:var(--nr-card);
      border:1px solid var(--nr-border);
      border-radius:0;
      padding:14px 12px 14px 44px;
      cursor:pointer;
      min-height:82px;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      font-weight:800;
      transition:all .12s ease;
      position:relative;
      color:#111;
      user-select:none;
    }
    .nr-card:hover{ transform:translateY(-1px); box-shadow:0 8px 18px rgba(0,0,0,.08); }
    .nr-card.selected{
      border-color:var(--nr-accent);
      box-shadow:0 0 0 3px rgba(215,25,32,.16);
      background:#fff;
    }

    .nr-check{
      position:absolute;
      left:12px;
      top:12px;
      width:18px;
      height:18px;
      accent-color: var(--nr-accent);
      cursor:pointer;
    }
    .nr-card label{
      cursor:pointer;
      display:block;
      width:100%;
      pointer-events:none; /* Klick soll auf Karte gehen, nicht Label blockieren */
    }

    .nr-form{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-top:6px;
    }
    @media (max-width: 760px){ .nr-form{ grid-template-columns:1fr; } }

    .nr-field{ display:flex; flex-direction:column; gap:6px; }
    .nr-field label{ font-size:13px; font-weight:800; color:#111; }
    .nr-field input, .nr-field select, .nr-field textarea{
      border:1px solid var(--nr-border);
      border-radius:0;
      padding:12px;
      font-size:14px;
      outline:none;
      background:#fff;
    }
    .nr-field input:focus, .nr-field select:focus, .nr-field textarea:focus{
      border-color:var(--nr-accent);
      box-shadow:0 0 0 3px rgba(215,25,32,.12);
    }
    .nr-field textarea{ min-height:92px; resize:vertical; }

    .nr-actions{
      display:flex;
      justify-content:space-between;
      gap:10px;
      margin-top:16px;
      align-items:center;
    }

    .nr-btn{
      border:none;
      border-radius:0;
      padding:12px 16px;
      font-weight:900;
      cursor:pointer;
      transition:all .12s ease;
      font-size:14px;
      min-width:150px;
    }
    .nr-btn.secondary{ background:#fff; border:1px solid var(--nr-border); color:#111; }
    .nr-btn.secondary:hover{ transform:translateY(-1px); }
    .nr-btn.primary{ background:var(--nr-accent); color:#fff; }
    .nr-btn.primary:hover{ background:var(--nr-accent-dark); transform:translateY(-1px); }
    .nr-btn:disabled{ opacity:.6; cursor:not-allowed; transform:none !important; }

    .nr-error{
      margin-top:10px;
      padding:10px 12px;
      border-radius:0;
      border:1px solid #f3b4b7;
      background:#fff1f2;
      color:#8a0f14;
      display:none;
      font-size:13px;
      line-height:1.4;
    }
    .nr-success{
      margin-top:10px;
      padding:10px 12px;
      border-radius:0;
      border:1px solid #b8e7c0;
      background:#f0fdf4;
      color:#14532d;
      display:none;
      font-size:13px;
      line-height:1.4;
    }

    .nr-checkbox{ display:flex; gap:10px; align-items:flex-start; margin-top:8px; color:var(--nr-muted); font-size:13px; }
    .nr-checkbox input{ margin-top:2px; accent-color: var(--nr-accent); }

    .nr-summary{ margin-top:14px; border-top:1px dashed var(--nr-border); padding-top:14px; }
    .nr-summary pre{
      white-space:pre-wrap; word-break:break-word;
      background:#fff; border:1px solid var(--nr-border);
      border-radius:0; padding:12px; margin:10px 0 0;
      font-size:12px; color:#0f172a;
    }
    .nr-small{ font-size:12px; color:var(--nr-muted); margin-top:4px; line-height:1.4; }

/* === MOBILE FIX: Buttons dürfen nicht überstehen === */
.nr-actions{
  flex-wrap: wrap;              /* darf umbrechen, falls nötig */
}

.nr-btn{
  min-width: 0 !important;      /* entfernt das min-width:150px auf mobilen Geräten */
}

@media (max-width: 520px){
  .nr-actions{
    gap:12px;
  }

  /* Zurück klein (Icon), Weiter nimmt den Rest */
  .nr-btn.secondary{
    flex: 0 0 56px;             /* feste Breite für Icon-Button */
    padding: 12px 0;            /* zentriert */
  }

  .nr-btn.primary{
    flex: 1 1 auto;             /* nimmt restliche Breite */
    width: auto;
  }
}

  

  
    ## Kostenrechner Sanierung & Renovierung Wohnung oder Eigenheim


    
Wählen Sie pro Gewerk die passenden Maßnahmen, um einen Preis für die Sanierung Ihrer Wohnung oder Ihres Eigenheims zu berechnen.


    

  


  
  
    
      Bad

      
Mehrfachauswahl möglich.


      
        Kernsanierung (Dusche / Badewanne)

        Renovierung (Fliese auf Fliese)

        Sanitärobjekte & Armaturen erneuern

        Silikonfugen / Teilreparatur

        Barrierearm (z.B. Walk-in)

        Badlüfter / Abluft

        Neue Fliesen (komplett)

        Waschtischu-Unterschrank & Spiegelschrank

      

      
        Zurück
        Weiter
      

    

  


  
  
    
      Elektrik

      
Mehrfachauswahl möglich.


      
        Komplette Neuinstallation

        Schalter & Steckdosen tauschen

        Unterverteilung / Sicherungskasten

        E-Check / Prüfung

        Smart Home

        Netzwerk / Datendosen

        Beleuchtung / Spots

        E-Rollos / Steuerung

      

      
        Zurück
        Weiter
      

    

  


  
  
    
      Wände & Decken

      
Mehrfachauswahl möglich.


      
        Streichen

        Tapezieren (Raufaser / Maler Vlies)

        Spachteln (Q3/Q4)

        Risse / Schäden ausbessern

        Schimmel- / Feuchtesanierung

        Decke abhängen / Trockenbau

        Akustik  /Schallschutz (innen)

        Innenputz / Glattputz

      

      
        Zurück
        Weiter
      

    

  


  
  
    
      Boden

      
Mehrfachauswahl möglich.


      
        Vinyl

        Parkett

        Laminat

        Fliesen

        Altbelag entfernen

        Untergrund ausgleichen

        Fußleisten erneuern

        Estrich  /Bodenaufbau

      

      
        Zurück
        Weiter
      

    

  


  
  
    
      Tischler / Türen

      
Mehrfachauswahl möglich.


      
        Zimmertüren erneuern

        Zimmertüren lackieren

        Zargen erneuern

        Beschläge/Drücker tauschen

        Wohnungseingangstür austauschen

        Wohnungseingangstür lackieren

        Haustür austauschen

        Haustür lackieren

      

      
        Zurück
        Weiter
      

    

  


  
  
    
      Fenster

      
Mehrfachauswahl möglich. Zusätzlich bitte Anzahl angeben.



      
        Erneuern (mit Rollos)

        Erneuern (ohne Rollos)

        Lackieren / Aufbereitung

        Dichtungen/Beschläge

        Rollläden erneuern

        Insektenschutz

        Fensterbänke innen / außen

        Sonnenschutz (Raffstore / Markise)

      


      
        
          Anzahl Fenster
          
        

        
          Anzahl Rollos
          
          Wenn keine vorhanden/geplant: 0

        

      


      


      
        Zurück
        Weiter
      

    

  


  
  
    
      Außendämmung / Gebäudehülle

      
Mehrfachauswahl möglich.


      
        Fassade (WDVS)

        Kellerdecke dämmen

        Dach / Zwischensparren

        Geschossdecke / Dachboden

        Sockeldämmung

        Fensteranschlüsse / Leibungen

        Putz/Fassadenanstrich

        Wärmebrücken / Detailpunkte

      

      
        Zurück
        Weiter
      

    

  


  
  
    
      Flächen

      
Damit wir sauber einschätzen können.



      
        
          Wohnfläche (m²)
          
        

        
          Anzahl Bäder
          
        

        
          Gesamtfläche aller Bäder (m²) (optional)
          
        

      


      


      
        Zurück
        Weiter
      

    

  


  
  
    
      Zeitplan & Budget


      
        
          Wann ist die Ausführung geplant?
          
            Bitte wählen
            sofort / kurzfristig (0–4 Wochen)
            in 1–3 Monaten
            in 3–6 Monaten
            in 6–12 Monaten
            später / noch offen
          
        


        
          Budget (Richtwert)
          
            Bitte wählen
            < 25.000 €
            25.000 – 50.000 €
            50.000 – 100.000 €
            100.000 – 200.000 €
            > 200.000 €
            noch unklar
          
        


        
          Optional: Hinweise
          
        

      


      


      
        Zurück
        Weiter
      

    

  


  
  
    
      Kontaktdaten


      
        
          Vorname
          
        

        
          Nachname
          
        

        
          E-Mail
          
        

        
          Telefon
          
        

        
          Ich bin
          
            Bitte wählen
            Eigentümer:in
            Investor:in
            Wohnungsverwaltung / Genossenschaft
            Unternehmen
            Architekt:in / Planer:in
            Sonstiges
          
        

        
          Firma (optional)
          
        


        
        
          Adresse des Bauvorhabens

          
Wo sollen die Maßnahmen umgesetzt werden?


        

        
          Straße & Hausnummer
          
        

        
          PLZ
          
        

        
          Ort
          
        

        
          Adresszusatz (optional)
          
        

        

        
          
            
            
              Ich bin mit der Verarbeitung meiner Daten zum Zweck der Kontaktaufnahme einverstanden.
              Bitte verlinke unter dem Widget deine Datenschutzerklärung.

            
          

        

      


      
        **Vorschau (JSON Webhook):**
        
{}
      


      

      


      
        Zurück
        Anfrage absenden
      

    

  


  
    (function(){
      // =========================
      // CONFIG
      // =========================
      const WEBHOOK_URL = "https://hook.eu2.make.com/szgllibbx2c90do1y5r1e4i3uvsvale2"; //  r.querySelector(sel);
      const $$ = (sel, r=root) => Array.from(r.querySelectorAll(sel));
      const steps = $$(".nr-step");
      const progress = $("#nrProgress");
      let currentStep = 0;

      function safeJson(obj){ try { return JSON.stringify(obj, null, 2); } catch(e){ return "{}"; } }
      function saveState(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} }
      function loadState(){
        try{
          const raw = localStorage.getItem(STORAGE_KEY);
          if(!raw) return;
          const parsed = JSON.parse(raw);
          if(parsed && typeof parsed === "object") Object.assign(state, parsed);
        }catch(e){}
      }

      function renderProgress(){
        progress.innerHTML = "";
        for(let i=0;i s.classList.toggle("active", idx === currentStep));
        renderProgress();
        renderPreview();
        saveState();
      }

      function setError(stepIdx, msg){
        const el = $("#nrError"+stepIdx);
        if(!el) return;
        el.textContent = msg || "";
        el.style.display = msg ? "block" : "none";
      }
      function setSuccess(msg){
        const el = $("#nrSuccess");
        if(!el) return;
        el.textContent = msg || "";
        el.style.display = msg ? "block" : "none";
      }

      function buildPayload(){
        return { ...state, meta: { ...state.meta, createdAt: state.meta.createdAt || new Date().toISOString() } };
      }
      function renderPreview(){
        const pre = $("#nrPreview");
        if(pre) pre.textContent = safeJson(buildPayload());
      }

      function setCardSelected(card, selected){
        const cb = card.querySelector(".nr-check");
        card.classList.toggle("selected", !!selected);
        if(cb) cb.checked = !!selected;
      }

      function syncGridToState(grid){
        const key = grid.getAttribute("data-key");
        const selected = $$(".nr-card", grid)
          .filter(card => card.classList.contains("selected"))
          .map(card => card.getAttribute("data-value"));
        state[key] = selected;
        saveState();
        renderPreview();
      }

      function hydrateSelections(){
        $$("[data-key]").forEach(grid => {
          const key = grid.getAttribute("data-key");
          const arr = Array.isArray(state[key]) ? state[key] : [];
          $$(".nr-card", grid).forEach(card => setCardSelected(card, arr.includes(card.getAttribute("data-value"))));
        });

        const fa = $("#nrFensterAnzahl"); if(fa) fa.value = state.fenster_details.anzahl_fenster ?? "";
        const ra = $("#nrRolloAnzahl");  if(ra) ra.value = state.fenster_details.anzahl_rollos ?? "";

        $("#nrWohnflaeche").value = state.flaechen.wohnflaeche_m2 ?? "";
        $("#nrBadAnzahl").value = state.flaechen.bad_anzahl ?? "";
        $("#nrBadFlaeche").value = state.flaechen.bad_flaeche_m2 ?? "";

        $("#nrStart").value = state.planung.ausfuehrung || "";
        $("#nrBudget").value = state.planung.budget || "";
        $("#nrKommentar").value = state.planung.kommentar || "";

        $("#nrVorname").value = state.lead.vorname || "";
        $("#nrNachname").value = state.lead.nachname || "";
        $("#nrEmail").value = state.lead.email || "";
        $("#nrTelefon").value = state.lead.telefon || "";
        $("#nrRolle").value = state.lead.rolle || "";
        $("#nrFirma").value = state.lead.firma || "";
        $("#nrConsent").checked = !!state.lead.consent;

        /* NEU: Adresse hydrate */
        $("#nrObjStrasse").value = state.objektadresse?.strasse ?? "";
        $("#nrObjPLZ").value = state.objektadresse?.plz ?? "";
        $("#nrObjOrt").value = state.objektadresse?.ort ?? "";
        $("#nrObjZusatz").value = state.objektadresse?.zusatz ?? "";
      }

      // =========================
      // CARD CLICK (ganze Box toggelt)
      // =========================
      $$("[data-key]").forEach(grid => {
        grid.addEventListener("click", (e) => {
          const card = e.target.closest(".nr-card");
          if(!card) return;

          const clickedCheckbox = e.target.classList.contains("nr-check");
          const cb = card.querySelector(".nr-check");

          if(clickedCheckbox){
            setCardSelected(card, cb.checked);
          }else{
            const next = !card.classList.contains("selected");
            setCardSelected(card, next);
          }

          syncGridToState(grid);
        });

        $$(".nr-check", grid).forEach(cb => {
          cb.addEventListener("change", (e) => {
            const card = e.target.closest(".nr-card");
            if(!card) return;
            setCardSelected(card, e.target.checked);
            syncGridToState(grid);
          });
        });
      });

      // =========================
      // INPUTS -> STATE
      // =========================
      $("#nrFensterAnzahl").addEventListener("input", () => {
        const v = $("#nrFensterAnzahl").value;
        state.fenster_details.anzahl_fenster = v !== "" ? Number(v) : null;
        saveState(); renderPreview();
      });
      $("#nrRolloAnzahl").addEventListener("input", () => {
        const v = $("#nrRolloAnzahl").value;
        state.fenster_details.anzahl_rollos = v !== "" ? Number(v) : null;
        saveState(); renderPreview();
      });

      $("#nrWohnflaeche").addEventListener("input", () => { state.flaechen.wohnflaeche_m2 = $("#nrWohnflaeche").value ? Number($("#nrWohnflaeche").value) : null; saveState(); renderPreview(); });
      $("#nrBadAnzahl").addEventListener("input", () => { state.flaechen.bad_anzahl = $("#nrBadAnzahl").value ? Number($("#nrBadAnzahl").value) : null; saveState(); renderPreview(); });
      $("#nrBadFlaeche").addEventListener("input", () => { state.flaechen.bad_flaeche_m2 = $("#nrBadFlaeche").value ? Number($("#nrBadFlaeche").value) : null; saveState(); renderPreview(); });

      $("#nrStart").addEventListener("change", () => { state.planung.ausfuehrung = $("#nrStart").value; saveState(); renderPreview(); });
      $("#nrBudget").addEventListener("change", () => { state.planung.budget = $("#nrBudget").value; saveState(); renderPreview(); });
      $("#nrKommentar").addEventListener("input", () => { state.planung.kommentar = $("#nrKommentar").value; saveState(); renderPreview(); });

      $("#nrVorname").addEventListener("input", () => { state.lead.vorname = $("#nrVorname").value; saveState(); renderPreview(); });
      $("#nrNachname").addEventListener("input", () => { state.lead.nachname = $("#nrNachname").value; saveState(); renderPreview(); });
      $("#nrEmail").addEventListener("input", () => { state.lead.email = $("#nrEmail").value; saveState(); renderPreview(); });
      $("#nrTelefon").addEventListener("input", () => { state.lead.telefon = $("#nrTelefon").value; saveState(); renderPreview(); });
      $("#nrRolle").addEventListener("change", () => { state.lead.rolle = $("#nrRolle").value; saveState(); renderPreview(); });
      $("#nrFirma").addEventListener("input", () => { state.lead.firma = $("#nrFirma").value; saveState(); renderPreview(); });
      $("#nrConsent").addEventListener("change", () => { state.lead.consent = $("#nrConsent").checked; saveState(); renderPreview(); });

      /* NEU: Adresse Listener */
      $("#nrObjStrasse").addEventListener("input", () => { state.objektadresse.strasse = $("#nrObjStrasse").value; saveState(); renderPreview(); });
      $("#nrObjPLZ").addEventListener("input", () => { state.objektadresse.plz = $("#nrObjPLZ").value; saveState(); renderPreview(); });
      $("#nrObjOrt").addEventListener("input", () => { state.objektadresse.ort = $("#nrObjOrt").value; saveState(); renderPreview(); });
      $("#nrObjZusatz").addEventListener("input", () => { state.objektadresse.zusatz = $("#nrObjZusatz").value; saveState(); renderPreview(); });

      // =========================
      // NAV
      // =========================
      $$("[data-next]").forEach(btn => btn.addEventListener("click", () => {
        if(currentStep === 5){
          setError(5,"");
          const f = state.fenster_details.anzahl_fenster;
          const r = state.fenster_details.anzahl_rollos;
          if(f !== null && f  f){ setError(5,"Anzahl Rollos kann nicht größer als Anzahl Fenster sein."); return; }
        }

        if(currentStep === 7){
          setError(7,"");
          const w = Number($("#nrWohnflaeche").value);
          const b = Number($("#nrBadAnzahl").value);
          if(!w || w  btn.addEventListener("click", () => setStep(currentStep - 1)));

      // =========================
      // SUBMIT
      // =========================
      function isEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||"").trim()); }

      $("#nrSubmitBtn").addEventListener("click", async (e) => {
        e.preventDefault();
        setError(9,""); setSuccess("");

        const v = String(state.lead.vorname||"").trim();
        const n = String(state.lead.nachname||"").trim();
        const em = String(state.lead.email||"").trim();
        const tel = String(state.lead.telefon||"").trim();

        if(!v || !n){ setError(9,"Bitte gib Vor- und Nachnamen an."); return; }
        if(!isEmail(em)){ setError(9,"Bitte gib eine gültige E-Mail an."); return; }
        if(tel.length  "");
            throw new Error("Webhook-Fehler ("+res.status+"): " + (txt || res.statusText));
          }

          try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}

          window.location.href = THANK_YOU_URL;

        }catch(err){
          setError(9, "Senden fehlgeschlagen: " + (err && err.message ? err.message : "Unbekannter Fehler"));
          btn.disabled = false;
          btn.textContent = "Anfrage absenden";
        }
      });

      // =========================
      // INIT
      // =========================
      loadState();
      hydrateSelections();
      renderProgress();
      renderPreview();
      setStep(0);
    })();