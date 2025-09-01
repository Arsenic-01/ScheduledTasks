# Scheduled Updates Function for Appwrite

This cloud function performs full recalculation of various caches and statistics in an Appwrite project. Unlike the incremental function, it rebuilds everything from scratch to ensure accuracy.

---

## Features

* **Links Cache Update**: Aggregates all uploaders from YouTube and Form collections.
* **Uploader Cache Update**: Builds global and subject-wise uploader lists from Notes collection.
* **Teacher Stats Recalculation**: Recomputes contribution counts for all teachers across notes, forms, and YouTube links.
* Designed to be run periodically (e.g., daily) via scheduled triggers.

---

## Environment Variables

| Key                                 | Description                          |
| ----------------------------------- | ------------------------------------ |
| `APPWRITE_ENDPOINT`                 | Your Appwrite endpoint               |
| `APPWRITE_PROJECT`                  | Project ID                           |
| `APPWRITE_API_KEY`                  | API key with database access         |
| `APPWRITE_DATABASE_ID`              | Database containing collections      |
| `APPWRITE_NOTE_COLLECTION_ID`       | Collection ID for notes              |
| `APPWRITE_FORM_COLLECTION_ID`       | Collection ID for forms              |
| `APPWRITE_YOUTUBE_COLLECTION_ID`    | Collection ID for YouTube links      |
| `CACHE_COLLECTION_ID`               | Collection ID for cache documents    |
| `LINKS_UPLOADERS_CACHE_DOCUMENT_ID` | Document ID for links uploader cache |
| `UPLOADERS_CACHE_DOCUMENT_ID`       | Document ID for uploader cache       |
| `STATS_COLLECTION_ID`               | Collection ID for teacher statistics |
| `STATS_DOCUMENT_ID`                 | Document ID for stats data           |

---

## Event Trigger

This function is intended for scheduled execution rather than real-time events. Example:

* **Cron Schedule:** `0 0 * * *` (Runs every midnight)
* Set trigger type to **Schedule** in Appwrite.

---

## Function Workflow

1. **Fetch All Documents**

   * Uses pagination to avoid size limits.
   * Pulls required fields only using `Query.select`.

2. **Update Links Cache**

   * Combines uploader names from YouTube and Forms collections.

3. **Update Uploader Cache**

   * Builds `all` uploader list and subject-wise uploader mappings from Notes collection.

4. **Update Teacher Stats**

   * Counts contributions per teacher for each content type.
   * Sorts teachers by total contributions.

---

## Local Development

```bash
npm install
npx functions-emulator start
```

Test manually:

```bash
curl -X POST http://localhost:3000 -H "Content-Type: application/json" -d '{}'
```

---

## Deployment

1. Zip the function code:

```bash
zip -r function.zip .
```

2. Upload to Appwrite Console → Functions → Upload Function.
3. Set runtime to **Node.js 18+**.
4. Configure environment variables.
5. Attach schedule trigger.

---

## Error Handling

* Uses `Promise.all` to run tasks concurrently for speed.
* Logs detailed errors in Appwrite function logs.
* Creates missing documents if not found (upsert behavior).

---

## License

MIT
