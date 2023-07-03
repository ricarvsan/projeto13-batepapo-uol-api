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
  console.log(limit)

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

// LIGAR APP DO SERVER PARA OUVIR REQUISIÇÕES
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor está rodando na porta ${PORT}`)) 