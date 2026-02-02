# Meta Ads API Setup - Anleitung

**WICHTIG:** Business Verification kann 5+ Werktage dauern. SOFORT starten!

---

## Schritt 1: Business Verification (BLOCKER!)

1. Gehe zu: https://business.facebook.com/settings/security
2. Klicke auf "Start Verification" / "Verifizierung starten"
3. Wähle Verifizierungsmethode:
   - **Empfohlen:** Domain-Verifizierung + Geschäftsdokumente

### Benötigte Dokumente (eines davon):
- Gewerbeanmeldung
- Handelsregisterauszug
- Steuerbescheid mit Firmennamen
- Telefonrechnung mit Firmenadresse

### Domain verifizieren:
1. Business Settings → Brand Safety → Domains
2. "Add Domain" → `neurealis.de`
3. DNS TXT Record hinzufügen ODER Meta-Tag in `<head>`

**Erwartete Dauer:** 5 Werktage bis mehrere Wochen

---

## Schritt 2: Meta Pixel erstellen

1. Gehe zu: https://business.facebook.com/events_manager
2. "Connect Data Sources" → "Web" → "Meta Pixel"
3. Pixel-Name: `neurealis_pixel`
4. **Pixel-ID notieren:** `XXXXXXXXXXXXXXXXX`

### Im GTM einrichten:
1. GTM öffnen: https://tagmanager.google.com
2. Tags → New → "Custom HTML"
3. Folgenden Code einfügen (Pixel-ID ersetzen):

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
fbq('init', 'DEINE_PIXEL_ID');
fbq('track', 'PageView');
</script>
```

4. Trigger: "All Pages" mit Cookie-Consent (Marketing = true)
5. Veröffentlichen

---

## Schritt 3: System User erstellen (nach Verification)

1. Business Settings → Users → System Users
2. "Add" → Name: `neurealis_api_user`
3. Rolle: **Admin** (für volle API-Rechte)
4. Assets zuweisen:
   - Ad Account: `act_XXXXXXXXX`
   - Pixel: `XXXXXXXXXXXXXXXXX`
   - Pages (falls vorhanden)

---

## Schritt 4: Access Token generieren

1. System User auswählen → "Generate Token"
2. Permissions auswählen:
   - `ads_read` ✅
   - `ads_management` ✅
   - `business_management` ✅
   - `leads_retrieval` ✅ (für Lead Ads)
3. Token-Typ: **Permanent** (verfällt nicht)
4. **Token sicher speichern!** (wird nur einmal angezeigt)

---

## Schritt 5: Credentials an Claude geben

Nach Abschluss diese Werte bereitstellen:

```
META_PIXEL_ID=XXXXXXXXXXXXXXXXX
META_AD_ACCOUNT_ID=act_XXXXXXXXX
META_SYSTEM_USER_TOKEN=EAAG...
META_APP_ID=XXXXXXXXX (falls eigene App)
META_APP_SECRET=XXXXXXXXX (falls eigene App)
```

---

## Wichtige Links

- Business Manager: https://business.facebook.com
- Events Manager (Pixel): https://business.facebook.com/events_manager
- Ads Manager: https://www.facebook.com/adsmanager
- API Explorer: https://developers.facebook.com/tools/explorer
- Dokumentation: https://developers.facebook.com/docs/marketing-apis

---

## Troubleshooting

### "Business not verified"
→ Verification abwarten, kann bis zu 2 Wochen dauern

### "Permission denied"
→ System User hat nicht alle Assets zugewiesen

### Token funktioniert nicht
→ Neuen Token generieren, alten wurde möglicherweise revoked

---

*Erstellt: 2026-02-02*
