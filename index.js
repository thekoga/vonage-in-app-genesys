import { Voice, vcr } from '@vonage/vcr-sdk';
import { Vonage } from '@vonage/server-sdk';
import express from 'express';
import cors from 'cors';
import pug from 'pug';

const app = express();
const port = process.env.VCR_PORT;
const vonage = new Vonage(
    {
      applicationId: process.env.API_APPLICATION_ID,
      privateKey: process.env.PRIVATE_KEY
    }
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

const session = vcr.createSession();
const voice = new Voice(session);

await voice.onCall('onCall');

app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

app.get('/', async (req, res, next) => {
    try {
        res.send(pug.renderFile('public/index.html'));
    } catch (e) {
        next(e);
    }
});

app.get('/prepCall', async (req, res, next) => {
    try {
        if (req.headers['sec-fetch-site'] === 'same-origin') {
            const user = await vonage.users.createUser();
            const jwt = generateJWT(user.name);
            res.json({
                jwt: jwt
            });
        } else {
            console.log("NOT SAME ORIGIN");
            res.sendStatus(401);
        }
    } catch (e) {
        next(e);
    }
});

app.post('/onCall', async (req, res, next) => {
    try {
        const session = vcr.createSession();
        const voice = new Voice(session);

        await voice.onCallEvent({ callback: 'onEvent', conversationID: req.body.conversation_uuid });

        console.log('ANSWER:', req.body)
        console.log('THIS IS THE FROM  ', JSON.parse(req.body.custom_data).customFrom)

        let ncco = [
            {
                "action": "talk",
                "text": "<speak><break time='0.5s'/>エージェントにお繋ぎします。</speak>",
                "language": "ja-JP"
            },
            {
                "action":"connect",
                "from": JSON.parse(req.body.custom_data).customFrom,
                "endpoint": [
                  {
                      "type": "sip",
                      "uri": process.env.SIP_URI
                  }
                ]
            }
        ];

        session.log("debug", "answer_url: ncco", ncco)

        res.json(ncco);
    } catch (e) {
        next(e);
    }
});

app.post('/onEvent', async (req, res, next) => {
    try {
        //console.log('event status is: ', req.body.status);
        //console.log('event direction is: ', req.body.direction);
        console.log('EVENT: ', req.body)
        res.sendStatus(200);
    } catch (e) {
        next(e);
    }
});

function generateJWT(username) {
    const nowTime = Math.round(new Date().getTime() / 1000);
    const aclPaths = {
        "/*/users/**": {},
        "/*/conversations/**": {},
        "/*/sessions/**": {},
        "/*/devices/**": {},
        "/*/image/**": {},
        "/*/media/**": {},
        "/*/applications/**": {},
        "/*/push/**": {},
        "/*/knocking/**": {},
        "/*/legs/**": {}
    };
    
    return vcr.createVonageToken({ exp: nowTime + 86400, subject: username, aclPaths: aclPaths });;
}

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});