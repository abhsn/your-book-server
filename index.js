const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

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
		res.send(401).status({ message: 'unauthorized access' });
	} else {
		const token = authorization.split(' ')[1];
		jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
			if (err) {
				res.send(403).status({ message: 'forbidden' });
			} else {
				req.decoded = decoded;
				next();
			}
		});
	}
}

// function to create, read, update and delete data in database
async function crudOperation() {
	try {
		const categoriesCollection = client.db("resale-market").collection('categories');
		const productsCollection = client.db('resale-market').collection('products');
		const usersCollection = client.db('resale-market').collection('users');

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

		app.patch('/booking', async (req, res) => {
			const buyer = req.body.buyerDetails;
			const productId = req.body.productId;
			const filter = { _id: ObjectId(productId) };
			const options = { upsert: true };
			const updateProduct = {
				$set: {
					buyer
				}
			}
			const result = await productsCollection.updateOne(filter, updateProduct, options);
			if (result.modifiedCount > 0) {
				res.send({ success: true });
			} else {
				res.send({ success: false });
			}
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

		app.post('/users', async (req, res) => {
			const user = req.body;
			const result = await usersCollection.insertOne(user);
			res.send(result);
		})
	}
	catch (err) {
		console.log(err);
	}
}

crudOperation();

app.listen(port, () => console.log('Listening to port', port));