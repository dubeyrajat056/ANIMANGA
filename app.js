const express = require('express');
const axios = require('axios');
const app = express();

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

// MangaDex API base URL
const MANGA_DEX_API = 'https://api.mangadex.org';
const PORT = 3000; // Directly set the port

// Home route - Trending manga
app.get('/', async (req, res) => {
    try {
        const response = await axios.get(`${MANGA_DEX_API}/manga`, {
            params: {
                limit: 20,
                order: { followedCount: 'desc' },
                includes: ['cover_art']
            }
        });
        
        const mangaList = response.data.data.map(manga => {
            const coverArt = manga.relationships.find(r => r.type === 'cover_art');
            const coverFileName = coverArt?.attributes?.fileName || '';
            return {
                id: manga.id,
                title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
                description: manga.attributes.description.en || '',
                coverUrl: `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg`
            };
        });
        
        res.render('index', { mangaList });
    } catch (error) {
        console.error('Error fetching manga:', error);
        res.status(500).send('Error loading manga');
    }
});

// Manga detail route
app.get('/manga/:id', async (req, res) => {
    try {
        const [mangaResponse, chaptersResponse] = await Promise.all([
            axios.get(`${MANGA_DEX_API}/manga/${req.params.id}`, {
                params: { includes: ['cover_art', 'author'] }
            }),
            axios.get(`${MANGA_DEX_API}/manga/${req.params.id}/feed`, {
                params: {
                    limit: 100,
                    order: { chapter: 'asc' },
                    translatedLanguage: ['en']
                }
            })
        ]);
        
        const manga = mangaResponse.data.data;
        const coverArt = manga.relationships.find(r => r.type === 'cover_art');
        const author = manga.relationships.find(r => r.type === 'author');
        
        const mangaData = {
            id: manga.id,
            title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
            description: manga.attributes.description.en || '',
            author: author?.attributes?.name || 'Unknown',
            status: manga.attributes.status || 'unknown',
            coverUrl: `https://uploads.mangadex.org/covers/${manga.id}/${coverArt?.attributes?.fileName}.512.jpg`,
            chapters: chaptersResponse.data.data.map(chapter => ({
                id: chapter.id,
                chapter: chapter.attributes.chapter,
                title: chapter.attributes.title || `Chapter ${chapter.attributes.chapter}`,
                date: new Date(chapter.attributes.publishAt).toLocaleDateString()
            }))
        };
        
        res.render('detail', { manga: mangaData });
    } catch (error) {
        console.error('Error fetching manga details:', error);
        res.status(500).send('Error loading manga details');
    }
});

//cheak for thumbanail
// Express backend route
app.get('/proxy-image', async (req, res) => {
  const { url } = req.query;
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType);
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Image fetch failed');
  }
});

//cheak end



// Chapter reader route - Updated for full images
app.get('/read/:chapterId', async (req, res) => {
    try {
        // Get chapter data
        const chapterResponse = await axios.get(`${MANGA_DEX_API}/at-home/server/${req.params.chapterId}`);
        const chapterData = chapterResponse.data;
        
        // Get manga details for navigation
        const mangaResponse = await axios.get(`${MANGA_DEX_API}/chapter/${req.params.chapterId}`, {
            params: { includes: ['manga'] }
        });
        
        const mangaId = mangaResponse.data.data.relationships.find(r => r.type === 'manga').id;
        
        res.render('reader', {
            chapterId: req.params.chapterId,
            mangaId,
            baseUrl: chapterData.baseUrl,
            chapterHash: chapterData.chapter.hash,
            pages: chapterData.chapter.data,
            dataSaver: chapterData.chapter.dataSaver,
            // Add chapter info for display
            chapterNumber: mangaResponse.data.data.attributes.chapter,
            chapterTitle: mangaResponse.data.data.attributes.title || `Chapter ${mangaResponse.data.data.attributes.chapter}`
        });
    } catch (error) {
        console.error('Error fetching chapter:', error);
        res.status(500).send('Error loading chapter');
    }
});


// Search route
app.get('/search', async (req, res) => {
    try {
        const query = req.query.query;
        if (!query) {
            return res.redirect('/');
        }
        
        const response = await axios.get(`${MANGA_DEX_API}/manga`, {
            params: {
                title: query,
                limit: 20,
                includes: ['cover_art']
            }
        });
        
        const mangaList = response.data.data.map(manga => {
            const coverArt = manga.relationships.find(r => r.type === 'cover_art');
            const coverFileName = coverArt?.attributes?.fileName || '';
            return {
                id: manga.id,
                title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
                description: manga.attributes.description.en || '',
                coverUrl: `https://uploads.mangadex.org/covers/${manga.id}/${coverFileName}.256.jpg`
            };
        });
        
        res.render('index', { mangaList, searchQuery: query });
    } catch (error) {
        console.error('Error searching manga:', error);
        res.status(500).send('Error searching manga');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
