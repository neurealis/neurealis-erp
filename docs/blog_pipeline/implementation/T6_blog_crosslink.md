# T6: blog-crosslink Edge Function

**Status:** Deployed
**Datum:** 2026-01-29
**Function Slug:** `blog-crosslink`
**Version:** 1

---

## Zusammenfassung

Die `blog-crosslink` Edge Function ist ein wöchentlicher Vernetzungs-Job, der:

1. **Embeddings generiert** für Blog-Posts ohne Embedding
2. **Link-Vorschläge erstellt** basierend auf semantischer Ähnlichkeit
3. **NICHT auto-einfügt** - nur Vorschläge werden geloggt

---

## Trigger

- **Wöchentlich:** Sonntags 06:00 UTC (Cron noch einzurichten)
- **Manuell:** POST-Request mit Authorization Header

---

## Verarbeitung

### 1. Post-Auswahl

Verarbeitet werden Posts die:
- `status = 'published'`
- UND: `embedding IS NULL` ODER `internal_links` hat weniger als 2 Einträge

**Rate-Limit:** Max 10 Posts pro Run

### 2. Embedding-Generierung

Für Posts ohne Embedding:
```
Text = titel + "\n\n" + excerpt + "\n\n" + stripHtml(inhalt)
Model = text-embedding-3-small (1536 dimensions)
```

Das Embedding wird in `blog_posts.embedding` gespeichert.

### 3. Link-Vorschläge

Für Posts mit weniger als 2 internen Links:
- Ruft `search_similar_blog_posts()` RPC auf
- Findet Top-5 ähnliche Posts basierend auf Cosine Similarity
- Vorschläge werden im Response zurückgegeben (NICHT in DB gespeichert)

---

## Output-Format

```json
{
  "processed_posts": 5,
  "embeddings_created": 2,
  "link_suggestions": [
    {
      "post_slug": "bad-sanieren-kosten",
      "post_title": "Bad sanieren: Kosten 2026",
      "suggested_links": [
        { "slug": "wohnungssanierung-komplett", "title": "Wohnungssanierung komplett", "similarity": 0.87 },
        { "slug": "vinyl-vs-parkett", "title": "Vinyl vs Parkett", "similarity": 0.72 }
      ]
    }
  ],
  "errors": []
}
```

---

## Verwendete RPC

```sql
search_similar_blog_posts(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 5,
  exclude_id UUID DEFAULT NULL
)
```

Gibt zurück: `id, title, slug, cluster, similarity`

---

## Technische Details

| Eigenschaft | Wert |
|-------------|------|
| **Runtime** | Deno (Supabase Edge) |
| **Auth** | JWT erforderlich (verify_jwt: true) |
| **Embedding Model** | text-embedding-3-small |
| **Embedding Dimensions** | 1536 |
| **Max Posts/Run** | 10 |
| **Text-Limit** | 8000 Zeichen (OpenAI Input) |

---

## Aufruf

### Manuell (mit Service Role Key)
```bash
curl -X POST "https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/blog-crosslink" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Via Cron (einzurichten)
```sql
SELECT cron.schedule(
  'blog-crosslink-weekly',
  '0 6 * * 0',  -- Sonntags 06:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://mfpuijttdgkllnvhvjlu.supabase.co/functions/v1/blog-crosslink',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

---

## Fehlerbehandlung

- OpenAI API Fehler werden geloggt und Post übersprungen
- RPC-Fehler werden geloggt, Verarbeitung anderer Posts geht weiter
- Alle Fehler sind im `errors` Array des Response

---

## Abhängigkeiten

- **OPENAI_API_KEY** - Muss in Supabase Secrets gesetzt sein
- **search_similar_blog_posts** RPC - Muss existieren (T1 Migration)
- **blog_posts.embedding** Column - vector(1536)

---

## Nächste Schritte

1. [ ] Cron-Job in T8 einrichten
2. [ ] End-to-End Test in T9
3. [ ] Optional: Link-Vorschläge in separate Tabelle speichern

---

*Erstellt: 2026-01-29*
