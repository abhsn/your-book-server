const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');

const port = process.env.PORT || 5000;

// initialize express
const app = express();

// initialize dotenv
require('dotenv').config();

// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
	res.send('Resale market is running...');
});

const uri = process.env.DB_URL;
const client = new MongoClient(uri);

// verify jwt
function verifyJWT(req, res, next) {
	const authorization = req.headers.authorization;
	if (!authorization) {
		res.status(401).send({ message: 'unauthorized access' });
	} else {
		const token = authorization.split(' ')[1];
		jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
			if (err) {
				res.status(403).send({ message: 'forbidden' });
			} else {
				req.decoded = decoded;
				next();
			}
		});
	}
}

const stipe = new Stripe(process.env.STRIPE_SECRET);

// function to create, read, update and delete data in database
async function crudOperation() {
	try {
		const categoriesCollection = client.db("resale-market").collection('categories');
		const productsCollection = client.db('resale-market').collection('products');
		const usersCollection = client.db('resale-market').collection('users');
		const ordersCollection = client.db('resale-market').collection('orders');
		const soldCollection = client.db('resale-market').collection('solds');

		// sends all categories
		app.get('/categories', async (req, res) => {
			// project returns specific keys only
			const cursor = categoriesCollection.find({}).project({ name: 1, img: 1 });
			const categories = await cursor.toArray();
			res.send(categories);
		})

		// sends items of specific category
		app.get('/category/:id', verifyJWT, async (req, res) => {
			const query = { categoryId: req.params.id };
			const cursor = productsCollection.find(query);
			const categories = await cursor.toArray();
			res.send(categories);
		});

		app.put('/booking', verifyJWT, async (req, res) => {
			const decodedEmail = req.decoded.email;
			if (decodedEmail !== req.body.buyerDetails.email) {
				res.status(401).send({ message: 'unauthorized access' });
			} else {
				const productId = req.body.productId;
				const userEmail = req.decoded.email;

				const query = {
					productId,
					'buyer.email': userEmail
				}

				// checks if user booked this item previously or not
				const previousOrder = await ordersCollection.findOne(query);
				if (previousOrder) {
					res.json({ message: 'already added' });
				} else {
					const buyer = req.body.buyerDetails;
					const saveOrder = {
						productId,
						buyer
					};
					const result = await ordersCollection.insertOne(saveOrder);
					if (result.acknowledged) {
						res.json({ success: true });
					} else {
						res.json({ success: false });
					}
				}
			}
		})

		app.get('/getProductDetails', verifyJWT, async (req, res) => {
			const productId = req.query.id;
			const query = {
				_id: ObjectId(productId)
			};
			const result = await productsCollection.findOne(query);
			res.send(result);
		})

		app.get('/jwt', async (req, res) => {
			const email = req.query.email;
			const user = await usersCollection.findOne({ email });
			if (user) {
				const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '7d' });
				res.send({ accessToken: token });
			} else {
				res.status(403).send({ message: 'forbidden' });
			}
		})

		// adds new created user account to db
		app.post('/users', async (req, res) => {
			const user = req.body;
			const result = await usersCollection.insertOne(user);
			res.send(result);
		})

		app.get('/allsellers', verifyJWT, async (req, res) => {
			const decodedEmail = req.decoded.email;
			if (decodedEmail !== req.query.email) {
				res.status(401).send({ message: 'unauthorized access' });
			} else {
				const user = await usersCollection.findOne({ email: decodedEmail });
				if (user.userType === 'admin') {
					const cursor = await usersCollection.find({ userType: 'seller' }).project({ name: 1, email: 1 }).toArray();
					res.send(cursor);
				} else {
					res.status(403).send('forbidden');
				}
			}
		})

		app.get('/allbuyers', verifyJWT, async (req, res) => {
			const decodedEmail = req.decoded.email;
			if (decodedEmail !== req.query.email) {
				res.status(401).send({ message: 'unauthorized access' });
			} else {
				const user = await usersCollection.findOne({ email: decodedEmail });
				if (user.userType === 'admin') {
					const cursor = await usersCollection.find({ userType: 'buyer' }).project({ name: 1, email: 1 }).toArray();
					res.send(cursor);
				} else {
					res.status(403).send('forbidden');
				}
			}
		})

		app.get('/allreported', verifyJWT, async (req, res) => {
			const decodedEmail = req.decoded.email;
			if (decodedEmail !== req.query.email) {
				res.status(401).send({ message: 'unauthorized access' });
			} else {
				const user = await usersCollection.findOne({ email: decodedEmail });
				if (user.userType === 'admin') {
					const cursor = await productsCollection.find({ reported: true }).project({ buyer: 0 }).toArray();
					res.send(cursor);
				} else {
					res.status(403).send('forbidden');
				}
			}
		})

		app.get('/userType', verifyJWT, async (req, res) => {
			const decodedEmail = req.decoded.email;
			if (decodedEmail !== req.query.email) {
				res.status(401).send({ message: 'unauthorized access' });
			} else {
				const user = await usersCollection.findOne({ email: decodedEmail });
				if (user.userType) {
					res.send({ userType: user.userType });
				} else {
					res.status(403).send('forbidden');
				}
			}
		})

		app.get('/myOrders', verifyJWT, async (req, res) => {
			const decodedEmail = req.decoded.email;
			if (decodedEmail !== req.query.email) {
				res.status(401).send({ message: 'unauthorized access' });
			} else {
				const query = {
					'buyer.email': decodedEmail
				};
				const products = await ordersCollection.find(query).toArray();
				res.send(products);
			}
		})

		app.post('/payment/:id', verifyJWT, async (req, res) => {
			const decodedEmail = req.decoded.email;
			const buyerEmail = req.body.email;

			if (decodedEmail !== buyerEmail) {
				res.status(401).send({ message: 'unauthorized access' });
			} else {
				const paymentId = req.body.id;
				const productId = req.params.id;

				// checks price and email from database
				const result = await productsCollection.findOne({ _id: ObjectId(productId) });
				const order = await ordersCollection.findOne({ productId, 'buyer.email': decodedEmail });
				const price = result.resalePrice;

				// can't pay if user did not book the item
				if (decodedEmail !== order?.buyer?.email) {
					res.status(401).send({ message: 'unauthorized access' });
				} else {

					// procced to payment
					try {
						const payment = await stipe.paymentIntents.create({
							amount: price * 100,
							currency: 'USD',
							payment_method: paymentId,
							confirm: true
						})

						// removes product from orders
						const removed = await ordersCollection.deleteOne({ productId, 'buyer.email': decodedEmail });
						if (removed.deletedCount > 0) {

							// add item to sold collection
							const item = {
								productId,
								paymentId: payment.id,
								buyerEmail: decodedEmail
							}
							const result = await soldCollection.insertOne(item);
							if (result.acknowledged) {
								res.json({ success: true, paymentId: payment.id });
							} else {
								res.json({ success: false });
							}
						}
					} catch (err) {
						console.error(err);
						res.json({ success: false });
					}
				}
			}
		})

		app.delete('/deleteUser', verifyJWT, async (req, res) => {
			const decodedEmail = req.decoded.email;
			const user = await usersCollection.findOne({ email: decodedEmail });
			if (user.userType === 'admin') {
				const result = await usersCollection.deleteOne({ email: req.headers.useremail });
				if (result.deletedCount > 0) {
					res.json({ success: true });
				} else {
					res.json({ success: false });
				}
			} else {
				res.status(403).send('forbidden');
			}
		})

	}
	catch (err) {
		console.log(err);
	}
}

crudOperation();

app.listen(port, () => console.log('Listening to port', port));