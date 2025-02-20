 const express = require('express')
 const app = express()
 const cors = require('cors')
 const jwt = require('jsonwebtoken')
 require('dotenv').config()
 const port = process.env.PORT || 5000

 //MiddleWare
 app.use(cors())
 app.use(express.json())


 const {
   MongoClient,
   ServerApiVersion,
   ObjectId
 } = require('mongodb');
 const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.le9rg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

 // Create a MongoClient with a MongoClientOptions object to set the Stable API version
 const client = new MongoClient(uri, {
   serverApi: {
     version: ServerApiVersion.v1,
     strict: true,
     deprecationErrors: true,
   }
 });

 async function run() {
   try {
     // Connect the client to the server	(optional starting in v4.7)
     await client.connect();

     const usersCollection = client.db('BistroDB').collection('user')
     const menuCollection = client.db('BistroDB').collection('menu')
     const reviewCollection = client.db('BistroDB').collection('reviews')
     const cartCollection = client.db('BistroDB').collection('carts')

     //-2:JWT related apis: Create a jwt token
     app.post('/jwt', async (req, res) => {
       const user = req.body //payload => user email
       const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
         expiresIn: '1h'
       }) //create token 
       res.send({
         token
       })
     })

     //-1: Middleware for verify Token 
     const verifyToken = (req, res, next) => {
       console.log('inside verify Token', req.headers.authorization);
       //Check only existence 
       if (!req.headers.authorization) {
         return res.status(401).send({
           message: 'unAuthorized access'
         })
       }
       //split authorization to get the token 
       const token = req.headers.authorization.split(' ')[1]
       jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
         if (err) {
           return res.status(401).send({
             message: 'unAuthorized access'
           })
         }
         req.decoded = decoded
         next()
       })
     } 
     //Middleware: use verify admin after verifyToken 
     const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email 
        const query = {email: email}
        const user = await usersCollection.findOne(query) 
        const isAdmin = user?.role === 'admin' 
        if(!isAdmin){
          return res.status(403).send({message: 'forbidden access'})
        } 
        next()
     }

     //0 Users related apis
     app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
       // console.log(req.headers); //use for checking purpose
       const result = await usersCollection.find().toArray()
       res.send(result)
     }) 

     app.get('/user/admin/:email', verifyToken, async (req, res) => {
       const email = req.params.email
       if (email !== req.decoded.email) {
         return res.status(403).send({
           message: 'forbidden Access'
         }) 
       }  
       const query = {email: email} 
       const user = await usersCollection.findOne(query) 
       let admin = false 
       if(user){
        admin = user?.role === 'admin'
       } 
       res.send({admin})
     }) 

     app.post('/users', async (req, res) => {
       const user = req.body
       //Insert email if user does not exists 
       //You can do this many ways(a.email unique, b. upsert, c. simple checking)
       const query = {
         email: user.email
       }
       const existingUser = await usersCollection.findOne(query)
       if (existingUser) {
         return res.send({
           message: 'user already exists',
           insertedId: null
         })
       }

       const result = await usersCollection.insertOne(user)
       res.send(result)
     }) 
     
     // User patch 
     app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
       const id = req.params.id
       // const query = {_id: new ObjectId(id)} //==> query OR filter 
       const filter = {
         _id: new ObjectId(id)
       }
       const updatedDoc = {
         $set: {
           role: 'admin'
         }
       }
       // const options = {upsert: true} //=> only for put
       const result = await usersCollection.updateOne(filter, updatedDoc)
       res.send(result)
     })

     // 0.1: Delete operation
     app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
       const id = req.params.id
       const query = {
         _id: new ObjectId(id)
       }
       const result = await usersCollection.deleteOne(query)
       res.send(result)
     })

     //1. load menu data
     app.get('/menu', async (req, res) => {
       const result = await menuCollection.find().toArray()
       //  console.log(result);
       res.send(result)
     })
     //2.Load review data
     app.get('/reviews', async (req, res) => {
       const result = await reviewCollection.find().toArray()
       //  console.log(result);
       res.send(result)
     })
     //3.Carts collection
     app.get('/carts', async (req, res) => {
       const email = req.query.email
       const query = {
         email: email
       }
       const result = await cartCollection.find(query).toArray()
       res.send(result)
     })
     app.post('/carts', async (req, res) => {
       const cartItem = req.body
       const result = await cartCollection.insertOne(cartItem)
       res.send(result)
     })
     //4.Delete cart 
     app.delete('/carts/:id', async (req, res) => {
       const id = req.params.id
       const query = {
         _id: new ObjectId(id)
       }
       const result = await cartCollection.deleteOne(query)
       res.send(result)


     })


     // Send a ping to confirm a successful connection
     await client.db("admin").command({
       ping: 1
     });
     console.log("Pinged your deployment. You successfully connected to MongoDB!");
   } finally {
     // Ensures that the client will close when you finish/error
     // await client.close();
   }
 }
 run().catch(console.dir);

 //app get and listen port
 app.get('/', (req, res) => {
   res.send('Bistro Boss is sitting') //See on browser
 })
 app.listen(port, () => {
   console.log(`Bistro Boss is sitting on port ${port}`) //See on server terminal
 })

 /**
  * -----------------------------------
  *      Naming Convention
  * app.get('/users')
  * app.get('/users/:id)
  * app.post('/users')
  * app.put('/users/:id')
  * app.patch('/users/:id')
  * app.delete('/users/:id')
  * ------------------------------------
  * 
  */