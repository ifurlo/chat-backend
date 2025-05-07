require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

const Message = mongoose.model('Message', new mongoose.Schema({
  sessionId: String,
  sender:    String,
  message:   String,
  timestamp: { type: Date, default: Date.now }
}));

app.get('/api/history/:sessionId', async (req, res) => {
  const msgs = await Message.find({ sessionId: req.params.sessionId }).sort('timestamp');
  res.json(msgs);
});

app.post('/api/message', async (req, res) => {
  let { sessionId, sender, message } = req.body;
  if (!sessionId) sessionId = new mongoose.Types.ObjectId().toString();

  await Message.create({ sessionId, sender, message });

  const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
  const history = (await Message.find({ sessionId }).sort('timestamp'))
    .map(m => ({ role: m.sender==='bot'?'assistant':'user', content: m.message }));

  const aiRes = await openai.createChatCompletion({ model: "gpt-3.5-turbo", messages: history });
  const reply = aiRes.data.choices[0].message.content;

  await Message.create({ sessionId, sender:'bot', message:reply });
  res.json({ sessionId, reply });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Listening on ${PORT}`));
