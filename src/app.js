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

    const {name} = req.body;

    const nameSchema = Joi.object({
      name: Joi.string().required(),
    });
  
    const validation = nameSchema.validate(req.body, {abortEarly: false});
    if(validation.error) {
      const err = validation.error.details.map(detail => detail.message);
      return res.status(422).send(err);
    }

    try {
      const user = await db.collection('participants').findOne({name});
      if(user) return res.status(409).send("Esse usuário já existe na sala!")

      await db.collection('participants').insertOne({name, lastStatus: Date.now()});

      await db.collection('messages').insertOne({from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format('HH:mm:ss')});
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

app.get('/messages', async (req, res) => {
  try {
    const messages = await db.collection('messages').find().toArray();
    res.send(messages);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/messages', async (req, res) => {

  const {to, text, type} = req.body;
  const {user} = req.headers;

  res.sendStatus(201)

  const messageSchema = Joi.object({
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().required('private_message' || 'message')
  });

  const validation = messageSchema.validate({abortEarly: false});
  if(validation.error) {
    const err = validation.error.details.map(details => details.message);
    return res.status(422).send(err);
  }

  const msg = {from: user, to, text, type, time: Date.now()};
  res.send(msg)

  /* try {
    console.log(msg)
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  } */
});


// LIGAR APP DO SERVER PARA OUVIR REQUISIÇÕES
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor está rodando na porta ${PORT}`)) 