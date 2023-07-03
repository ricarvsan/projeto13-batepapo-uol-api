import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import Joi from 'joi';
import dayjs from 'dayjs';

// CRIAÇÃO DO APP
const app = express();

// CONFIGURAÇÕES
app.use(cors());
app.use(express.json());
dotenv.config();

// CONEXÃO COM DB
const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect();
  console.log('MongoDB conectado!')
} catch (err) {
  err => console.log(err.message)
}

const db = mongoClient.db();

// FUNÇÕES (ENDPOINTS)
app.post('/participants', async (req, res) => {

  const { name } = req.body;

  const nameSchema = Joi.object({
    name: Joi.string().required(),
  });

  const validation = nameSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const err = validation.error.details.map(detail => detail.message);
    return res.status(422).send(err);
  }

  try {
    const user = await db.collection('participants').findOne({ name });
    if (user) return res.status(409).send("Esse usuário já existe na sala!")

    await db.collection('participants').insertOne({ name, lastStatus: Date.now() });

    await db.collection('messages').insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:mm:ss') });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/participants', async (req, res) => {
  try {
    const participants = await db.collection('participants').find().toArray();
    res.send(participants);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/messages', async (req, res) => {

  const { to, text, type } = req.body;
  const { user } = req.headers;

  const messageSchema = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().valid('message', 'private_message').required()
  });

  const validation = messageSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const err = validation.error.details.map(details => details.message);
    return res.status(422).send(err);
  }

  const msg = { from: user, to, text, type, time: dayjs().format('HH:mm:ss') };

  try {
    const logged = await db.collection('participants').findOne({ name: user });
    if(!logged) return res.sendStatus(422);

    await db.collection('messages').insertOne(msg);

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/messages', async (req, res) => {
  const { user } = req.headers;
  const {limit} = req.query;

  if(!(parseInt(limit) > 0 || limit === undefined)) return res.sendStatus(422);

  try {
    const messages = await db.collection('messages').find({ $or: [{type: 'private_message', to: user}, {to: 'Todos'}, {type: 'private_message', from: user}]}).toArray();
    
    if(limit) {
      res.send(messages.slice(-limit));
    } else {
      res.send(messages);
    }    
    
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/status', async (req, res) => {

  const { user } = req.headers;

  if(!user) return res.sendStatus(404);

  try {
    const logged = await db.collection('participants').findOne({ name: user });
    if(!logged) return res.sendStatus(404);

    await db.collection('participants').updateOne({name: user}, {$set: {name: user, lastStatus: Date.now()}})
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

async function removeUser() {
  const dateNow = Date.now();

  try {
    const users = await db.collection('participants').find({ lastStatus: { $lt: dateNow - 10 * 1000 } }).toArray();
    
    users.forEach(async participant => {
      await db.collection('participants').deleteOne({name: participant.name})

      await db.collection('messages').insertOne({from: participant.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: dayjs().format('HH:mm:ss')})
    })
  } catch (err) {
    return err.message
  }
}

setInterval(removeUser, 10000);

db.collection('participants').deleteMany();

// LIGAR APP DO SERVER PARA OUVIR REQUISIÇÕES
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor está rodando na porta ${PORT}`)) 