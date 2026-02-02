# Meta Pixel im Google Tag Manager einrichten

**Datum:** 2026-02-02
**Website:** neurealis.de
**GTM Container:** GTM-MPNTT5L6
**Meta Pixel ID:** 1305800130475673
**Cookie Consent:** Real Cookie Banner Pro (installiert)

---

## Übersicht

Diese Anleitung führt Sie Schritt-für-Schritt durch die Einrichtung des Meta Pixels (Facebook Pixel) im Google Tag Manager. Das Meta Pixel ermöglicht es, Nutzer-Interaktionen auf neurealis.de zu tracken und für Meta Ads-Kampagnen zu nutzen.

**Voraussetzungen:**
- Google Tag Manager Container ist eingebunden (GTM-MPNTT5L6)
- Meta Business Account vorhanden mit Admin-Zugriff
- Real Cookie Banner Pro ist installiert (Cookie-Banner)
- Admin-Zugriff auf neurealis.de

---

## 1. Meta Pixel Credentials vorbereiten

### 1.1 Meta Pixel ID beschaffen

1. Öffne [Meta Business Suite](https://business.facebook.com)
2. Navigiere zu **Events Manager** (linke Seitenleiste)
3. Wähle die Pixel aus oder erstelle eine neue mit der ID: `1305800130475673`
4. Kopiere die **Pixel ID** (8-stellig oder länger)
5. Kopiere auch den **Conversion Tracking API Token** (wird später für Server-Events nötig)

**Notiz:** Speichere diese Credentials sicher. Du brauchst sie nur für diese Anleitung.

---

## 2. Google Tag Manager vorbereiten

### 2.1 GTM Container öffnen

1. Gehe zu [Google Tag Manager](https://tagmanager.google.com)
2. Wähle Container: **GTM-MPNTT5L6**
3. Klicke auf **Tags** in der linken Seitenleiste
4. Du solltest bereits andere Tags sehen (GA4, Google Ads, etc.)

---

## 3. Meta Pixel Base Code Tag erstellen

Der Base Code ist die Grundlage für das Pixel-Tracking. Er lädt die Meta Pixel Bibliothek.

### 3.1 Neuen Tag erstellen

1. Klicke auf **Neuen Tag erstellen** (oder + Icon)
2. Klicke auf **Tag-Konfiguration**
3. Wähle **Custom HTML** aus der Liste

### 3.2 Meta Pixel Base Code einfügen

Gib folgenden Code ein:

```html
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1305800130475673');
fbq('track', 'PageView');
</script>
<noscript>
<img height="1" width="1" style="display:none"
     src="https://www.facebook.com/tr?id=1305800130475673&ev=PageView&noscript=1" />
</noscript>
```

### 3.3 Tag benennen und Trigger konfigurieren

1. **Tag-Name:** `Meta Pixel - Base Code`
2. Klicke auf **Trigger** (unten rechts)
3. Wähle oder erstelle Trigger: **All Pages** oder **Page View**
   - Typ: **Page View**
   - Dies sollte diesen Trigger **alle Seiten** laden (Standard)

### 3.4 Speichern

1. Klicke **Speichern** (oben rechts)
2. Tag sollte jetzt in der Tag-Liste mit Status **Ausstehend** angezeigt werden

**Screenshot-Hinweis:** Der Base Code sollte im Custom HTML Block ähnlich aussehen wie oben.

---

## 4. PageView Event Tag erstellen

Das PageView Event wird automatisch geladen, ist aber in unserem Base Code bereits enthalten. Wir erstellen einen separaten Tag für bessere Kontrolle.

### 4.1 Neuen Tag erstellen

1. Klicke auf **Neuen Tag erstellen**
2. **Tag-Konfiguration** → **Meta Pixel - Track Event**

### 4.2 Meta Pixel Event-Tracking Code

```html
<script>
fbq('track', 'PageView');
</script>
```

### 4.3 Konfiguration

**Tag-Name:** `Meta Pixel - PageView Event`

**Trigger:**
- Typ: **Page View**
- Dies sollte **alle Seiten** tracken

**Wichtig:** Setze diesen Tag als **Abhängigkeit** zum Base Code
- Im Abschnitt **Erweiterte Einstellungen** → **Sequenzfolge**
- Setze diesen Tag so ein, dass er NUR lädt wenn **Meta Pixel - Base Code** erfolgreich war

---

## 5. Lead Event Tag für Formulare einrichten

Lead Events werden ausgelöst, wenn Nutzer Formulare ausfüllen (z.B. Kontaktformular, Angebotsanfrage).

### 5.1 Trigger für Formulare erstellen

1. Gehe zu **Trigger** (linke Seitenleiste)
2. Klicke auf **Neuen Trigger erstellen**
3. **Trigger-Konfiguration** → **Form Submission** (Formular-Absendung)

**Trigger-Einstellungen:**

| Setting | Wert |
|---------|------|
| Trigger-Typ | Form Submission |
| Wartet auf Tags | Ja (optional, für langsame Events) |
| Form ID/Attribut | Wähle alle oder spezifische Formulare |

**Form-Selektor (CSS):**
```
form  /* alle Formulare */
/* oder spezifisch: */
#contact-form
#quote-form
#newsletter-form
```

**Trigger-Name:** `Form - Alle Formulare absenden`

4. Speichern

### 5.2 Lead Event Tag erstellen

1. Klicke auf **Neuen Tag erstellen**
2. **Tag-Konfiguration** → **Custom HTML**

**Code:**

```html
<script>
fbq('track', 'Lead', {
  value: '0.00',
  currency: 'EUR'
});
</script>
```

### 5.3 Tag konfigurieren

| Setting | Wert |
|---------|------|
| **Tag-Name** | `Meta Pixel - Lead Event` |
| **Trigger** | `Form - Alle Formulare absenden` |
| **Abhängigkeit** | `Meta Pixel - Base Code` |

---

## 6. Cookie-Consent Integration (Real Cookie Banner Pro)

Da Real Cookie Banner Pro installiert ist, müssen wir das Meta Pixel an die Cookie-Zustimmung koppeln.

### 6.1 Consent Mode konfigurieren

1. Gehe in GTM zu **Admin** → **Container-Einstellungen**
2. Suche nach **Cookie Consent** oder **Consent Settings**
3. Aktiviere **Zusätzliche Zustimmungskonfiguration**

### 6.2 Consent Trigger erstellen

1. Gehe zu **Trigger**
2. Klicke auf **Neuen Trigger erstellen**
3. **Trigger-Typ:** **Custom Event**

**Einstellungen:**

| Setting | Wert |
|---------|------|
| **Event-Name** | `cookiebot_consent_changed` oder `cookie_consent` |
| **Fire-Bedingung** | `Event` equals `cookiebot_consent_changed` |

**Hinweis:** Der exakte Event-Name hängt von Real Cookie Banner Pro ab. Häufige Werte sind:
- `cookiebot_consent_changed`
- `cookie_update`
- `gtm.update` (GTM Consent Mode)

**Um den korrekten Event-Namen zu finden:**
1. Öffne die Seite in Chrome
2. Öffne **DevTools** (F12)
3. **Konsole** Tab
4. Verändere deine Cookie-Einstellungen
5. Achte auf Events im Tag Manager / in der Konsole

**Trigger-Name:** `Consent - Marketing aktualisiert`

### 6.3 Consent-Bedingung zum Meta Pixel Tag hinzufügen

Damit das Meta Pixel nur lädt wenn Cookie-Zustimmung gegeben ist:

1. Öffne den `Meta Pixel - Base Code` Tag
2. Gehe zu **Erweiterte Einstellungen**
3. **Zustimmungsüberprüfung:**
   - Aktiviere: `Zustimmungsüberprüfung vor dem Senden`
   - Wähle: **Marketing** (oder die entsprechende Kategorie in Real Cookie Banner Pro)

**Code-Snippet für Cookie-Check (optional):**

```html
<script>
// Prüfe Real Cookie Banner Pro Zustimmung
if (window.RealCookieBanner && window.RealCookieBanner.hasConsent) {
  if (window.RealCookieBanner.hasConsent('marketing')) {
    fbq('init', '1305800130475673');
    fbq('track', 'PageView');
  }
} else {
  // Fallback: Immer tracken (kann rechtliche Risiken haben!)
  fbq('init', '1305800130475673');
  fbq('track', 'PageView');
}
</script>
```

---

## 7. Trigger-Konfiguration (All Pages mit Consent)

Zusammengefasst sollten folgende Trigger-Konfigurationen existieren:

### 7.1 Trigger: All Pages

| Eigenschaft | Wert |
|-------------|------|
| **Name** | `All Pages` oder `Page View` |
| **Typ** | Page View |
| **Bedingung** | (leer lassen = alle Seiten) |

### 7.2 Trigger: Form Submissions

| Eigenschaft | Wert |
|-------------|------|
| **Name** | `Form - Alle Formulare absenden` |
| **Typ** | Form Submission |
| **Selektor** | `form` |

### 7.3 Trigger: Consent geändert

| Eigenschaft | Wert |
|-------------|------|
| **Name** | `Consent - Marketing aktualisiert` |
| **Typ** | Custom Event |
| **Event-Name** | `cookiebot_consent_changed` |

---

## 8. Tags zusammenfassung

Nach Abschluss sollten folgende Tags existieren:

| Tag-Name | Trigger | Status |
|----------|---------|--------|
| `Meta Pixel - Base Code` | All Pages | Ausstehend* |
| `Meta Pixel - PageView Event` | All Pages (mit Base Code Abhängigkeit) | Ausstehend* |
| `Meta Pixel - Lead Event` | Form Submission | Ausstehend* |
| `Meta Pixel - Purchase Event** | (Optional, für E-Commerce) | Ausstehend* |

\* = "Ausstehend" bis Veröffentlichung

\*\* = Optional, wird später hinzugefügt wenn nötig

---

## 9. Testen mit Meta Pixel Helper Chrome Extension

### 9.1 Extension installieren

1. Öffne [Meta Pixel Helper im Chrome Web Store](https://chrome.google.com/webstore)
2. Suche nach: **Meta Pixel Helper**
3. Klicke **Zu Chrome hinzufügen**
4. Bestätige mit **Erweiterung hinzufügen**

### 9.2 Pixel Helper konfigurieren

1. Klicke auf das Meta Pixel Helper Icon (oben rechts in Chrome)
2. Aktiviere **Use preview/debug mode**
3. Gebe deine **Pixel ID** ein: `1305800130475673`

### 9.3 Testen im Preview-Modus des GTM

**Vor Veröffentlichung testen:**

1. Im GTM Container: Klicke auf **Vorschau** (oben rechts)
2. Gebe die Website-URL ein: `https://neurealis.de`
3. Es öffnet sich die neurealis-Seite mit GTM Debug-Overlay (unten)
4. Öffne zusätzlich die **Meta Pixel Helper** Extension

**Test-Szenarios:**

| Szenario | Aktion | Ergebnis |
|----------|--------|----------|
| **PageView** | Seite laden | `PageView` Event in Pixel Helper |
| **Form** | Kontaktformular ausfüllen + absenden | `Lead` Event + Form-Daten |
| **Cookie-Zustimmung** | Cookie-Banner annehmen/ablehnen | Tags laden/nicht laden |

**Screenshot-Hinweise:**
- GTM Debug-Panel sollte zeigen: Tags firing, Events, Variablen
- Meta Pixel Helper sollte grün werden mit Event-Details

### 9.4 Debug-Informationen sammeln

Falls Tags nicht feuern:

1. **DevTools öffnen** (F12)
2. **Netzwerk-Tab:** Suche nach `facebook.net` Requests
3. **Konsole:** Achte auf JavaScript-Fehler
4. **Meta Pixel Helper:** Sollte Fehler anzeigen wenn Pixel nicht lädt

**Häufige Probleme:**

| Problem | Ursache | Lösung |
|---------|--------|--------|
| Keine Events | Base Code lädt nicht | Trigger prüfen (All Pages?) |
| Lead Event fehlt | Form-Trigger stimmt nicht | CSS-Selektor testen: `document.querySelectorAll('form').length` |
| Consent blockiert Pixel | Marketing-Zustimmung nicht gegeben | Cookie-Banner akzeptieren |
| 404 auf `fbevents.js` | CDN-Block oder Adblocker | Adblocker deaktivieren, VPN prüfen |

---

## 10. Veröffentlichen

### 10.1 Vor Veröffentlichung

1. **Alle Tags überprüfen:**
   - [ ] `Meta Pixel - Base Code` existiert und hat Trigger "All Pages"
   - [ ] `Meta Pixel - Lead Event` hat Trigger für Formulare
   - [ ] Alle Tags haben korrekte Pixel ID: `1305800130475673`

2. **Konsole prüfen:**
   - [ ] Keine roten Fehler im GTM Debug-Panel
   - [ ] Meta Pixel Helper zeigt grünes Häkchen

3. **Cookie-Consent prüfen:**
   - [ ] Marketing-Kategorie existiert in Real Cookie Banner Pro
   - [ ] Tags respektieren Cookie-Einstellungen

### 10.2 Version-Hinweise

1. Im GTM Container oben: Klicke auf **Versionsverwaltung** (falls vorhanden)
2. Gib eine **Versions-Beschreibung** ein:
   ```
   Meta Pixel Setup - Base Code, PageView, Lead Event mit Cookie Consent
   ```

### 10.3 Veröffentlichen

1. Klicke auf **Veröffentlichen** (oben rechts, blauer Button)
2. Der Dialog fragt nach Veröffentlichungs-Notizen
3. **Notiz eingeben:**
   ```
   Meta Pixel Integration für neurealis.de
   - Base Code mit Pixel ID 1305800130475673
   - PageView Event (alle Seiten)
   - Lead Event (Formulare)
   - Cookie Consent Integration
   ```
4. Klicke **Veröffentlichen bestätigen**

**Status-Check:**
- GTM sollte nun sagen: "Veröffentlichung erfolgreich"
- Container sollte aktiv sein

### 10.4 Nach Veröffentlichung

1. **Warte 10-15 Minuten** (GTM Propagierung)
2. Öffne `https://neurealis.de` im **Incognito-Modus**
3. Öffne **Meta Pixel Helper**
4. Sollte Events tracken zeigen

---

## 11. Events verwalten (Zusätzliche Events später)

Falls später weitere Events nötig sind, folgende Template verwenden:

### 11.1 Purchase Event (E-Commerce)

**Tag-Code:**

```html
<script>
fbq('track', 'Purchase', {
  value: {{purchase_value}},
  currency: 'EUR',
  content_name: {{product_name}},
  content_ids: {{product_ids}},
  content_type: 'product'
});
</script>
```

**Trigger:** Checkout Complete / Bestellung erfolgreich

**Variablen benötigt:**
- `{{purchase_value}}` - Gesamtbetrag
- `{{product_name}}` - Produktname
- `{{product_ids}}` - Produkt-IDs

### 11.2 ViewContent Event (Produktseite)

**Tag-Code:**

```html
<script>
fbq('track', 'ViewContent', {
  content_name: {{page_title}},
  content_ids: [{{product_id}}],
  content_type: 'product',
  value: {{product_price}},
  currency: 'EUR'
});
</script>
```

**Trigger:** Page View auf Produkt-Seiten

### 11.3 AddToCart Event

**Tag-Code:**

```html
<script>
fbq('track', 'AddToCart', {
  content_name: {{product_name}},
  content_ids: [{{product_id}}],
  content_type: 'product',
  value: {{product_price}},
  currency: 'EUR'
});
</script>
```

**Trigger:** Custom Event `add_to_cart`

---

## 12. Troubleshooting & FAQ

### 12.1 "Pixel Helper zeigt Fehler"

**Problem:** Meta Pixel Helper sagt "Tracking nicht aktiv" oder zeigt Error

**Lösung:**
1. Pixel ID korrekt? `1305800130475673`
2. Facebook Business Account hat Zugriff? Admin prüfen
3. Cookies akzeptiert? Cookie-Banner testen
4. Browser-Adblock deaktivieren

### 12.2 "Events kommen nicht in Meta Events Manager an"

**Häufige Ursachen:**

| Symptom | Ursache | Fix |
|---------|--------|-----|
| Pixel lädt, aber keine Events | Trigger-Bedingung falsch | Trigger debuggen (DevTools) |
| Events sichtbar in Helper, nicht im Manager | Datenverzögerung | 24-48h warten, Events im Manager rescannen |
| Nur PageView, kein Lead | Form-Selektor stimmt nicht | `document.querySelectorAll('form')` in DevTools testen |
| Events blockiert durch Cookie | Zustimmung nicht gegeben | Marketing-Zustimmung fordern |

### 12.3 "Wie bekomme ich Events in die Tag Manager Vorschau?"

**Schritte:**

1. GTM Container → **Vorschau**
2. Website laden
3. **GTM Debug Panel** unten rechts
4. **Tags** Sektion öffnen
5. **Meta Pixel Tags** sollten aufgelistet sein mit Status "Fired" oder "Not Fired"

### 12.4 "Kann ich Events testen ohne live zu gehen?"

**Ja, mit Preview Mode:**

1. GTM: Klicke **Vorschau** (nicht veröffentlichen!)
2. Website lädt mit GTM-Debug-Overlay
3. Meta Pixel Helper im Debug-Modus
4. Alle Changes sind nur lokal sichtbar (nicht für echte Nutzer)

---

## 13. Best Practices

### 13.1 Datenschutz & DSGVO

- ✅ Cookie-Zustimmung vor Tracking einholen (bereits implementiert)
- ✅ Datenschutz auf neurealis.de aktualisieren
- ✅ Meta Datenschutzrichtlinie in Impressum verlinken
- ✅ Nutzer können Cookie-Einstellungen jederzeit ändern

### 13.2 Performanz

- ✅ Meta Pixel Base Code asynchron laden (bereits in Code)
- ✅ Keine Überlastung mit Custom Events
- ✅ Max. 1 Event pro Nutzer-Aktion tracken

### 13.3 Konvertierungen

Folgende **Standard-Konvertierungen** sollten getrackt werden:

| Event | Auslöser | Business Value |
|-------|----------|-----------------|
| **Lead** | Formular absenden | Anfrage, Kontakt |
| **ViewContent** | Angebotsseite laden | Interesse |
| **AddToCart** | (Falls Einkauf) | Produkt-Interesse |
| **Purchase** | (Falls Einkauf) | Umsatz |

### 13.4 Audience Building

Nach 2-4 Wochen Datensammlung:
1. Meta Events Manager → **Audiences**
2. Erstelle **Custom Audience** basierend auf Events
3. Nutze für Retargeting-Kampagnen

---

## 14. Checkliste - Vor Go-Live

- [ ] GTM Container ID stimmt: `GTM-MPNTT5L6`
- [ ] Meta Pixel ID stimmt: `1305800130475673`
- [ ] Base Code Tag erstellt und triggert "All Pages"
- [ ] PageView Event funktioniert
- [ ] Lead Event triggert bei Formularen
- [ ] Cookie-Consent Integration aktiv
- [ ] Meta Pixel Helper zeigt grünes Häkchen
- [ ] Preview-Test erfolgreich (alle Events sichtbar)
- [ ] Version-Notiz verfasst
- [ ] Veröffentlicht
- [ ] 15 Min nach Veröffentlichung nochmal testen im Incognito-Modus
- [ ] Im Meta Events Manager nach 24h Daten überprüfen

---

## 15. Support & Referenzen

**Offizielle Dokumentation:**
- [Meta Pixel Dokumentation](https://developers.facebook.com/docs/facebook-pixel)
- [Google Tag Manager Hilfe](https://support.google.com/tagmanager)
- [Real Cookie Banner Pro Dokumentation](https://www.webtoffee.com/real-cookie-banner-documentation/)

**Häufig benötigte URLs:**
- Meta Events Manager: `https://business.facebook.com/adsmanager/manage/campaigns`
- GTM Container: `https://tagmanager.google.com/?hl=de#/container/accounts/`
- neurealis Website: `https://neurealis.de`

---

**Dokumentation erstellt:** 2026-02-02
**Version:** 1.0
**Autor:** Claude Code
**Status:** Entwurf (Veröffentlichung ausstehend)
