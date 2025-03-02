 const express = require('express')
 const app = express()
 const cors = require('cors')
 const jwt = require('jsonwebtoken')
 require('dotenv').config()
 const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
//  const nodemailer = require('nodemailer') 

//  const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 587,
//   secure: false, // true for port 465, false for other ports
//   auth: {
//     user: "",
//     pass: "jn7jnAPss4f63QBp6D",
//   },
// });


 const port = process.env.PORT || 5000

 //MiddleWare
 app.use(cors())
 app.use(express.json()) 
 app.use(express.urlencoded()) //For sslCommercez payment success 


 const {
   MongoClient,
   ServerApiVersion,
   ObjectId
 } = require('mongodb');
const { default: axios } = require('axios')
 const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.le9rg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`; 

  
// Store ID: bistr67c146f86a46c
// Store Password (API/Secret Key): bistr67c146f86a46c@ssl
// Merchant Panel URL: https://sandbox.sslcommerz.com/manage/ (Credential as you inputted in the time of registration)
// Store name: testbistr6d17
// Registered URL: www.bistro-boss.com
// Session API to generate transaction: https://sandbox.sslcommerz.com/gwprocess/v3/api.php
// Validation API: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?wsdl
// Validation API (Web Service) name: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php 

/**
 * Steps: 
 * 1. payment initiate 
 * 
 */
 

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
     //  await client.connect();

     const usersCollection = client.db('BistroDB').collection('user')
     const menuCollection = client.db('BistroDB').collection('menu')
     const reviewCollection = client.db('BistroDB').collection('reviews')
     const cartCollection = client.db('BistroDB').collection('carts')
     const paymentCollection = client.db('BistroDB').collection('payments')

     //-2:JWT related apis: Create a jwt token
     app.post('/jwt', async (req, res) => {
       const user = req.body //payload => user email
       const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
         expiresIn: '5d'
       }) //create token 
       res.send({
         token
       })
     })

     //-1: Middleware for verify Token 
     const verifyToken = (req, res, next) => {
      //  console.log('inside verify Token', req.headers.authorization);
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
         req.decoded = decoded //EXP: {"email": "user@example.com","iat": 1708432560,"exp": 1708436160}
         next()
       })
     }
     //Middleware: use verify admin after verifyToken 
     const verifyAdmin = async (req, res, next) => {
       const email = req.decoded.email
       const query = {
         email: email
       }
       const user = await usersCollection.findOne(query)
       const isAdmin = user?.role === 'admin'
       if (!isAdmin) {
         return res.status(403).send({
           message: 'forbidden access'
         })
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
       const query = {
         email: email
       }
       const user = await usersCollection.findOne(query)
       let admin = false
       if (user) {
         admin = user?.role === 'admin'
       }
       res.send({
         admin
       })
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
     //1.1 Menu update data get
     app.get('/menu/:id', async (req, res) => {
       const id = req.params.id
       const query = {
         _id: new ObjectId(id)
       }
       const result = await menuCollection.findOne(query)
       res.send(result)
     })
     //1.2 menu post => only admin 
     app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
       const item = req.body
       const result = await menuCollection.insertOne(item)
       res.send(result)
     })
     //1.25: menu patch 
     app.patch('/menu/:id', async (req, res) => {
       const item = req.body
       const id = req.params.id
       const filter = {
         _id: new ObjectId(id)
       }
       const updatedDoc = {
         $set: {
           name: item.name,
           category: item.category,
           price: item.price,
           recipe: item.recipe,
           image: item.image
         }
       }

       const result = await menuCollection.updateOne(filter, updatedDoc)
       res.send(result)
     })
     //1.3: menu delete => only admin
     app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
       const id = req.params.id
       const query = {
         _id: new ObjectId(id)
       }
       const result = await menuCollection.deleteOne(query)
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

     //Payment Intent Starts(Stripe) 
     app.post('/create-payment-intent', async (req, res) => {
       const {
         price
       } = req.body
       const amount = parseInt(price * 100) //Price count as paisa
       console.log(amount, 'amount inside the intent');

       const paymentIntent = await stripe.paymentIntents.create({
         amount: amount,
         currency: 'usd',
         payment_method_types: ['card']
       })

       res.send({
         clientSecret: paymentIntent.client_secret //হলো একটি নিরাপদ টোকেন, যা শুধুমাত্র ফ্রন্টএন্ডে Stripe এর সাথে পেমেন্ট অথরাইজ করতে ব্যবহার করা হয়
       })
     })

     //Payment related apis 
     app.get('/payments/:email', verifyToken, async (req, res) => {
       const query = {
         email: req.params.email
       }
       //email validation
       if (req.params.email !== req.decoded.email) {
         return res.status(403).send({
           message: 'forbidden access'
         })
       }
       const result = await paymentCollection.find(query).toArray()
       res.send(result)
     })
     app.post('/payments', async (req, res) => {
       const payment = req.body
       const paymentResult = await paymentCollection.insertOne(payment)

      //  console.log('payment info', payment)
       //Carefully Delete each item from the cart 
       const query = {
         _id: {
           $in: payment.cartIds.map(id => new ObjectId(id))
         }
       }
       const deleteResult = await cartCollection.deleteMany(query)

       //send user email about payment confirmation 
      //  mg.messages
      //    .create(process.env.MAIL_SENDING_DOMAIN, {
      //     from: "Mailgun Sandbox <postmaster@sandboxde1172c5376a4e8786cf13768a7d9cec.mailgun.org>",
      //     to: ["MD IMON MIA <mdimonhossain2017@gmail.com>"],
      //     subject: "Hello! MD IMON MIA. Bistro Boss order confirmation",
      //     text: "Congratulations MD IMON MIA, you just sent an email with Mailgun! You are truly awesome!", 
      //     html: `
      //     <div>
      //      <h2>Thank You for you order</h2> 
      //      <h4>Your Transaction Id: <strong>${payment.transactionId}</strong></h4> 
      //       <p>We wuld like to get your feedback about the food</p>
      //     </div>`
      //    })
      //    .then((msg) => console.log(msg)) // সফল হলে response দেখাবে
      //    .catch((err) => console.error(err)); // কোনো সমস্যা হলে error দেখাবে


       res.send({
         paymentResult,
         deleteResult
       })
     }) 

     //SSL payment starts: create-ssl-payment 
     app.post('/create-ssl-payment', async (req, res) => {
       const payment = req.body 
      //  console.log('payment info', payment)
       
       const trxId = new ObjectId().toString() //Create unique transactionId( Hexadecimal string (24-characters long) )
       console.log(trxId);
       payment.transactionId = trxId 

       const initiate = { 
        store_id: 'bistr67c146f86a46c',
        store_passwd: 'bistr67c146f86a46c@ssl',
        total_amount: payment.price,
        currency: 'BDT',
        tran_id: trxId, // use unique tran_id for each api call
        success_url: 'http://localhost:5000/success-payment', //For success=> backend
        fail_url: 'http://localhost:5173/fail',//For fail => frontend
        cancel_url: 'http://localhost:5153/cancel',//For cancel => frontend
        ipn_url: 'http://localhost:5000/ipn-success-payment', //For success=> backend
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: 'Customer Name',
        cus_email: `${payment.email}`,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
    }; 

    const initResponse = await axios({
      url: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php', 
      method: 'POST',
      data: initiate,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      } 
    }) 
    const saveData = await paymentCollection.insertOne(payment)
    const gatewayUrl = initResponse?.data?.GatewayPageURL
    res.send({gatewayUrl})
     })
     
     //success-payment api: Validate payment with IPN 
     app.post('/success-payment', async(req, res) => {
      const paymentSuccess = req.body 
      // console.log('payment success info', paymentSuccess); 

      const {data} = await axios.get(`https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${paymentSuccess.val_id}&store_id=bistr67c146f86a46c&store_passwd=bistr67c146f86a46c@ssl`) 
      // console.log('Is valid pay', data);
    
      if(data.status !== 'VALID'){
        return res.send({message: 'Invalid Payment'})
      } 

      //Update the payment 
      const updatePayment = await paymentCollection.updateOne({transactionId: data.tran_id}, {
        $set: {
          status: 'success'
        }
      }) 
      console.log('Update payment', updatePayment);

      //Delete the document: Carefully delete:
      const payment = await paymentCollection.findOne({transactionId: data.tran_id}) 
      console.log('the payment', payment);
      const query = {
        _id: {
          $in: payment.cardIds.map(id => new ObjectId(id)) 
        }
      } 
      const deleteResult = await cartCollection.deleteMany(query) 

       
      
      res.redirect('http://localhost:5173/success') //redirect to this url
     }) 

     //Cancel-Payment api: 

     //states: 
     app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
       const users = await usersCollection.estimatedDocumentCount()
       const menuItems = await menuCollection.estimatedDocumentCount()
       const orders = await paymentCollection.estimatedDocumentCount()

       //  //This is not the best way:Testing
       //  const payments = await paymentCollection.find().toArray() 
       //  const revenue = payments.reduce((total, payment) => total + payment.price, 0)

       const result = await paymentCollection.aggregate([{
         $group: {
           _id: null, //null means Group all
           totalRevenue: {
             $sum: '$price'
           }
         }
       }]).toArray()

       // console.log(result); //[
       //   {
       //     _id: null,            // কোন গ্রুপের জন্য আউটপুট
       //     totalRevenue: 60      // মোট আয়
       //   }
       // ]

       const revenue = result.length > 0 ? result[0].totalRevenue : 0

       res.send({
         users,
         menuItems,
         orders,
         revenue
       })
     })

     //Order status
     /**
      * -------------------------------
      *    NON-Efficient Way
      * --------------------------------
      * 1.Load All the payments 
      * 2.For every menuItemIds (which is an array), go find the item from menu collection
      * 3.For every item in the menu collection that you found from payment entry(document)  
      */

     //Using aggregate pipeline
     app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
       const result = await paymentCollection.aggregate([{
           $unwind: '$menuItemIds'
         },
         {
           $lookup: {
             from: 'menu', //menuCollection এর সাথে মিলবে
             localField: 'menuItemIds', //unwind কৃত
             foreignField: '_id', //Match with menuCollection id
             as: 'menuItems'
           }
         },
         {
           $unwind: '$menuItems'
         },
         {
           $group: {
             _id: '$menuItems.category',
             quantity: {
               $sum: 1
             }, //Count Total Category
             revenue: {
               $sum: '$menuItems.price'
             }

           }
         },
         {
           $project: {
             _id: 0, //মানে ডকুমেন্টের _id ফিল্ড বাদ দেওয়া হবে।
             category: '$_id', // $group এর _id ফিল্ডটিকে নতুন নামে category হিসেবে রিনেম করা হয়েছে।
             quantity: '$quantity',
             revenue: '$revenue'

           }
         }
       ]).toArray()

       res.send(result)
     })

     // api Server ends here 

     // Send a ping to confirm a successful connection
     //  await client.db("admin").command({
     //    ping: 1
     //  });
     //  console.log("Pinged your deployment. You successfully connected to MongoDB!");
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