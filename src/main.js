import { Client, Databases, Query } from 'node-appwrite';

// Helper function to fetch all documents from a collection using pagination
const fetchAllDocuments = async (db, databaseId, collectionId, selectKeys) => {
  let documents = [];
  let cursor = null;
  const limit = 100;

  while (true) {
    const queries = [Query.select(Array.isArray(selectKeys) ? selectKeys : [selectKeys]), Query.limit(limit)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const response = await db.listDocuments(databaseId, collectionId, queries);
    if (response.documents.length === 0) break;
    documents.push(...response.documents);
    cursor = response.documents[response.documents.length - 1].$id;
  }
  return documents;
};

// Helper to upsert a document
const upsertDocument = async (db, databaseId, collectionId, documentId, data) => {
    try {
        await db.updateDocument(databaseId, collectionId, documentId, data);
    } catch (e) {
        if (e.code === 404) {
            await db.createDocument(databaseId, collectionId, documentId, data);
        } else {
            throw e;
        }
    }
};


// --- Task 1: Update Links Cache ---
async function updateLinksCache(db, log, error) {
  log('Starting: Update Links Cache...');
  const { APPWRITE_DATABASE_ID, APPWRITE_YOUTUBE_COLLECTION_ID, APPWRITE_FORM_COLLECTION_ID, CACHE_COLLECTION_ID, LINKS_UPLOADERS_CACHE_DOCUMENT_ID } = process.env;

  const [youtubeDocs, formDocs] = await Promise.all([
    fetchAllDocuments(db, APPWRITE_DATABASE_ID, APPWRITE_YOUTUBE_COLLECTION_ID, 'createdBy'),
    fetchAllDocuments(db, APPWRITE_DATABASE_ID, APPWRITE_FORM_COLLECTION_ID, 'createdBy'),
  ]);

  const allUploadersSet = new Set();
  youtubeDocs.forEach(doc => { if (doc.createdBy) allUploadersSet.add(doc.createdBy); });
  formDocs.forEach(doc => { if (doc.createdBy) allUploadersSet.add(doc.createdBy); });
  
  const finalData = { uploaders: [...allUploadersSet].sort() };
  await upsertDocument(db, APPWRITE_DATABASE_ID, CACHE_COLLECTION_ID, LINKS_UPLOADERS_CACHE_DOCUMENT_ID, { data: JSON.stringify(finalData) });
  log('Finished: Update Links Cache.');
}

// --- Task 2: Update Uploader Cache ---
async function updateUploaderCache(db, log, error) {
  log('Starting: Update Uploader Cache...');
  const { APPWRITE_DATABASE_ID, NOTE_COLLECTION_ID, CACHE_COLLECTION_ID, UPLOADERS_CACHE_DOCUMENT_ID } = process.env;

  const noteDocs = await fetchAllDocuments(db, APPWRITE_DATABASE_ID, NOTE_COLLECTION_ID, ['userName', 'abbreviation']);
  
  const uploaderMapBySubject = {};
  const allUploadersSet = new Set();
  
  for (const doc of noteDocs) {
      const { userName, abbreviation } = doc;
      if (!userName || !abbreviation) continue;
      allUploadersSet.add(userName);
      if (!uploaderMapBySubject[abbreviation]) uploaderMapBySubject[abbreviation] = new Set();
      uploaderMapBySubject[abbreviation].add(userName);
  }
  
  const finalData = { all: [...allUploadersSet].sort() };
  for (const subject in uploaderMapBySubject) {
    finalData[subject] = [...uploaderMapBySubject[subject]].sort();
  }
  
  await upsertDocument(db, APPWRITE_DATABASE_ID, CACHE_COLLECTION_ID, UPLOADERS_CACHE_DOCUMENT_ID, { data: JSON.stringify(finalData) });
  log('Finished: Update Uploader Cache.');
}

// --- Task 3: Update Teacher Stats ---
async function updateTeacherStats(db, log, error) {
    log('Starting: Update Teacher Stats...');
    const { APPWRITE_DATABASE_ID, APPWRITE_NOTE_COLLECTION_ID, APPWRITE_FORM_COLLECTION_ID, APPWRITE_YOUTUBE_COLLECTION_ID, STATS_COLLECTION_ID, STATS_DOCUMENT_ID } = process.env;

    const [noteDocs, formDocs, youtubeDocs] = await Promise.all([
        fetchAllDocuments(db, APPWRITE_DATABASE_ID, APPWRITE_NOTE_COLLECTION_ID, 'userName'),
        fetchAllDocuments(db, APPWRITE_DATABASE_ID, APPWRITE_FORM_COLLECTION_ID, 'createdBy'),
        fetchAllDocuments(db, APPWRITE_DATABASE_ID, APPWRITE_YOUTUBE_COLLECTION_ID, 'createdBy'),
    ]);

    const countCreators = (documents, key) => documents.reduce((acc, doc) => {
        if (doc[key]) acc[doc[key]] = (acc[doc[key]] || 0) + 1;
        return acc;
    }, {});

    const noteCounts = countCreators(noteDocs, 'userName');
    const formCounts = countCreators(formDocs, 'createdBy');
    const youtubeCounts = countCreators(youtubeDocs, 'createdBy');

    const allTeacherNames = new Set([...Object.keys(noteCounts), ...Object.keys(formCounts), ...Object.keys(youtubeCounts)]);
    
    const detailedContributions = [...allTeacherNames].map(name => ({
        name,
        notes: noteCounts[name] || 0,
        forms: formCounts[name] || 0,
        youtube: youtubeCounts[name] || 0,
        total: (noteCounts[name] || 0) + (formCounts[name] || 0) + (youtubeCounts[name] || 0),
    })).sort((a, b) => b.total - a.total);

    await upsertDocument(db, APPWRITE_DATABASE_ID, STATS_COLLECTION_ID, STATS_DOCUMENT_ID, { data: JSON.stringify(detailedContributions) });
    log('Finished: Update Teacher Stats.');
}


// --- Main Exported Function ---
export default async ({ res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT)
    .setKey(process.env.APPWRITE_API_KEY);
  const db = new Databases(client);

  try {
    log("Running all scheduled tasks...");
    
    // Run all tasks concurrently for better performance
    await Promise.all([
        updateLinksCache(db, log, error),
        updateUploaderCache(db, log, error),
        updateTeacherStats(db, log, error)
    ]);
    
    log("All scheduled tasks completed successfully.");
    return res.json({ success: true, message: 'All scheduled tasks completed.' });

  } catch (e) {
    error('A scheduled task failed:', e);
    return res.json({ success: false, error: e.message }, 500);
  }
};