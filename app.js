export default function appSrc(express, bodyParser, createReadStream, crypto, http, MongoClient) {
    const app = express();

    app.use((req, res, next) => {
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS,DELETE',
            'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
        });

        next();
    });

    app.use((err, req, res, next) => {
        const path = req.path;

        if(path !== '/' && !path.startsWith('/')) {
            return res.redirect(308, path + '/' + req.url.substring(path.length));
        }

        next();
    })

    app.use(bodyParser.urlencoded({ extended: false }));

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