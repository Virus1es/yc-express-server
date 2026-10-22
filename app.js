export default function appSrc(
    express,
    bodyParser,
    createReadStream,
    crypto,
    http,
    MongoClient,
    pug
) {
    const app = express();

    app.use((req, res, next) => {
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS,DELETE',
            'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
        });

        next();
    });

    app.use((req, res, next) => {
        const path = req.path;

        if(path !== '/' && !path.startsWith('/')) {
            return res.redirect(308, path + '/' + req.url.substring(path.length));
        }

        next();
    })

    app.use(bodyParser.urlencoded({ extended: false }));

    app.use(express.json({ limit: '10kb' }));

    app.options(/.*/, (req, res) => {
        res.sendStatus(204);
    });

    app.get('/login/', (req, res) => {
        res.type('text/plain').send('troan');
    });

    app.get('/code/', (req, res) => {
        const stream = createReadStream(new URL(import.meta.url));

        res.type('text/plain; charset=utf-8');

        stream.on('error', error => {
            if (!res.headersSent) {
                res.status(500).send(error.message);
            } else {
                res.destroy(error);
            }
        });

        stream.pipe(res);
    });

    app.get('/sha1/:input/', (req, res) => {
        const hash = crypto
            .createHash('sha1')
            .update(req.params.input)
            .digest('hex');

        res.type('text/plain').send(hash);
    });

    app.post('/insert/', async (req, res) => {
        const { login, password, URL: connectionString } = req.body || {};

        if (
            typeof login !== 'string' ||
            typeof password !== 'string' ||
            typeof connectionString !== 'string'
        ) {
            return res.status(400).type('text/plain').send('invalid request body');
        }

        let client

        try {
            const url = new URL(connectionString);

            if (
                url.protocol !== 'mongodb:' ||
                !process.env.MONGODB_ALLOWED_HOST ||
                url.hostname !== process.env.MONGODB_ALLOWED_HOST
            )
            {
                return res.status(400).type('text/plain').send('MongoDB host is not allowed');
            }

            client = new MongoClient(connectionString, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000
            });

            await client.connect();

            const db = client.db();
            const users = db.collection('users');

            await users.insertOne({
                login: login,
                password: password,
            });

            return res.status(200).type('text/plain').send('OK')
        } catch (error) {
            return res.status(502).type('text/plain').send('MongoDB operation failed');
        }
        finally {
            if (client) {
                await client.close().catch(() => {});
            }
        }
    });

    app.post('/render/', async (req, res) => {
        const { addr } = req.query;
        const { random2, random3 } = req.body ?? {};

        if(typeof addr !== 'string') {
            return res.status(400).send('Missing addr');
        }

        if(
            !['string', 'number'].includes(typeof random2) ||
            !['string', 'number'].includes(typeof random3)
        ) {
            return res.status(400).send('Missing invalid JSON body');
        }

        let url;

        try {
            url = new URL(addr);
        } catch {
            return res.status(400).send('Invalid URL');
        }

        const allowedHosts = ['kodaktor.ru', 'web-scriptor.ru'];

        if (
            !allowedHosts.includes(url.hostname) ||
            url.pathname !== '/j/unsafe_0ebdb' ||
            !['http:', 'https:'].includes(url.protocol) ||
            url.port ||
            url.username ||
            url.password
        ) {
            return res.status(400).send('Template URL is not allowed');
        }

        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000),
                redirect: 'manual'
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                console.log('Redirect location:', location);

                return res.status(502).send('Template URL redirects. Check server logs.');
            }

            if (!response.ok) {
                return res.status(502).send('Template fetch failed');
            }

            const template = await response.text();

            if (template.length > 20_000) {
                return res.status(413).send('Template too large');
            }

            const html = pug.render(template, {
                random2,
                random3
            });

            return res.type('html').send(html);
        } catch (error) {
            console.error('Render error: ', error);
            return res.status(502).send('Render failed');
        }
    })

    const wordpressLogin = 'troan';

    const wordpressPost = {
        id: 1,
        date: '2026-10-22T12:00:00',
        date_gmt: '2026-10-22T09:00:00',
        modified: '2026-10-22T12:00:00',
        modified_gmt: '2026-10-22T09:00:00',
        slug: 'troan',
        status: 'publish',
        type: 'post',
        link: 'https://bbag2if5tmqahn04nsfb.containers.yandexcloud.net/wordpress/',
        title: {
            rendered: wordpressLogin,
        },
        content: {
            rendered: '<p>Первая запись</p>',
            protected: false,
        },
        excerpt: {
            rendered: '<p>Первая запись</p>',
            protected: false,
        },
        author: 1,
        featured_media: 0,
        comment_status: 'open',
        ping_status: 'open',
        sticky: false,
        template: '',
        format: 'standard',
        categories: [1],
        tags: []
    };

    const wordpressApiBase = '/wordpress/wp-json/wp/v2';

    const wordpressRoutes = {
        [wordpressApiBase]: {
            namespace: 'wp/v2',
            method: ['GET'],
            endpoint: [{ method: 'GET', args: {} }],
        },
        [`${wordpressApiBase}/post`]: {
            namespace: 'wp/v2',
            method: ['GET'],
            endpoint: [{ method: 'GET', args: {} }],
        },
        [`${wordpressApiBase}/post/(?P<id>[\\d]+)`]: {
            namespace: 'wp/v2',
            method: ['GET'],
            endpoint: [{ method: 'GET', args: {} }],
        }
    }

    app.get('/wordpress/', (req, res) => {
        res.type('html').send(`
            <!DOCTYPE html>
            <html lang="ru">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <title>${wordpressLogin}</title>
                </head>
                <body>
                    <header>
                        <h1>${wordpressLogin}</h1>
                    </header>
                    <main>
                        <article>
                            <h2>${wordpressPost.title.rendered}</h2>
                            ${wordpressPost.content.rendered}
                        </article>
                    </main>
                </body>
            </html>
        `);
    });

    app.get('/wordpress/wp-json/', (req, res) => {
        res.json({
            name: wordpressLogin,
            description: '',
            url: `${req.protocol}://${req.get('host')}/wordpress/`,
            namespaces: ['wp/v2'],
            authentication: {},
            routes: wordpressRoutes,
        });
    });

    app.get('/wordpress/wp-json/wp/v2/', (req, res) => {
        res.json({
            namespaces: ['wp/v2'],
            routes: wordpressRoutes,
        });
    });

    app.get('/wordpress/wp-json/wp/v2/posts/', (req, res) => {
        res.set({
            'X-WP-Total': '1',
            'X-WP-TotalPages': '1',
        });

        res.json([wordpressPost]);
    });

    app.get('/wordpress/wp-json/wp/v2/posts/:id/', (req, res) => {
        if (req.params.id !== '1') {
            return res.status(404).json({
                code: 'rest_post_invalid_id',
                message: 'Invalid post ID.',
                data: { status: 404 }
            });
        }

        res.json(wordpressPost);
    });

    app.all('/req/', (req, res) => {
        const addr = req.method === 'POST'
            ? req.body?.addr
            : req.query.addr;

        if (typeof addr !== 'string' || !addr) {
            return res.status(400).type('text/plain').send('Missing addr');
        }

        try {
            const url = new URL(addr);

            if (url.protocol !== 'http:') {
                return res.status(400).type('text/plain').send('Only HTTP is supported');
            }

            const request = http.get(url, response => {
                res.status(response.statusCode || 502);
                res.type('text/plain');
                response.pipe(res);
            });

            request.on('error', () => {
                if (!res.headersSent) {
                    res.status(502).type('text/plain').send('Request failed');
                } else {
                    res.destroy();
                }
            });
        } catch {
            res.status(400).type('text/plain').send('Invalid URL');
        }
    });

    app.all(/.*/, (req, res) => {
        res.type('text/plain').send('troan');
    });

    return app;
}