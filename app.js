import express from 'express'
import http from 'http'
import crypto from 'crypto'
import { HNSWLib } from 'langchain/vectorstores'
import { OpenAIEmbeddings } from 'langchain/embeddings'
//import { TextLoader } from 'langchain/document_loaders'
import { OpenAI } from 'langchain/llms'
import { VectorDBQAChain } from 'langchain/chains'
import { CheerioWebBaseLoader } from 'langchain/document_loaders'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import * as fs from 'fs/promises'

// Load environment variables from .env file
import * as dotenv from 'dotenv'
dotenv.config()

// Setup the secret phrase and IV
const key = crypto.createHash('sha256').update(process.env.SECRET).digest()
const iv = Buffer.alloc(16)

// Set up Express app
const app = express()

// Middleware to parse JSON request bodies
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Question endpoint
app.post('/api/question', async (req, res) => {
  // Get the search query and APIKey from the request body
  const { search, api } = req.body

  // Create an AES-256-CBC cipher using the secret phrase and IV
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)

  // Encrypt the APIKey using the cipher
  let encrypted = cipher.update(api, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  // Use the encrypted APIKey as the directory name
  const directory = `./${encrypted}/`
  // Load the vector store from the same directory
  const vectorStore = await HNSWLib.load(directory, new OpenAIEmbeddings())

  try {
    // Instantiate the OpenAI model
    const llm = new PromptLayerOpenAI({
      promptLayerApiKey: process.env.PROMPTLAYER_API_KEY,
      modelName: 'gpt-3.5-turbo',
      //modelName: 'gpt-3.5-turbo-0301',
      concurrency: 15,
      cache: true,
      temperature: 0.1,
      pl_tags: ['voiceflow', 'kb'],
    })

    // Load the Q&A map reduce chain
    const chain = VectorDBQAChain.fromLLM(llm, vectorStore)
    const response = await chain.call({
      query: search,
    })

    // Return the response to the user
    res.json({ response })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error processing the request' })
  }
})

app.post('/api/parser', async (req, res) => {
  const { url, api } = req.body
  const loader = new CheerioWebBaseLoader(url)
  const docs = await loader.load()
  console.log(docs)
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 4000,
    chunkOverlap: 200,
  })

  const docOutput = await textSplitter.splitDocuments(docs)
  // Create an AES-256-CBC cipher using the secret phrase and IV
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  // Encrypt the APIKey using the cipher
  let encrypted = cipher.update(api, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const directory = `./${encrypted}/`

  let vectorStore
  let already = false
  try {
    vectorStore = await HNSWLib.load(directory, new OpenAIEmbeddings())
    // Load the JSON file

    const data = await fs.readFile(`${directory}docstore.json`)
    const db = JSON.parse(data)

    // Check if metadata with the same source already exists
    const source = url
    const exists = db.some(
      ([id, { metadata }]) => metadata && metadata.source === source
    )

    if (exists) {
      already = true
      console.log(`Metadata with source "${source}" already exists`)
    } else {
      console.log(`No metadata with source "${source}" found`)
      await vectorStore.addDocuments(docOutput)
    }
  } catch (err) {
    // If the vector store doesn't exist yet, create a new one
    vectorStore = await HNSWLib.fromDocuments(docOutput, new OpenAIEmbeddings())
  }

  // Save the vector store to a directory
  await vectorStore.save(directory)

  try {
    // Return the response to the user
    res.json({ response: 'success', already: already })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error processing conversation request' })
  }
})

// Create HTTP server
http.createServer(app).listen(process.env.PORT)
console.info('KB API is listening on port ' + process.env.PORT)
